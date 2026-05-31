'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const EVENTS = require('../../config/constants/events');

puppeteer.use(StealthPlugin());

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'stylesheet', 'font', 'media']);
const BROWSER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process',
  '--ignore-certificate-errors', '--disable-blink-features=AutomationControlled',
  `--window-position=${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 100)}`,
];

const NAVIGATION_TIMEOUT_MS = 45_000;
const MIN_CONTENT_LENGTH = 200;

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 150 + Math.floor(Math.random() * 50);
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= window.innerHeight * 1.5 || totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollBy(0, -300);
          resolve();
        }
      }, 100 + Math.floor(Math.random() * 50));
    });
  });
}

/**
 * FAST PATH: Jina AI Reader
 */
async function fetchWithJina(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers = {
    'X-Return-Format': 'text' // Ask Jina for clean text, not HTML
  };
  
  if (process.env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
  }

  const response = await fetch(jinaUrl, { headers });
  
  if (!response.ok) {
    throw new Error(`Jina API rejected request with status: ${response.status}`);
  }

  const text = await response.text();
  if (text.length < MIN_CONTENT_LENGTH) {
    throw new Error(`Jina returned insufficient content (${text.length} chars). Likely blocked.`);
  }

  return text;
}

function initPuppeteerScraper(broker) {
  broker.on(EVENTS.SCRAPER.START, async (url) => {
    console.log(`[Scraper]   Scrape started → ${url}`);

    // ==========================================
    // LAYER 1: THE FAST PATH (JINA AI)
    // ==========================================
    try {
      console.log(`[Scraper]  ⚡ Attempting Fast-Path extraction via Jina AI...`);
      const jinaText = await fetchWithJina(url);
      
      console.log(`[Scraper]  ✅ JINA SUCCESS: Extracted ${jinaText.length.toLocaleString()} characters.`);
      broker.emit(EVENTS.SCRAPER.SUCCESS, { url, text: jinaText });
      return; // EXIT EARLY! We don't need Chrome.

    } catch (jinaError) {
      console.warn(`[Scraper]  ⚠️ Jina Fast-Path failed: ${jinaError.message}`);
      console.log(`[Scraper]  🛡️ Deploying Heavy Artillery (Puppeteer Stealth)...`);
    }

    // ==========================================
    // LAYER 2: THE SLOW PATH (PUPPETEER)
    // ==========================================
    let browser = null;
    try {
      browser = await puppeteer.launch({ headless: true, args: BROWSER_ARGS });
      const page = await browser.newPage();

      await page.setViewport({
        width: 1366 + Math.floor(Math.random() * 500),
        height: 768 + Math.floor(Math.random() * 300),
      });

      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) req.abort();
        else req.continue();
      });

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
      } catch (navErr) {
        console.warn(`[Scraper]  ⚠️ Navigation timeout, attempting extraction anyway...`);
      }

      const pageTitle = await page.title();
      if (pageTitle.includes('Just a moment') || pageTitle.includes('Attention Required')) {
        await new Promise(r => setTimeout(r, 8000));
      }

      await autoScroll(page);

      const text = await page.evaluate((minLen) => {
        const strictSelectors = ['article', '.post-content', '.entry-content', 'main'];
        for (let selector of strictSelectors) {
          const el = document.querySelector(selector);
          if (el && el.innerText.length >= minLen) return el.innerText;
        }

        const blocks = document.querySelectorAll('div, section');
        let bestBlock = '';
        let highestScore = 0;

        blocks.forEach(block => {
          const rawText = block.innerText || '';
          if (rawText.length < minLen) return;
          const links = block.querySelectorAll('a');
          let linkTextLength = 0;
          links.forEach(l => linkTextLength += (l.innerText || '').length);
          
          const textRatio = rawText.length - (linkTextLength * 2);
          if (textRatio > highestScore) {
            highestScore = textRatio;
            bestBlock = rawText;
          }
        });

        if (bestBlock.length >= minLen) return bestBlock;
        return document.body.innerText || '';
      }, MIN_CONTENT_LENGTH);

      if (!text || text.trim().length < MIN_CONTENT_LENGTH) {
        throw new Error(`Extracted text too short. Blocked by advanced CAPTCHA.`);
      }

      console.log(`[Scraper]  ✅ PUPPETEER SUCCESS: Extracted ${text.length.toLocaleString()} characters.`);
      broker.emit(EVENTS.SCRAPER.SUCCESS, { url, text });

    } catch (err) {
      console.error(`[Scraper]  ❌ ALL LAYERS FAILED for ${url} →`, err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'HybridScraper',
        url,
        message: err.message,
      });

    } finally {
      if (browser !== null) {
        await browser.close();
        console.log('[Scraper]  Browser instance closed cleanly.');
      }
    }
  });

  console.log('[Scraper]  Hybrid scraper (Jina + Puppeteer) initialized and listening.');
}

module.exports = { initPuppeteerScraper };