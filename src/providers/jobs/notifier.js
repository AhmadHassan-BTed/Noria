'use strict';

const { BaseNotifier } = require('../../plugins/base');

const boolIcon = (val) => (val === true ? '✅' : val === false ? '❌' : '⚠️');
const formatLink = (link) => (link && link !== 'Not found' ? link : 'Not specified');

class JobNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.provider = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  format(data) {
    const scoreIcon = data.match_score >= 90 ? '🔥' : '🎯';

    return `${scoreIcon} *${data.job_title.toUpperCase()}* at *${data.company_name.toUpperCase()}* [${data.match_score}% MATCH]
📍 ${data.location}
💰 ${data.salary_range}

*💼 POSITION*
Seniority: ${data.experience_level}
Remote: ${boolIcon(data.remote_option)}
Sponsorship: ${boolIcon(data.visa_sponsorship)}

*💡 FIT*
${data.verdict}

*🛠️ SKILLS*
${data.skills_required}

*📋 LINKS*
Apply: ${formatLink(data.apply_link)}
Company: ${formatLink(data.official_link)}
Source: ${data.url}`;
  }
}

module.exports = { JobNotifier };
