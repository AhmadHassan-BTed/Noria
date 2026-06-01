'use strict';

const { BaseScraper } = require('../base');
const { config: appConfig } = require('../../config');
const { metrics } = require('../../utils/metrics');

class JinaScraper extends BaseScraper {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || appConfig.get('JINA_API_KEY');
    this.timeout = config.timeout || 15000;
  }

  async scrape(url, options = {}) {
    console.log(`[JinaScraper] Fetching markdown from Jina Reader for: ${url}`);
    metrics.recordScraperAttempt();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);

    try {
      const headers = {
        Accept: 'text/plain',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
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
}

module.exports = { JinaScraper };
