'use strict';

/**
 * Jobs Domain — Template Builder
 *
 * Pure function: transforms structured AI analysis data into a
 * formatted WhatsApp notification message string.
 */

const boolIcon = (val) => (val === true ? '✅' : val === false ? '❌' : '⚠️');
const formatLink = (link) => (link && link !== 'Not found' ? link : 'Not specified');

/**
 * Formats job analysis data into a WhatsApp notification message.
 *
 * @param {object} data - Structured AI response data
 * @returns {string} Formatted notification message
 */
function buildTemplate(data) {
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

module.exports = { buildTemplate };
