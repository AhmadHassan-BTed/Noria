'use strict';

/**
 * Jobs Domain Manifest
 *
 * Exports the complete domain interface as a plain object.
 * Every export is either a pure function or a static data structure.
 * NO classes. NO inheritance. NO external service dependencies.
 */

const { buildPrompt, resolveProfile } = require('./promptBuilder');
const { buildTemplate } = require('./templateBuilder');
const { JOB_RESPONSE_SCHEMA } = require('./schema');
const { JOB_CRITERIA, JOB_PENALTIES } = require('./config');

module.exports = {
  // Pure functions
  buildPrompt,
  resolveProfile,
  buildTemplate,

  // Static data
  schema: JOB_RESPONSE_SCHEMA,
  criteria: JOB_CRITERIA,
  penalties: JOB_PENALTIES,

  // Domain metadata
  metadata: {
    name: 'jobs',
    displayName: 'Job Opportunities',
    description: 'Evaluates and notifies for matching developer job opportunities',
    version: '1.0.0',
    author: 'Noria',
  },
};
