'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const EVENTS = require('../../config/constants/events');
const {
  SYSTEM_INSTRUCTION,
  SCHOLARSHIP_RESPONSE_SCHEMA,
} = require('../../config/analyzerConfig');
const { withRetry } = require('../../utils/retry');
const { validateAnalyzerResponse } = require('../../utils/validators');
const { metrics } = require('../../utils/metrics');

const MAX_TEXT_CHARS = 15_000;

function initGeminiAnalyzer(broker) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[Analyzer] FATAL — GEMINI_API_KEY is not set in environment variables. ' +
      'The analyzer cannot start without a valid API key.',
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHOLARSHIP_RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  });

  broker.on(EVENTS.SCRAPER.SUCCESS, async ({ url, text }) => {
    console.log(`[Analyzer] Analyzing content from: ${url}`);
    metrics.recordAnalyzerAttempt();

    try {
      if (!text || text.trim().length === 0) {
        throw new Error(`Received empty text payload for URL: ${url}`);
      }

      const safeText = text.slice(0, MAX_TEXT_CHARS);

      const prompt =
        `Evaluate the following scholarship page content for eligibility:\n\n` +
        `--- BEGIN PAGE CONTENT ---\n${safeText}\n--- END PAGE CONTENT ---`;

      let result;
      try {
        result = await withRetry(
          async () => {
            const res = await model.generateContent(prompt);
            metrics.recordGeminiRequest();
            return res;
          },
          {
            maxRetries: 3,
            baseDelayMs: 1000,
            onRetry: ({ attempt, delay, error }) => {
              console.warn(`[Analyzer] Gemini retry ${attempt}/3 after ${delay}ms: ${error}`);
              metrics.recordAnalyzerRetry();
            },
          },
        );
      } catch (retryErr) {
        throw new Error(`Gemini API failed after retries: ${retryErr.message}`);
      }

      const rawResponse = result.response.text();

      let ai_data;
      try {
        const cleaned = rawResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        ai_data = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(
          `Gemini returned malformed JSON.\nParse error: ${parseErr.message}\nRaw response: ${rawResponse.slice(0, 300)}`
        );
      }

      try {
        ai_data = validateAnalyzerResponse(ai_data, url);
      } catch (validErr) {
        throw new Error(`Analyzer response validation failed: ${validErr.message}`);
      }

      if (ai_data.match_score >= 75) {
        console.log(`[Analyzer] COGNITIVE MATCH CONFIRMED [${ai_data.match_score}%] → ${ai_data.uni_country}`);
        metrics.recordAnalyzerMatch();
        broker.emit(EVENTS.ANALYZER.MATCH_FOUND, { url, ...ai_data });
      } else {
        console.log(`[Analyzer] MATRICULATION REJECTED [${ai_data.match_score}%] → ${ai_data.verdict}`);
        metrics.recordAnalyzerReject();
        broker.emit(EVENTS.ANALYZER.NO_MATCH, { url, reason: `Score ${ai_data.match_score}%: ${ai_data.verdict}` });
      }

    } catch (err) {
      console.error(`[Analyzer] Analysis failed for ${url} →`, err.message);
      metrics.recordAnalyzerFailure();

      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'GeminiAnalyzer',
        url,
        message: err.message,
        stack: err.stack,
      });
    }
  });

  console.log('[Analyzer] Gemini percentage-based scoring engine initialized and listening.');
}

module.exports = { initGeminiAnalyzer };