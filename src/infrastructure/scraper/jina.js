'use strict';

/**
 * Infrastructure — Jina Scraper Adapter
 *
 * Stateless function for scraping URLs via Jina Reader API.
 * NO class. NO inheritance. NO BaseScraper.
 */

const { config: appConfig } = require('../../config');
const { metrics } = require('../../utils/metrics');

/**
 * Scrapes a URL using the Jina Reader API.
 *
 * @param {string} url - URL to scrape
 * @param {object} [options]
 * @param {string} [options.apiKey]   - Override Jina API key
 * @param {number} [options.timeout]  - Request timeout in ms (default 15000)
 * @returns {Promise<{url: string, text: string}>}
 */
async function scrape(url, options = {}) {
  const apiKey = options.apiKey || appConfig.get('JINA_API_KEY');
  const timeout = options.timeout || 15000;

  console.log(`[JinaScraper] Fetching markdown from Jina Reader for: ${url}`);
  metrics.recordScraperAttempt();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers = { Accept: 'text/plain' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`https://r.jina.ai/${url}`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Jina Reader returned status ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    metrics.recordScraperSuccess();
    return { url, text };
  } catch (err) {
    clearTimeout(timeoutId);
    metrics.recordScraperFailure();
    console.error(`[JinaScraper] Fetching failed for ${url}:`, err.message);
    throw err;
  }
}

module.exports = { scrape };
