'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const EVENTS = require('../../config/constants/events');

// ---------------------------------------------------------------------------
// Register the stealth plugin ONCE at module load time — not inside the
// handler — so that the plugin patches are applied to every launch call.
// The stealth plugin spoofs >20 browser fingerprint signals (webdriver flag,
// navigator.plugins, canvas fingerprint, etc.) to avoid bot detection.
// ---------------------------------------------------------------------------
puppeteer.use(StealthPlugin());

// Resource types we don't need for text extraction.
// Blocking them saves significant bandwidth and memory (images alone can
// account for 60–80 % of a page's payload weight).
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'stylesheet', 'font', 'media']);

// Chromium launch flags tuned for a headless server environment.
// --single-process is aggressive but cuts ~50 MB RAM on memory-constrained hosts;
// remove it if you observe instability on high-core machines.
const BROWSER_ARGS = [
  '--no-sandbox',              // Required on Linux / Docker (no SUID sandbox)
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',   // Write /tmp instead of /dev/shm to avoid OOM
  '--disable-gpu',             // No GPU in headless mode
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--no-zygote',               // Skips the zygote process; saves ~20 MB RAM
  '--single-process',          // Run renderer in the main process; see note above
];

// Abort scraping if navigation hasn't completed within this window (ms)
const NAVIGATION_TIMEOUT_MS = 30_000;

// Reject pages with fewer characters — likely a bot-detection wall or empty shell
const MIN_CONTENT_LENGTH = 100;

/**
 * Initializes the Puppeteer scraper service and binds it to the central broker.
 *
 * INBOUND   (Broker → Scraper)
 *   • EVENTS.SCRAPER.START  →  launches a stealth browser, navigates to URL,
 *                               blocks junk resources, extracts visible text
 *
 * OUTBOUND  (Scraper → Broker)
 *   • EVENTS.SCRAPER.SUCCESS → { url: string, text: string }
 *   • EVENTS.SYSTEM.ERROR    → on any failure (navigation, extraction, etc.)
 *
 * ZOMBIE PROCESS SAFETY:
 *   `browser.close()` is called inside a `finally` block so it runs even when
 *   an exception is thrown mid-scrape — preventing orphaned Chromium processes.
 *
 * @param {import('events').EventEmitter} broker - The central event bus.
 */
function initPuppeteerScraper(broker) {

  broker.on(EVENTS.SCRAPER.START, async (url) => {
    // `browser` is declared here so the `finally` block can always reach it,
    // even if the error was thrown before `browser.newPage()` was called.
    let browser = null;

    console.log(`[Scraper]   Scrape started → ${url}`);

    try {
      // -----------------------------------------------------------------
      // 1. Launch browser
      // -----------------------------------------------------------------
      browser = await puppeteer.launch({
        headless: true, // true = new headless mode in Puppeteer ≥ v22
        args: BROWSER_ARGS,
      });

      const page = await browser.newPage();

      // -----------------------------------------------------------------
      // 2. Block unnecessary resources BEFORE navigation begins.
      //    setRequestInterception(true) MUST be called before goto().
      // -----------------------------------------------------------------
      await page.setRequestInterception(true);

      page.on('request', (req) => {
        if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) {
          req.abort();   // Drop the request entirely — no network round-trip
        } else {
          req.continue(); // Allow HTML, scripts, XHR, fetch, etc.
        }
      });

      // Set a realistic desktop UA to blend in with organic browser traffic
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/125.0.0.0 Safari/537.36',
      );

      // -----------------------------------------------------------------
      // 3. Navigate — 'networkidle2' waits until ≤2 in-flight connections
      //    for 500 ms, which is a reliable signal that dynamic content
      //    (e.g. scholarship deadline tables) has finished loading.
      // -----------------------------------------------------------------
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: NAVIGATION_TIMEOUT_MS,
      });

      // -----------------------------------------------------------------
      // 4. Extract visible text.
      //    Priority: <main> → <article> → <body>
      //    This prefers semantically scoped content (the article body) over
      //    the full page (which includes nav, footer, cookie banners, etc.)
      // -----------------------------------------------------------------
      const text = await page.evaluate(() => {
        const SELECTOR_PRIORITY = ['main', 'article', 'body'];

        for (const selector of SELECTOR_PRIORITY) {
          const el = document.querySelector(selector);
          if (el) {
            // `innerText` respects CSS visibility and omits hidden nodes,
            // producing cleaner output than raw `textContent`.
            const content = el.innerText || el.textContent || '';
            if (content.trim().length > 0) return content;
          }
        }

        // Last resort: the entire document body as plain text
        return document.documentElement.innerText || '';
      });

      // Sanity-check: a very short result usually means a bot-block page
      // (e.g., Cloudflare challenge, login wall, or JavaScript-only SPA that
      // didn't render in time).
      if (!text || text.trim().length < MIN_CONTENT_LENGTH) {
        throw new Error(
          `Extracted content is suspiciously short (${text?.trim().length ?? 0} chars). ` +
          `Possible bot-detection wall or failed render at: ${url}`,
        );
      }

      console.log(
        `[Scraper]  Extracted ${text.length.toLocaleString()} characters from ${url}`,
      );

      // Hand the raw text off to the Analyzer via the broker
      broker.emit(EVENTS.SCRAPER.SUCCESS, { url, text });

    } catch (err) {
      console.error(`[Scraper]  Scrape failed for ${url} →`, err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'PuppeteerScraper',
        url,
        message: err.message,
        stack: err.stack,
      });

    } finally {
      // -----------------------------------------------------------------
      // CRITICAL: Always close the browser.
      // Without this, every failed/successful scrape spawns a zombie
      // Chromium process that silently consumes RAM until the host OOMs.
      // -----------------------------------------------------------------
      if (browser !== null) {
        await browser.close();
        console.log('[Scraper]  Browser instance closed cleanly.');
      }
    }
  });

  console.log('[Scraper]  Puppeteer scraper service initialized and listening.');
}

module.exports = { initPuppeteerScraper };