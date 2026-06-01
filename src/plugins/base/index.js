'use strict';

class BaseListener {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  async initialize() {
    throw new Error(`${this.name}#initialize() not implemented`);
  }

  async send(_target, _message) {
    throw new Error(`${this.name}#send() not implemented`);
  }

  on(_eventName, _callback) {
    throw new Error(`${this.name}#on() not implemented`);
  }

  async close() {
    console.log(`[${this.name}] Closing listener`);
  }
}

class BaseScraper {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  async scrape(url, _options = {}) {
    throw new Error(`${this.name}#scrape() not implemented`);
  }
}

class BaseAnalyzer {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  async analyze(content, _context = {}) {
    throw new Error(`${this.name}#analyze() not implemented`);
  }
}

class BaseNotifier {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  format(_data) {
    throw new Error(`${this.name}#format() not implemented`);
  }
}

module.exports = {
  BaseListener,
  BaseScraper,
  BaseAnalyzer,
  BaseNotifier,
};
