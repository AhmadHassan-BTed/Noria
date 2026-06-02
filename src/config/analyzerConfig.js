'use strict';

const SYSTEM_INSTRUCTION = `
CRITICAL PENALTIES & HARD FILTERS:
- If the degree program's academic discipline is fundamentally unrelated to the applicant's target fields (\${process.env.APPLICANT_TARGET_FIELDS || 'Computer Science, AI, Software Engineering'}), immediately force the total match_score to 0. Do not allow funding, location, or language metrics to compensate for an incompatible degree discipline (e.g., Global Affairs, Arts, Humanities).
`.trim();

module.exports = {
  SYSTEM_INSTRUCTION,
};
