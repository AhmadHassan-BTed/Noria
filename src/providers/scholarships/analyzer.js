'use strict';

const { BaseAnalyzer } = require('../../plugins/base');
const { config } = require('../../config');
const { SCHOLARSHIP_RESPONSE_SCHEMA } = require('./schema');

function buildScholarshipPrompt(text, applicantProfile, messageText) {
  return `
You are Noria's production-grade multi-objective evaluation engine for global postgraduate funding opportunities.
Analyze the provided web content and build a strict JSON response conforming to the schema.

════════════════════════════════════════════
APPLICANT TARGET PROFILE
════════════════════════════════════════════
Name           : ${applicantProfile.name}
Nationality    : ${applicantProfile.nationality} [CRITICAL HARD FILTER]
Academic Tier  : ${applicantProfile.degreeTier}
Target Fields  : ${applicantProfile.targetFields}
Research Focus : ${applicantProfile.researchFocus}

════════════════════════════════════════════
SCORING MATRIX & WEIGHT DISTRIBUTION (0-100 TOTAL)
════════════════════════════════════════════
1. CORE FIELD ALIGNMENT (Max 25 pts)
   * Full +25 pts: Software Engineering, Computer Science, AI, Distributed Computing, or Advanced Systems.
   * Partial +10 pts: Interdisciplinary data analytics or general management information systems.

2. FINANCIAL TIER (Max 25 pts)
   * Full +25 pts: Fully Funded (Tuition 100% covered + monthly living stipend).
   * Partial +10 pts: Tuition waiver only or stipend only.

3. PROGRAM ELEVATION (Max 20 pts)
   * Full +20 pts: MS / M.Sc. / Postgraduate degrees or combined MS/PhD tracks.
   * Partial +10 pts: Single-track PhD programs.

4. LOGISTICAL HURDLES (Max 15 pts) [Calculated Risk Layer]
   * Full +15 pts: Block account constraints are not applicable, waived by the grant, or not required.
   * Partial +5 pts: Block account required but offset by high post-study visa length.

5. ACADEMIC COMPATIBILITY (Max 10 pts)
   * Full +10 pts: Program format is verified as Research/Thesis-based.
   * Partial +5 pts: Program is purely Coursework-based.

6. CAREER RUNWAY & LOGISTICS (Max 5 pts)
   * Full +5 pts: Host country allows a post-study job-seeker visa (PSW) AND verified as English-taught.

════════════════════════════════════════════
CRITICAL FILTER TERMINATION (FORCE MATCH_SCORE TO 0)
════════════════════════════════════════════
If any of these conditions are met, IMMEDIATELY set match_score to 0:
- Excludes citizens of ${applicantProfile.nationality}.
- The opportunity is strictly an undergraduate, Bachelor's, or school-level application.
- The academic field is fundamentally unrelated to ${applicantProfile.targetFields} (e.g., Public Policy, Global Affairs, Arts, Business Administration, Humanities). Core technology/software must be the primary focus.

${messageText ? `\nContext from incoming alert:\n${messageText}\n` : ''}

════════════════════════════════════════════
TARGET WEB INTERNET MATERIAL TO ANALYZE
════════════════════════════════════════════
${text}
`;
}

class ScholarshipAnalyzer extends BaseAnalyzer {
  constructor(config = {}) {
    super(config);
    this.provider = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async analyze(content, context = {}) {
    if (!this.provider) {
      throw new Error('ScholarshipAnalyzer: Provider not set');
    }

    const applicantProfile = {
      name: config.get('APPLICANT_NAME') || 'Ahmad Hassan',
      nationality: config.get('APPLICANT_NATIONALITY') || 'Pakistani',
      degreeTier: config.get('APPLICANT_DEGREE_TIER') || 'Master',
      targetFields: config.get('APPLICANT_TARGET_FIELDS') || 'Software Engineering, Computer Science, AI, Distributed Computing',
      researchFocus: config.get('APPLICANT_RESEARCH_FOCUS') || 'Federated Learning, on-device AI, distributed computation systems',
    };

    const prompt = buildScholarshipPrompt(content, applicantProfile, context.messageText);

    return {
      prompt,
      schema: SCHOLARSHIP_RESPONSE_SCHEMA,
      applicantProfile,
    };
  }
}

module.exports = { ScholarshipAnalyzer };
