'use strict';

require('dotenv').config();

const os = require('os');

class Config {
  constructor() {
    this.env = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      JINA_API_KEY: process.env.JINA_API_KEY,
      NOTIFICATION_TARGET: process.env.NOTIFICATION_TARGET,

      APPLICANT_NAME: process.env.APPLICANT_NAME || 'Jane Doe',
      APPLICANT_NATIONALITY: process.env.APPLICANT_NATIONALITY || 'Pakistan',
      APPLICANT_DEGREE_TIER: process.env.APPLICANT_DEGREE_TIER || 'MS Computer Science',
      APPLICANT_TARGET_FIELDS: process.env.APPLICANT_TARGET_FIELDS || 'Computer Science',
      APPLICANT_RESEARCH_FOCUS: process.env.APPLICANT_RESEARCH_FOCUS || 'AI/ML',

      MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),
      RETRY_BACKOFF_MS: parseInt(process.env.RETRY_BACKOFF_MS || '1000'),
      CACHE_MAX_SIZE: parseInt(process.env.CACHE_MAX_SIZE || '500'),
      CACHE_TTL_MS: parseInt(process.env.CACHE_TTL_MS || '86400000'),
      HEALTH_CHECK_INTERVAL_MS: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000'),
      QUEUE_SCAN_INTERVAL_MS: parseInt(process.env.QUEUE_SCAN_INTERVAL_MS || '300000'),
      ENABLE_QUEUE_RETRY: process.env.ENABLE_QUEUE_RETRY !== 'false',

      ACTIVE_PIPELINES: (process.env.ACTIVE_PIPELINES || 'scholarships').split(',').map(p => p.trim()),
    };

    this.system = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: (os.totalmem() / 1024 ** 3).toFixed(1),
    };
  }

  get(key, defaultValue = undefined) {
    return this.env[key] ?? defaultValue;
  }

  getAll() {
    return { ...this.env };
  }

  getSystem() {
    return { ...this.system };
  }

  validate() {
    const errors = [];

    if (!this.env.GEMINI_API_KEY) {
      errors.push('GEMINI_API_KEY is required');
    }

    if (!this.env.NOTIFICATION_TARGET) {
      errors.push('NOTIFICATION_TARGET is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
}

const config = new Config();

module.exports = { Config, config };
