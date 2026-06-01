'use strict';

const EventTypes = {
  LISTENER: {
    INITIALIZED: 'listener:initialized',
    ERROR: 'listener:error',
    SEND: 'listener:send',
  },

  SCRAPER: {
    START: 'scraper:start',
    SUCCESS: 'scraper:success',
    FAILED: 'scraper:failed',
  },

  ANALYZER: {
    START: 'analyzer:start',
    MATCH_FOUND: 'analyzer:match_found',
    NO_MATCH: 'analyzer:no_match',
    FAILED: 'analyzer:failed',
  },

  NOTIFIER: {
    FORMAT: 'notifier:format',
    SEND: 'notifier:send',
  },

  SYSTEM: {
    BOOTED: 'system:booted',
    ERROR: 'system:error',
  },
};

class Event {
  constructor(type, provider, payload = {}, metadata = {}) {
    this.type = type;
    this.provider = provider;
    this.payload = payload;
    this.metadata = {
      timestamp: Date.now(),
      ...metadata,
    };
  }

  toJSON() {
    return {
      type: this.type,
      provider: this.provider,
      payload: this.payload,
      metadata: this.metadata,
    };
  }
}

module.exports = { EventTypes, Event };
