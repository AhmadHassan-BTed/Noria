'use strict';

/**
 * Infrastructure — Fallback LLM Adapter (Multi-LLM Dispatcher)
 *
 * Stateless adapter that routes requests to a chain of configured LLM providers.
 * If the first provider fails, it seamlessly falls back to the next one in the list.
 *
 * Conforms fully to Noria's data-coupling and stateless design.
 */

const { registry } = require('../../core/registry');

function parseChainFromEnv() {
  if (!process.env.LLM_CHAIN) {
    return null;
  }
  try {
    return JSON.parse(process.env.LLM_CHAIN);
  } catch (err) {
    console.error(`[LLM Fallback] Failed to parse LLM_CHAIN JSON: ${err.message}`);
    return null;
  }
}

/**
 * Sends prompt and schema sequentially down the chain of configured LLMs.
 *
 * @param {string} prompt           – The full LLM prompt string.
 * @param {object} schema           – The response schema object.
 * @param {object} [options]
 * @returns {Promise<object>} Parsed JSON response from the first succeeding LLM.
 */
async function generateStructuredData(prompt, schema, options = {}) {
  const chain = parseChainFromEnv() || [
    {
      provider: process.env.LLM_PROVIDER || 'gemini',
      apiKey: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY,
      model: process.env.LLM_MODEL || 'Auto',
    },
  ];

  let lastError = new Error('No LLM providers configured in chain');

  for (let i = 0; i < chain.length; i++) {
    const config = chain[i];
    const providerName = (config.provider || 'gemini').toLowerCase();
    const modelName = config.model || 'Auto';

    console.log(
      `[LLM Fallback] Attempting LLM [${i + 1}/${chain.length}]: ${providerName} (${modelName})`
    );

    try {
      const adapter = registry.getAdapter('llm', providerName);

      const opt = {
        ...options,
        model: modelName,
        apiKey: config.apiKey || config.api_key,
      };

      // Set key in environment variables so that child adapters can find it
      if (providerName === 'groq') {
        process.env.GROQ_API_KEY = config.apiKey || config.api_key || process.env.GROQ_API_KEY;
      } else {
        process.env.GEMINI_API_KEY = config.apiKey || config.api_key || process.env.GEMINI_API_KEY;
      }

      const res = await adapter.generateStructuredData(prompt, schema, opt);
      console.log(`[LLM Fallback] LLM [${i + 1}/${chain.length}] (${providerName}) succeeded.`);
      return res;
    } catch (err) {
      console.warn(
        `[LLM Fallback] LLM [${i + 1}/${chain.length}] (${providerName}) failed: ${err.message}`
      );
      lastError = err;
    }
  }

  throw new Error(`[LLM Fallback] All LLMs in the chain failed. Last error: ${lastError.message}`);
}

async function getSupportedModels(preferredModel) {
  const chain = parseChainFromEnv();
  if (chain && chain.length > 0) {
    try {
      const adapter = registry.getAdapter('llm', chain[0].provider.toLowerCase());
      return await adapter.getSupportedModels(preferredModel);
    } catch {
      // Fallback
    }
  }
  return [];
}

function ensureInitialized(_apiKey) {
  // Dispatcher is stateless and initialized dynamically per request
}

module.exports = {
  generateStructuredData,
  getSupportedModels,
  ensureInitialized,
};
