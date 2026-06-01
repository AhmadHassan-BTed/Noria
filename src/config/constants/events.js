'use strict';

function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach((key) => {
    const value = obj[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

const EVENTS = deepFreeze({

  SYSTEM: {
    BOOTED: 'system.booted',
    ERROR: 'system.error',
  },

  WHATSAPP: {
    READY: 'whatsapp.ready',
    MESSAGE_RECEIVED: 'whatsapp.message_received',
    LINK_EXTRACTED: 'whatsapp.link_extracted',
  },

  SCRAPER: {
    START: 'scraper.start',
    SUCCESS: 'scraper.success',
    FAILED: 'scraper.failed',
  },

  ANALYZER: {
    MATCH_FOUND: 'analyzer.match_found',
    NO_MATCH: 'analyzer.no_match',
  },

  NOTIFIER: {
    SEND: 'notifier.send',
  },
});

module.exports = EVENTS;