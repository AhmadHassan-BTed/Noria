'use strict';

// Helper to convert booleans to instant visual telemetry indicators
const boolIcon = (val) => val === true ? '✅' : (val === false ? '❌' : '⚠️');

// Helper to handle unextracted or missing links gracefully
const formatLink = (link) => (link && link !== 'Not found') ? link : 'Not specified';

/**
 * Formats the rich scoring engine JSON output into a hyper-dense, telegram-style WhatsApp card.
 * @param {Object} data - The extracted scholarship schema object.
 * @returns {string} - Formatted WhatsApp markdown string.
 */
function formatNotification(data) {
  // Dynamic performance asset allocation based on match percentage tier
  const scoreIcon = data.match_score >= 90 ? '🔥' : '🎯';

  return `${scoreIcon} *${data.scholarship_name.toUpperCase()}* [${data.match_score}% MATCH]
🏛️ ${data.uni_country}
📅 D/L: ${data.deadline}

*🎓 PROG:* ${data.program_name}
*💡 FIT:* ${data.verdict}
*🔬 RES:* ${data.research_alignment}

*💰 FINANCE*
Funded: ${boolIcon(data.fully_funded)}
Block Acc: ${data.block_account}

*🛂 LOGISTICS*
English: ${boolIcon(data.english_taught)} | IELTS: ${data.ielts_score}
Post-Study Work: ${boolIcon(data.post_study_visa)}

*🔗 TELEMETRY LINKS*
*Apply:* ${formatLink(data.apply_link)}
*Official:* ${formatLink(data.official_link)}
*Source:* ${data.url}`;
}

module.exports = { formatNotification };