'use strict';

class BaseProvider {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  getAnalyzer() {
    throw new Error(`${this.name}#getAnalyzer() not implemented`);
  }

  getNotifier() {
    throw new Error(`${this.name}#getNotifier() not implemented`);
  }

  getSchema() {
    throw new Error(`${this.name}#getSchema() not implemented`);
  }

  getConfig() {
    return this.config;
  }

  getMetadata() {
    return {
      name: this.name,
      description: 'No description',
      version: '1.0.0',
      author: 'Unknown',
    };
  }
}

module.exports = { BaseProvider };
