'use strict';

const { SchemaType } = require('@google/generative-ai');

const JOB_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    match_score: {
      type: SchemaType.INTEGER,
      description: 'Overall alignment score from 0 to 100.',
    },
    job_title: {
      type: SchemaType.STRING,
      description: 'Official title of the position (e.g. Software Engineer).',
    },
    company_name: {
      type: SchemaType.STRING,
      description: 'Name of the hiring organization.',
    },
    location: {
      type: SchemaType.STRING,
      description: "Format: 'City, Country' or 'Remote'. Mark 'Unknown' if missing.",
    },
    salary_range: {
      type: SchemaType.STRING,
      description: 'Stated compensation package (e.g. $80k-$100k) or "Not specified".',
    },
    deadline: {
      type: SchemaType.STRING,
      description: 'Application deadline in DD-MMM-YYYY format or "Unknown".',
    },
    experience_level: {
      type: SchemaType.STRING,
      description: 'Target seniority level (e.g. Junior, Mid, Senior, Lead).',
    },
    skills_required: {
      type: SchemaType.STRING,
      description: 'Top required technologies or methodologies. Max 5 words.',
    },
    remote_option: {
      type: SchemaType.BOOLEAN,
      description: 'True if hybrid or fully remote work is allowed.',
    },
    visa_sponsorship: {
      type: SchemaType.BOOLEAN,
      description: 'True if visa support or relocation assistance is provided.',
    },
    verdict: {
      type: SchemaType.STRING,
      description: 'Summary justifying score allocation.',
    },
    apply_link: {
      type: SchemaType.STRING,
      description: 'Direct URL to application form or "Not found".',
    },
    official_link: {
      type: SchemaType.STRING,
      description: 'Official company careers page URL or "Not found".',
    },
  },
  required: [
    'match_score',
    'job_title',
    'company_name',
    'location',
    'salary_range',
    'deadline',
    'experience_level',
    'skills_required',
    'remote_option',
    'visa_sponsorship',
    'verdict',
    'apply_link',
    'official_link',
  ],
};

module.exports = { JOB_RESPONSE_SCHEMA };
