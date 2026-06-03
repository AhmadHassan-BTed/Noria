'use strict';

/**
 * Scholarship Domain Manifest
 *
 * Exports the complete domain interface as a plain object.
 * Every export is either a pure function or a static data structure.
 * NO classes. NO inheritance. NO external service dependencies.
 */

const { buildPrompt, resolveProfile } = require('./promptBuilder');
const { buildTemplate } = require('./templateBuilder');
const { SCHOLARSHIP_RESPONSE_SCHEMA } = require('./schema');
const { SCHOLARSHIP_CRITERIA, SCHOLARSHIP_PENALTIES } = require('./config');

module.exports = {
  // Pure functions
  buildPrompt,
  resolveProfile,
  buildTemplate,

  // Static data
  schema: SCHOLARSHIP_RESPONSE_SCHEMA,
  criteria: SCHOLARSHIP_CRITERIA,
  penalties: SCHOLARSHIP_PENALTIES,

  // Domain metadata
  metadata: {
    name: 'scholarships',
    displayName: 'Scholarship Opportunities',
    description: 'Evaluates and notifies for matching scholarship opportunities',
    version: '1.0.0',
    author: 'Noria',
  },
};
