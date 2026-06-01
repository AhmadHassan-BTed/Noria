'use strict';

const { SchemaType } = require('@google/generative-ai');

const WEIGHTED_SCORING_RULES = {
  funding_tier:         { points: 30, detail: 'Fully funded (tuition + living stipend). Partial funding receives only +10.' },
  program_flexibility:  { points: 20, detail: 'MS, MSc, Postgraduate, or combined MS/PhD pathway. PhD-only with Bachelor\'s entry gets +15. Single-track PhD gets +10.' },
  field_alignment:      { points: 20, detail: 'Software Engineering, Computer Science, Intelligent Data Systems, or AI specializations.' },
  financial_logistics:  { points: 15, detail: 'Block account constraints do not apply or the scholarship explicitly waives the financial deposit block.' },
  language_barriers:    { points: 10, detail: 'Program is verified as English-taught with no external local language fluency components.' },
  career_runway:        { points:  5, detail: 'Country allows explicit post-study stay-back job search options.' },
  penalties: [
    { deduction: 'match_score forced to 0', condition: 'Citizens of the applicant\'s nationality are explicitly excluded from the eligibility matrix.' },
    { deduction: 'match_score forced to 0', condition: 'Program is exclusively an undergraduate/Bachelor\'s degree framework.' },
  ],
};

const SCHOLARSHIP_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    match_score: {
      type: SchemaType.INTEGER,
      description: 'Overall alignment score from 0 to 100 based on scoring engine rules.',
    },
    uni_country: {
      type: SchemaType.STRING,
      description: "Format: 'University Name, Country'. Mark 'Unknown' if completely missing.",
    },
    scholarship_name: {
      type: SchemaType.STRING,
      description: 'Official name of the grant, funding body, or scholarship fellowship.',
    },
    program_name: {
      type: SchemaType.STRING,
      description: 'Degree or program title (e.g., MS Computer Science, Combined MS/PhD track).',
    },
    deadline: {
      type: SchemaType.STRING,
      description: 'Final submission date in DD-MMM-YYYY format or "Unknown".',
    },
    fully_funded: {
      type: SchemaType.BOOLEAN,
      description: 'True if tuition fees plus a regular living stipend are completely covered.',
    },
    block_account: {
      type: SchemaType.STRING,
      description: "'Required', 'Waived by stipend/grant', or 'Unknown'.",
    },
    english_taught: {
      type: SchemaType.BOOLEAN,
      description: 'True if the medium of instruction is entirely English.',
    },
    ielts_score: {
      type: SchemaType.STRING,
      description: "Minimum required band score (e.g., '6.5') or 'Not required/Unknown'.",
    },
    post_study_visa: {
      type: SchemaType.BOOLEAN,
      description: 'True if the country naturally permits a post-study transition/job-seeker visa phase.',
    },
    research_alignment: {
      type: SchemaType.STRING,
      description: 'Contextual relationship to Software Engineering, AI, or Federated Learning. Max 4 words.',
    },
    verdict: {
      type: SchemaType.STRING,
      description: 'Telegram-style phrase summarizing score allocation justification.',
    },
    apply_link: {
      type: SchemaType.STRING,
      description: "Direct URL targeting the application registration portal if discovered in text, otherwise 'Not found'.",
    },
    official_link: {
      type: SchemaType.STRING,
      description: "Main official landing page or institutional guideline URL if discovered in text, otherwise 'Not found'.",
    },
  },
  required: [
    'match_score', 'uni_country', 'scholarship_name', 'program_name',
    'deadline', 'fully_funded', 'english_taught', 'post_study_visa',
    'verdict', 'apply_link', 'official_link',
  ],
};

function buildSystemInstruction() {
  const nationality = process.env.APPLICANT_NATIONALITY || 'Unknown';
  const name        = process.env.APPLICANT_NAME        || 'Unknown';
  const degree      = process.env.APPLICANT_DEGREE_TIER || 'Unknown';
  const fields      = process.env.APPLICANT_TARGET_FIELDS || 'Unknown';
  const research    = process.env.APPLICANT_RESEARCH_FOCUS || 'Unknown';

  return `
You are an advanced academic scoring engine running on telemetry.
Evaluate raw web content against the applicant profile and generate an integer score from 0 to 100.

════════════════════════════════════════════
APPLICANT PROFILE DATA
════════════════════════════════════════════
  Name           : ${name}
  Nationality    : ${nationality} (Hard constraint)
  Academic tier  : ${degree}
  Target fields  : ${fields}
  Research focus : ${research}
  Output format  : Compact, sparse telegram-style fragments. Absolutely omit helping verbs (is, are, the, was).

════════════════════════════════════════════
WEIGHTED SCORING MATRIX (0 - 100 PTS)
════════════════════════════════════════════
  Base score starts at 0. Evaluate text and dynamically add points up to the cap:
  
  +30 pts : Funding tier — Allocation for fully funded options (covers both tuition + stable living stipend). Partial funding receives only +10.
  +20 pts : Program flexibility — Maximum points if the track covers an MS, MSc, Postgraduate framework, or a combined MS/PhD pathway. If strictly a PhD track but accepts direct Bachelor's entry with an integrated master's exit, allocate +15. Strictly single-track PhD options with no master's baseline pathways receive +10.
  +20 pts : Field alignment — Target covers the applicant's fields: ${fields}.
  +15 pts : Financial logistics — Block account constraints do not apply, or the scholarship explicitly waives/bypasses the financial deposit block.
  +10 pts : Language barriers — Program is verified as English-taught, requiring no external local language fluency components.
  +5  pts : Career runway — Country allows explicit post-study stay-back job search options.

  CRITICAL PENALTIES & HARD FILTERS:
  - If ${nationality} citizens are explicitly excluded from the eligibility matrix, force total match_score to 0.
  - If the program is exclusively an undergraduate/Bachelor's degree framework, force total match_score to 0.

════════════════════════════════════════════
URL EXTRACTION RULES
════════════════════════════════════════════
  Locate and isolate hyperlinked paths from the parsed web content. 
  - Assign direct registration/portal endpoints to 'apply_link'.
  - Assign core homepage documentation or university overview paths to 'official_link'.
`.trim();
}

module.exports = {
  buildSystemInstruction,
  SCHOLARSHIP_RESPONSE_SCHEMA,
  WEIGHTED_SCORING_RULES,
};