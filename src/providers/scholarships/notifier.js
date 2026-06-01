'use strict';

const { BaseNotifier } = require('../../plugins/base');

const boolIcon = (val) => (val === true ? '✅' : val === false ? '❌' : '⚠️');
const formatLink = (link) => (link && link !== 'Not found' ? link : 'Not specified');

class ScholarshipNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.provider = null;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  format(data) {
    const scoreIcon = data.match_score >= 90 ? '🔥' : '🎯';

    return `${scoreIcon} *${data.scholarship_name.toUpperCase()}* [${data.match_score}% MATCH]
🏛️ ${data.uni_country}
📅 D/L: ${data.deadline}

*🎓 PROGRAM*
${data.program_name}

*💡 FIT*
${data.verdict}

*🔬 RESEARCH*
${data.research_alignment}

*💰 FINANCIAL*
Fully Funded: ${boolIcon(data.fully_funded)}
Block Account: ${data.block_account}

*🛂 REQUIREMENTS*
English: ${boolIcon(data.english_taught)} | IELTS: ${data.ielts_score}
Post-Study Work: ${boolIcon(data.post_study_visa)}

*📋 LINKS*
Apply: ${formatLink(data.apply_link)}
Official: ${formatLink(data.official_link)}
Source: ${data.url}`;
  }
}

module.exports = { ScholarshipNotifier };
