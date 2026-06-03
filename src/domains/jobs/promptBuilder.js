'use strict';

/**
 * Jobs Domain — Prompt Builder
 *
 * Pure functions for resolving applicant profiles and building LLM prompts.
 * ZERO external dependencies — all data flows in as arguments.
 */

/**
 * Resolves the applicant profile from raw application config values.
 *
 * @param {object} appConfig - Plain key-value object (from config.getAll())
 * @returns {object} Applicant profile (no defaults — uses raw config values)
 */
function resolveProfile(appConfig) {
  return {
    name: appConfig.APPLICANT_NAME,
    nationality: appConfig.APPLICANT_NATIONALITY,
    degreeTier: appConfig.APPLICANT_DEGREE_TIER,
    targetFields: appConfig.APPLICANT_TARGET_FIELDS,
    researchFocus: appConfig.APPLICANT_RESEARCH_FOCUS,
  };
}

/**
 * Builds the LLM analysis prompt for job opportunity evaluation.
 *
 * @param {string} text - Scraped web page content
 * @param {object} applicantProfile - Resolved applicant profile
 * @param {string} [messageText] - Optional context from incoming WhatsApp message
 * @returns {string} Complete prompt string for the LLM
 */
function buildPrompt(text, applicantProfile, messageText) {
  let prompt = `
You are an advanced recruitment scoring engine for evaluating Job opportunities.
Evaluate raw web content against the applicant profile and generate a score from 0-100.

════════════════════════════════════════════
APPLICANT PROFILE
════════════════════════════════════════════
Name           : ${applicantProfile.name}
Nationality    : ${applicantProfile.nationality}
Academic tier  : ${applicantProfile.degreeTier}
Target fields  : ${applicantProfile.targetFields}
Research focus : ${applicantProfile.researchFocus}

════════════════════════════════════════════
SCORING CRITERIA (0-100 PTS)
════════════════════════════════════════════
+30 pts : Remote work allowed (Fully Remote: 30, Hybrid/Office-only: 15).
+20 pts : Relocation or visa sponsorship explicitly supported.
+20 pts : Direct match with target fields (${applicantProfile.targetFields}) or technology stack.
+15 pts : Targeted towards entry/junior or mid-level developers (rather than executive/lead).
+15 pts : Competitive compensation or salary range stated.

CRITICAL PENALTIES:
- Requires local work authorization without sponsorship support → force score to 0
- Requires >5 years of experience (Senior/Lead/Architect only) → force score to 20 maximum
`;

  if (messageText) {
    prompt += `
════════════════════════════════════════════
WHATSAPP MESSAGE CONTEXT
════════════════════════════════════════════
${messageText}
`;
  }

  prompt += `
════════════════════════════════════════════
PAGE CONTENT
════════════════════════════════════════════
${text}
`;

  return prompt.trim();
}

module.exports = { buildPrompt, resolveProfile };
