'use strict';

const { BaseAnalyzer } = require('../../plugins/base');
const { config } = require('../../config');
const { SCHOLARSHIP_RESPONSE_SCHEMA } = require('./schema');

function buildScholarshipPrompt(text, applicantProfile) {
  return `
You are an advanced academic scoring engine for scholarship evaluation.
Evaluate raw web content against the applicant profile and generate a score from 0-100.

════════════════════════════════════════════
APPLICANT PROFILE
════════════════════════════════════════════
Name           : ${applicantProfile.name}
Nationality    : ${applicantProfile.nationality} (Hard constraint)
Academic tier  : ${applicantProfile.degreeTier}
Target fields  : ${applicantProfile.targetFields}
Research focus : ${applicantProfile.researchFocus}

════════════════════════════════════════════
SCORING CRITERIA (0-100 PTS)
════════════════════════════════════════════
+30 pts : Fully funded (tuition + living stipend). Partial: +10.
+20 pts : MS/MSc/Postgraduate or combined MS/PhD. PhD-only: +15 if Bachelor entry, +10 if single-track.
+20 pts : Software Engineering, Computer Science, or AI specializations.
+15 pts : Block account constraints don't apply or waived.
+10 pts : Program verified as English-taught.
+5 pts  : Post-study job-seeker visa available.

CRITICAL PENALTIES:
- Excludes ${applicantProfile.nationality} citizens → force score to 0
- Exclusively Bachelor/undergraduate only → force score to 0

════════════════════════════════════════════
PAGE CONTENT
════════════════════════════════════════════
${text}
`.trim();
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
      name: config.get('APPLICANT_NAME'),
      nationality: config.get('APPLICANT_NATIONALITY'),
      degreeTier: config.get('APPLICANT_DEGREE_TIER'),
      targetFields: config.get('APPLICANT_TARGET_FIELDS'),
      researchFocus: config.get('APPLICANT_RESEARCH_FOCUS'),
    };

    const prompt = buildScholarshipPrompt(content, applicantProfile);

    return {
      prompt,
      schema: SCHOLARSHIP_RESPONSE_SCHEMA,
      applicantProfile,
    };
  }
}

module.exports = { ScholarshipAnalyzer };
