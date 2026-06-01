'use strict';

const EVENTS = require('../../config/constants/events');
const { urlCache } = require('../../utils/cache');

function initDeduplicator(broker) {
  const originalEmit = broker.emit.bind(broker);

  broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, (url) => {
    if (urlCache.has(url)) {
      console.log(`[Deduplicator] URL already processed recently, skipping: ${url}`);
      return;
    }

    originalEmit(EVENTS.SCRAPER.START, url);
  });

  broker.on(EVENTS.SCRAPER.SUCCESS, ({ url, text }) => {
    urlCache.set(url, { text, timestamp: Date.now() });
    console.log(`[Deduplicator] Cached URL (${urlCache.size()} in cache): ${url}`);
  });

  console.log('[Deduplicator] URL deduplication middleware initialized.');
}

module.exports = { initDeduplicator };
