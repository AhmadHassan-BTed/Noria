'use strict';
const { SchemaType } = require('@google/generative-ai');

const SCHOLARSHIP_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    match_score: {
      type: SchemaType.INTEGER,
      description: 'Overall mathematical alignment score from 0 to 100 based on the rubric.',
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
      description: 'Degree or program title (e.g., M.Sc. Software Engineering).',
    },
    program_format: {
      type: SchemaType.STRING,
      description:
        'Must evaluate to exactly one of these: "Research/Thesis-based", "Coursework-based", or "Unknown".',
    },
    deadline: {
      type: SchemaType.STRING,
      description: 'Final submission date in DD-MMM-YYYY format or "Unknown".',
    },
    pakistan_eligible: {
      type: SchemaType.BOOLEAN,
      description:
        'True if Pakistani citizens are explicitly eligible or included in the international applicant pool.',
    },
    application_fee: {
      type: SchemaType.STRING,
      description: 'Amount in local currency, "None", "Waived", or "Unknown".',
    },
    test_requirements: {
      type: SchemaType.STRING,
      description: 'Language requirements (e.g., "IELTS 6.5 Required", "Not required", "Unknown").',
    },
    cgpa_requirement: {
      type: SchemaType.STRING,
      description: 'Minimum required CGPA out of a 4.0 scale (e.g., "Min 3.0", "None specified").',
    },
    work_experience: {
      type: SchemaType.STRING,
      description: 'Required professional post-grad experience (e.g., "2 Yrs Required", "None").',
    },
    fully_funded: {
      type: SchemaType.BOOLEAN,
      description: 'True if tuition + living stipend are completely covered.',
    },
    block_account: {
      type: SchemaType.STRING,
      description: "'Required', 'Waived by stipend/grant', 'Not Applicable', or 'Unknown'.",
    },
    spouse_allowance: {
      type: SchemaType.BOOLEAN,
      description:
        'True if the grant explicitly provides allowances, stipends, or visa support for spouses/dependents.',
    },
    english_taught: {
      type: SchemaType.BOOLEAN,
      description: 'True if medium of instruction is entirely English.',
    },
    post_study_visa: {
      type: SchemaType.BOOLEAN,
      description: 'True if host country permits post-study work / job-seeker visas.',
    },
    verdict: {
      type: SchemaType.STRING,
      description: 'One-sentence crisp summary justifying the score allocation.',
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
    'match_score',
    'uni_country',
    'scholarship_name',
    'program_name',
    'program_format',
    'deadline',
    'pakistan_eligible',
    'application_fee',
    'test_requirements',
    'cgpa_requirement',
    'work_experience',
    'fully_funded',
    'block_account',
    'spouse_allowance',
    'english_taught',
    'post_study_visa',
    'verdict',
    'apply_link',
    'official_link',
  ],
};

module.exports = { SCHOLARSHIP_RESPONSE_SCHEMA };
