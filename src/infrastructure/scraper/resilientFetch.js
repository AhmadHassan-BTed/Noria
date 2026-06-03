'use strict';

/**
 * Infrastructure — Resilient Fetch Scraper
 *
 * Stateless last-resort scraper using native fetch().
 * Extracted from the inline recovery logic in the old pipeline.js.
 */

/**
 * Scrapes a URL using native fetch with HTML-to-text cleaning.
 *
 * @param {string} url - URL to scrape
 * @returns {Promise<{url: string, text: string}>}
 */
async function scrape(url) {
  const fetchRes = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!fetchRes.ok) {
    throw new Error(`Resilient Fetch returned status ${fetchRes.status}`);
  }

  const rawHtml = await fetchRes.text();

  // Clean HTML → plain text
  let textContent = rawHtml;
  textContent = textContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  textContent = textContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  textContent = textContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ');
  textContent = textContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ');
  textContent = textContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ');
  textContent = textContent.replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<br\s*\/?>/gi, '\n');
  textContent = textContent.replace(/<[^>]+>/g, ' ');
  textContent = textContent
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');
  textContent = textContent.replace(/[ \t]+/g, ' ');
  textContent = textContent.replace(/\n\s*\n+/g, '\n\n').trim();

  if (!textContent) {
    throw new Error('Resilient Fetch extracted empty content.');
  }

  return { url, text: textContent };
}

module.exports = { scrape };
