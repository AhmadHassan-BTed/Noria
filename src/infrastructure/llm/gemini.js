'use strict';

/**
 * Infrastructure — Gemini LLM Adapter
 *
 * Stateless adapter for Google Gemini API interactions.
 * All state (model cache, request queue) is module-scoped singleton.
 * External callers pass only plain data (prompt string, schema object, options).
 *
 * NO classes exported. NO setProvider(). NO inheritance.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { RequestQueue } = require('./requestQueue');
const { withRetry } = require('../../utils/retry');
const { metrics } = require('../../utils/metrics');

// ─── Module-level singleton state ─────────────────────────────────────────────
let genAI = null;
let currentModel = 'gemini-2.5-flash';
let supportedModelsCache = null;
const geminiQueue = new RequestQueue(3000);

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Lazily initialise the GoogleGenerativeAI client.
 * Called automatically on first generateStructuredData() invocation.
 *
 * @param {string} [apiKey] – Falls back to GEMINI_API_KEY env var.
 */
function ensureInitialized(apiKey) {
  if (genAI) {
    return;
  }
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('[Gemini] GEMINI_API_KEY not set in environment');
  }
  genAI = new GoogleGenerativeAI(key);
}

// ─── Model Discovery ─────────────────────────────────────────────────────────

/**
 * Fetches and caches the list of supported Gemini models, prioritised for
 * the current use-case.
 *
 * @param {string} [preferredModel] – Model name to prioritise at the top.
 * @returns {Promise<string[]>} Sorted model name list.
 */
async function getSupportedModels(preferredModel) {
  if (supportedModelsCache) {
    return supportedModelsCache;
  }

  const defaults = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  const preferred = preferredModel || currentModel;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || 'API Error');
    }

    const models = data.models
      .filter((m) => m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => m.name.replace('models/', ''))
      .filter((m) => m.includes('gemini'));

    const sorted = [];
    if (models.includes(preferred)) {
      sorted.push(preferred);
    }

    const priorityOrder = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
    ];
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

    supportedModelsCache = sorted.length > 0 ? sorted : defaults;
  } catch (err) {
    console.warn(`[Gemini] Failed to fetch supported models list: ${err.message}. Using defaults.`);
    supportedModelsCache = defaults;
  }

  return supportedModelsCache;
}

// ─── Core Generation ──────────────────────────────────────────────────────────

/**
 * Sends a prompt + schema to Gemini and returns parsed structured JSON.
 *
 * Handles:
 *   • Automatic model fallback on 429 / quota-exceeded
 *   • Exponential back-off retries
 *   • JSON parsing & cleanup
 *
 * @param {string} prompt           – The full LLM prompt string.
 * @param {object} schema           – Gemini response schema object.
 * @param {object} [options]
 * @param {string} [options.model]           – Override preferred model name.
 * @param {number} [options.temperature]     – Sampling temperature (default 0.1).
 * @param {string} [options.systemInstruction] – Optional system instruction.
 * @param {string} [options.apiKey]          – Override API key.
 * @returns {Promise<object>} Parsed JSON response from Gemini.
 */
async function generateStructuredData(prompt, schema, options = {}) {
  const { temperature = 0.1, systemInstruction, apiKey } = options;

  ensureInitialized(apiKey);

  const modelsToTry = await getSupportedModels(options.model || currentModel);
  let lastErr;

  for (const modelName of modelsToTry) {
    console.log(`[Gemini] Attempting analysis using model: ${modelName}`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction || undefined,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature,
      },
    });

    let result;
    try {
      result = await withRetry(
        async () => {
          const res = await geminiQueue.add(async () => {
            return await model.generateContent(prompt);
          });
          metrics.recordGeminiRequest();
          return res;
        },
        {
          maxRetries: 5,
          baseDelayMs: 1000,
          onRetry: ({ attempt, delay, error }) => {
            console.warn(
              `[Gemini] Retry ${attempt}/5 for model ${modelName} after ${delay}ms: ${error}`
            );
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

      // Successfully completed. Update active model for subsequent calls.
      if (currentModel !== modelName) {
        console.log(`[Gemini] Switched primary active model to: ${modelName}`);
        currentModel = modelName;
      }
      return aiData;
    } catch (err) {
      console.warn(`[Gemini] Model ${modelName} failed: ${err.message}`);
      lastErr = err;

      const lowerMsg = err.message.toLowerCase();
      const isQuotaOrRateLimit =
        lowerMsg.includes('429') ||
        lowerMsg.includes('quota') ||
        lowerMsg.includes('too many requests');

      if (isQuotaOrRateLimit && modelName !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(
          `[Gemini] Quota exceeded for ${modelName}. Falling back to next available model...`
        );
        continue;
      } else {
        throw err;
      }
    }
  }

  throw new Error(`[Gemini] All fallback models failed. Last error: ${lastErr.message}`);
}

// ─── Test Helpers ─────────────────────────────────────────────────────────────

/** Resets all module-level state. Only for testing. */
function _resetForTesting() {
  genAI = null;
  currentModel = 'gemini-2.5-flash';
  supportedModelsCache = null;
}

module.exports = {
  generateStructuredData,
  getSupportedModels,
  ensureInitialized,
  _resetForTesting,
};
