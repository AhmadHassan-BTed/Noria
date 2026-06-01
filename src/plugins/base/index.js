'use strict';

class BaseListener {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  async initialize() {
    throw new Error(`${this.name}#initialize() not implemented`);
  }

  async send(target, message) {
    throw new Error(`${this.name}#send() not implemented`);
  }

  on(eventName, callback) {
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

  async scrape(url, options = {}) {
    throw new Error(`${this.name}#scrape() not implemented`);
  }
}

class BaseAnalyzer {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  async analyze(content, context = {}) {
    throw new Error(`${this.name}#analyze() not implemented`);
  }
}

class BaseNotifier {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  format(data) {
    throw new Error(`${this.name}#format() not implemented`);
  }
}

module.exports = {
  BaseListener,
  BaseScraper,
  BaseAnalyzer,
  BaseNotifier,
};
