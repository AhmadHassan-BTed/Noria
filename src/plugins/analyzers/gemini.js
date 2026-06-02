'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { BaseAnalyzer } = require('../base');
const { withRetry } = require('../../utils/retry');
const { validateAnalyzerResponse } = require('../../utils/validators');
const { metrics } = require('../../utils/metrics');

class RequestQueue {
  constructor(minDelayMs = 3000) {
    this.minDelayMs = minDelayMs;
    this.lastRequestTime = 0;
    this.queue = Promise.resolve();
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        const delay = Math.max(0, this.minDelayMs - elapsed);
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        this.lastRequestTime = Date.now();
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

const geminiQueue = new RequestQueue(3000);

class GeminiAnalyzer extends BaseAnalyzer {
  constructor(config = {}) {
    super(config);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('[Gemini] GEMINI_API_KEY not set in environment');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.provider = null;
    this.model = config.model || 'gemini-2.5-flash';
    this.temperature = config.temperature || 0.1;
    this.maxTokens = 15000;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async analyze(content, context = {}) {
    if (!this.provider) {
      throw new Error('[Gemini] Provider not set');
    }

    const schema = this.provider.getSchema();
    const safeText = content.slice(0, this.maxTokens);

    const analysisConfig = await this.provider.getAnalyzer().analyze(safeText, context);

    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: analysisConfig.systemInstruction || context.systemInstruction,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: analysisConfig.schema || schema,
        temperature: this.temperature,
      },
    });

    let result;
    try {
      result = await withRetry(
        async () => {
          const res = await geminiQueue.add(async () => {
            return await model.generateContent(analysisConfig.prompt);
          });
          metrics.recordGeminiRequest();
          return res;
        },
        {
          maxRetries: 5,
          baseDelayMs: 1000,
          onRetry: ({ attempt, delay, error }) => {
            console.warn(`[Gemini] Retry ${attempt}/5 after ${delay}ms: ${error}`);
            metrics.recordAnalyzerRetry();
          },
        }
      );
    } catch (retryErr) {
      throw new Error(`[Gemini] Failed after retries: ${retryErr.message}`);
    }

    const rawResponse = result.response.text();

    let aiData;
    try {
      const cleaned = rawResponse
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();
      aiData = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error(`[Gemini] Malformed JSON: ${parseErr.message}`);
    }

    try {
      aiData = validateAnalyzerResponse(aiData, context.url);
    } catch (validErr) {
      throw new Error(`[Gemini] Response validation failed: ${validErr.message}`);
    }

    return aiData;
  }
}

module.exports = { GeminiAnalyzer };
