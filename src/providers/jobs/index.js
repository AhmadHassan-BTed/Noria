'use strict';

const { BaseProvider } = require('../base');
const { JobAnalyzer } = require('./analyzer');
const { JobNotifier } = require('./notifier');
const { JOB_RESPONSE_SCHEMA } = require('./schema');
const config = require('./config');

class JobsProvider extends BaseProvider {
  constructor(providerConfig = {}) {
    super(providerConfig);
    this.analyzer = new JobAnalyzer();
    this.analyzer.setProvider(this);
    this.notifier = new JobNotifier();
    this.notifier.setProvider(this);
  }

  getAnalyzer() {
    return this.analyzer;
  }

  getNotifier() {
    return this.notifier;
  }

  getSchema() {
    return JOB_RESPONSE_SCHEMA;
  }

  getConfig() {
    return config;
  }

  getMetadata() {
    return {
      name: 'jobs',
      displayName: 'Job Opportunities',
      description: 'Evaluates and notifies for matching developer job opportunities',
      version: '1.0.0',
      author: 'Noria',
    };
  }
}

module.exports = { JobsProvider };
