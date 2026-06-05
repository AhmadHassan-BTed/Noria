'use strict';

/**
 * Infrastructure — Groq LLM Adapter
 *
 * Stateless adapter for Groq API interactions.
 * All state (model cache, request queue) is module-scoped singleton.
 * External callers pass only plain data (prompt string, schema object, options).
 *
 * Conforms fully to Noria's data-coupling and stateless design.
 */

const { RequestQueue } = require('./requestQueue');
const { withRetry } = require('../../utils/retry');
const { metrics } = require('../../utils/metrics');

// ─── Module-level singleton state ─────────────────────────────────────────────
let groqApiKey = null;
let currentModel = 'llama-3.3-70b-versatile';
let supportedModelsCache = null;
const groqQueue = new RequestQueue(1000); // Groq queue spacing out requests (1s delay)

// ─── Initialization ───────────────────────────────────────────────────────────

/**
 * Lazily initialise the Groq API client config.
 * Called automatically on first generateStructuredData() invocation.
 *
 * @param {string} [apiKey] – Falls back to GROQ_API_KEY or LLM_API_KEY env vars.
 */
function ensureInitialized(apiKey) {
  groqApiKey = apiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
  if (!groqApiKey) {
    throw new Error('[Groq] GROQ_API_KEY or LLM_API_KEY not set in environment');
  }
}

// ─── Model Discovery ─────────────────────────────────────────────────────────

/**
 * Fetches and caches the list of supported Groq models.
 *
 * @param {string} [preferredModel] – Model name to prioritise at the top.
 * @returns {Promise<string[]>} Sorted model name list.
 */
async function getSupportedModels(preferredModel) {
  if (supportedModelsCache) {
    return supportedModelsCache;
  }

  const defaults = [
    'llama-3.3-70b-versatile',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
    'llama-3.1-8b-instant',
    'gemma2-9b-it'
  ];
  const preferred = (preferredModel && preferredModel.toLowerCase() !== 'auto') ? preferredModel : currentModel;

  try {
    const key = groqApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
    if (!key) {
      return defaults;
    }
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });
    if (!res.ok) {
      throw new Error(`Status ${res.status}`);
    }

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Invalid response structure');
    }

    const models = data.data
      .filter((m) => m.active !== false)
      .map((m) => m.id);

    const sorted = [];
    if (models.includes(preferred)) {
      sorted.push(preferred);
    }

    for (const d of defaults) {
      if (models.includes(d) && !sorted.includes(d)) {
        sorted.push(d);
      }
    }

    for (const m of models) {
      if (!sorted.includes(m)) {
        sorted.push(m);
      }
    }

    supportedModelsCache = sorted.length > 0 ? sorted : defaults;
  } catch (err) {
    console.warn(`[Groq] Failed to fetch supported models list: ${err.message}. Using defaults.`);
    supportedModelsCache = defaults;
  }

  return supportedModelsCache;
}

// ─── Core Generation ──────────────────────────────────────────────────────────

/**
 * Sends a prompt + schema to Groq and returns parsed structured JSON.
 *
 * @param {string} prompt           – The full LLM prompt string.
 * @param {object} schema           – The response schema object.
 * @param {object} [options]
 * @param {string} [options.model]           – Override preferred model name.
 * @param {number} [options.temperature]     – Sampling temperature (default 0.1).
 * @param {string} [options.systemInstruction] – Optional system instruction.
 * @param {string} [options.apiKey]          – Override API key.
 * @returns {Promise<object>} Parsed JSON response from Groq.
 */
async function generateStructuredData(prompt, schema, options = {}) {
  const { temperature = 0.1, systemInstruction, apiKey } = options;

  ensureInitialized(apiKey);

  const modelsToTry = await getSupportedModels(options.model || currentModel);
  let lastErr;

  for (const modelName of modelsToTry) {
    console.log(`[Groq] Attempting analysis using model: ${modelName}`);

    const key = groqApiKey || process.env.GROQ_API_KEY || process.env.LLM_API_KEY;

    try {
      const result = await withRetry(
        async () => {
          return await groqQueue.add(async () => {
            const systemPrompt = (systemInstruction || "You are a precise extraction engine.") +
              "\nYou must return a JSON object conforming exactly to the following schema:\n" +
              JSON.stringify(schema, null, 2);

            const apiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: modelName,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: temperature
              })
            });

            if (!apiResponse.ok) {
              const text = await apiResponse.text();
              throw new Error(`Groq API error (${apiResponse.status}): ${text}`);
            }

            metrics.recordAnalyzerAttempt();
            return await apiResponse.json();
          });
        },
        {
          maxRetries: 5,
          baseDelayMs: 1000,
          onRetry: ({ attempt, delay, error }) => {
            console.warn(
              `[Groq] Retry ${attempt}/5 for model ${modelName} after ${delay}ms: ${error}`
            );
            metrics.recordAnalyzerRetry();
          },
        }
      );

      const rawResponse = result.choices[0].message.content;

      let aiData;
      try {
        const cleaned = rawResponse
          .replace(/^```json\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();
        aiData = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(`Malformed JSON response: ${parseErr.message}`);
      }

      // Record tokens used
      if (result.usage && result.usage.total_tokens) {
        metrics.recordGroqTokens(result.usage.total_tokens);
      }

      if (currentModel !== modelName) {
        console.log(`[Groq] Switched primary active model to: ${modelName}`);
        currentModel = modelName;
      }
      return aiData;
    } catch (err) {
      console.warn(`[Groq] Model ${modelName} failed: ${err.message}`);
      lastErr = err;

      const lowerMsg = err.message.toLowerCase();
      const isQuotaOrRateLimit =
        lowerMsg.includes('429') ||
        lowerMsg.includes('quota') ||
        lowerMsg.includes('too many requests') ||
        lowerMsg.includes('rate limit');

      if (isQuotaOrRateLimit && modelName !== modelsToTry[modelsToTry.length - 1]) {
        console.warn(
          `[Groq] Quota/Rate limit exceeded for ${modelName}. Falling back to next available model...`
        );
        continue;
      } else {
        throw err;
      }
    }
  }

  throw new Error(`[Groq] All fallback models failed. Last error: ${lastErr.message}`);
}

function _resetForTesting() {
  groqApiKey = null;
  currentModel = 'llama-3.3-70b-versatile';
  supportedModelsCache = null;
}

module.exports = {
  generateStructuredData,
  getSupportedModels,
  ensureInitialized,
  _resetForTesting,
};
