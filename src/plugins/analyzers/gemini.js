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
    this._supportedModelsCache = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async getSupportedModels() {
    if (this._supportedModelsCache) {
      return this._supportedModelsCache;
    }

    const defaults = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) {
        throw new Error(`Status ${res.status}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }
      
      const models = data.models
        .filter(m => m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
        .filter(m => m.includes('gemini'));

      const sorted = [];
      if (models.includes(this.model)) {
        sorted.push(this.model);
      }
      const priorityOrder = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.0-pro'];
      for (const m of priorityOrder) {
        if (models.includes(m) && !sorted.includes(m)) {
          sorted.push(m);
        }
      }
      for (const m of models) {
        if (!sorted.includes(m)) {
          sorted.push(m);
        }
      }

      this._supportedModelsCache = sorted.length > 0 ? sorted : defaults;
    } catch (err) {
      console.warn(`[Gemini] Failed to fetch supported models list: ${err.message}. Using defaults.`);
      this._supportedModelsCache = defaults;
    }

    return this._supportedModelsCache;
  }

  async analyze(content, context = {}) {
    if (!this.provider) {
      throw new Error('[Gemini] Provider not set');
    }

    const schema = this.provider.getSchema();
    const safeText = content.slice(0, this.maxTokens);

    const analysisConfig = await this.provider.getAnalyzer().analyze(safeText, context);

    const modelsToTry = await this.getSupportedModels();
    let lastErr;

    for (const modelName of modelsToTry) {
      console.log(`[Gemini] Attempting analysis using model: ${modelName}`);

      const model = this.genAI.getGenerativeModel({
        model: modelName,
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
              console.warn(`[Gemini] Retry ${attempt}/5 for model ${modelName} after ${delay}ms: ${error}`);
              metrics.recordAnalyzerRetry();
            },
          }
        );

        const rawResponse = result.response.text();

        let aiData;
        try {
          const cleaned = rawResponse
            .replace(/^```json\s*/i, '')
            .replace(/```\s*$/, '')
            .trim();
          aiData = JSON.parse(cleaned);
        } catch (parseErr) {
          throw new Error(`Malformed JSON: ${parseErr.message}`);
        }

        try {
          aiData = validateAnalyzerResponse(aiData, context.url);
        } catch (validErr) {
          throw new Error(`Response validation failed: ${validErr.message}`);
        }

        // Successfully completed analysis. Dynamically save this model for subsequent calls.
        if (this.model !== modelName) {
          console.log(`[Gemini] Switched primary active model to: ${modelName}`);
          this.model = modelName;
        }
        return aiData;

      } catch (err) {
        console.warn(`[Gemini] Model ${modelName} failed: ${err.message}`);
        lastErr = err;

        const lowerMsg = err.message.toLowerCase();
        const isQuotaOrRateLimit = lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('too many requests');

        if (isQuotaOrRateLimit && modelName !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`[Gemini] Quota exceeded for ${modelName}. Falling back to next available model...`);
          continue;
        } else {
          // Structural failure or last model exceeded quota: throw the error
          throw err;
        }
      }
    }

    throw new Error(`[Gemini] All fallback models failed. Last error: ${lastErr.message}`);
  }
}

module.exports = { GeminiAnalyzer };
