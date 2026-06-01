'use strict';

const { BaseProvider } = require('../base');
const { ScholarshipAnalyzer } = require('./analyzer');
const { ScholarshipNotifier } = require('./notifier');
const { SCHOLARSHIP_RESPONSE_SCHEMA } = require('./schema');
const config = require('./config');

class ScholarshipsProvider extends BaseProvider {
  constructor(providerConfig = {}) {
    super(providerConfig);
    this.analyzer = new ScholarshipAnalyzer();
    this.notifier = new ScholarshipNotifier();
  }

  getAnalyzer() {
    return this.analyzer;
  }

  getNotifier() {
    return this.notifier;
  }

  getSchema() {
    return SCHOLARSHIP_RESPONSE_SCHEMA;
  }

  getConfig() {
    return config;
  }

  getMetadata() {
    return {
      name: 'scholarships',
      displayName: 'Scholarship Opportunities',
      description: 'Evaluates and notifies for matching scholarship opportunities',
      version: '1.0.0',
      author: 'Noria',
    };
  }
}

module.exports = { ScholarshipsProvider };
