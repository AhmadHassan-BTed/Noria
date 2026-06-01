'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { BaseScraper } = require('../base');
const { metrics } = require('../../utils/metrics');

// Use stealth plugin to avoid blockades
puppeteer.use(StealthPlugin());

class PuppeteerScraper extends BaseScraper {
  constructor(config = {}) {
    super(config);
    this.timeout = config.timeout || 30000;
  }

  async scrape(url, options = {}) {
    console.log(`[PuppeteerScraper] Scraping URL: ${url}`);
    metrics.recordScraperAttempt();

    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: options.timeout || this.timeout,
      });

      // Extract text content from body
      const text = await page.evaluate(() => {
        /* global document */
        // Remove script, style, and navigation elements to clean the text
        const elementsToRemove = document.querySelectorAll(
          'script, style, nav, footer, iframe, noscript'
        );
        elementsToRemove.forEach((el) => el.remove());
        return document.body.innerText || document.body.textContent || '';
      });

      metrics.recordScraperSuccess();
      return { url, text };
    } catch (err) {
      metrics.recordScraperFailure();
      console.error(`[PuppeteerScraper] Scraping failed for ${url}:`, err.message);
      throw err;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

module.exports = { PuppeteerScraper };
