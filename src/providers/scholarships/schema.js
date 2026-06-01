'use strict';

const { SchemaType } = require('@google/generative-ai');

const SCHOLARSHIP_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    match_score: {
      type: SchemaType.INTEGER,
      description: 'Overall alignment score from 0 to 100.',
    },
    uni_country: {
      type: SchemaType.STRING,
      description: "Format: 'University Name, Country'. Mark 'Unknown' if missing.",
    },
    scholarship_name: {
      type: SchemaType.STRING,
      description: 'Official name of the grant, funding body, or scholarship.',
    },
    program_name: {
      type: SchemaType.STRING,
      description: 'Degree or program title (e.g., MS Computer Science).',
    },
    deadline: {
      type: SchemaType.STRING,
      description: 'Final submission date in DD-MMM-YYYY format or "Unknown".',
    },
    fully_funded: {
      type: SchemaType.BOOLEAN,
      description: 'True if tuition + living stipend completely covered.',
    },
    block_account: {
      type: SchemaType.STRING,
      description: "'Required', 'Waived by stipend/grant', or 'Unknown'.",
    },
    english_taught: {
      type: SchemaType.BOOLEAN,
      description: 'True if medium of instruction is entirely English.',
    },
    ielts_score: {
      type: SchemaType.STRING,
      description: "Minimum required band score (e.g., '6.5') or 'Not required'.",
    },
    post_study_visa: {
      type: SchemaType.BOOLEAN,
      description: 'True if country permits post-study job-seeker visa.',
    },
    research_alignment: {
      type: SchemaType.STRING,
      description: 'Contextual relationship to your field. Max 4 words.',
    },
    verdict: {
      type: SchemaType.STRING,
      description: 'Summary justifying score allocation.',
    },
    apply_link: {
      type: SchemaType.STRING,
      description: 'Direct URL to application portal or "Not found".',
    },
    official_link: {
      type: SchemaType.STRING,
      description: 'Official program page URL or "Not found".',
    },
  },
  required: [
    'match_score', 'uni_country', 'scholarship_name', 'program_name',
    'deadline', 'fully_funded', 'english_taught', 'post_study_visa',
    'verdict', 'apply_link', 'official_link',
  ],
};

module.exports = { SCHOLARSHIP_RESPONSE_SCHEMA };
