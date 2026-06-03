'use strict';

/**
 * Infrastructure — Puppeteer Scraper Adapter
 *
 * Stateless function for scraping URLs via headless Puppeteer.
 * NO class. NO inheritance. NO BaseScraper.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { metrics } = require('../../utils/metrics');

// Use stealth plugin to avoid blockades
puppeteer.use(StealthPlugin());

/**
 * Scrapes a URL using headless Puppeteer with stealth mode.
 *
 * @param {string} url - URL to scrape
 * @param {object} [options]
 * @param {number} [options.timeout] - Navigation timeout in ms (default 30000)
 * @returns {Promise<{url: string, text: string}>}
 */
async function scrape(url, options = {}) {
  const timeout = options.timeout || 30000;

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
      timeout,
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

module.exports = { scrape };
