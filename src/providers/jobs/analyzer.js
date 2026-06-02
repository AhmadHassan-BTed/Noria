'use strict';

const { BaseAnalyzer } = require('../../plugins/base');
const { config } = require('../../config');
const { JOB_RESPONSE_SCHEMA } = require('./schema');

function buildJobPrompt(text, applicantProfile, messageText) {
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

class JobAnalyzer extends BaseAnalyzer {
  constructor(config = {}) {
    super(config);
    this.provider = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  async analyze(content, context = {}) {
    if (!this.provider) {
      throw new Error('JobAnalyzer: Provider not set');
    }

    const applicantProfile = {
      name: config.get('APPLICANT_NAME'),
      nationality: config.get('APPLICANT_NATIONALITY'),
      degreeTier: config.get('APPLICANT_DEGREE_TIER'),
      targetFields: config.get('APPLICANT_TARGET_FIELDS'),
      researchFocus: config.get('APPLICANT_RESEARCH_FOCUS'),
    };

    const prompt = buildJobPrompt(content, applicantProfile, context.messageText);

    return {
      prompt,
      schema: JOB_RESPONSE_SCHEMA,
      applicantProfile,
    };
  }
}

module.exports = { JobAnalyzer };
