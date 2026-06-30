'use strict';

/**
 * Scholarship Domain — Template Builder
 *
 * Pure function: transforms structured AI analysis data into a
 * formatted WhatsApp notification message string.
 */

/**
 * Formats scholarship analysis data into a WhatsApp notification message.
 *
 * @param {object} data - Structured AI response data
 * @returns {string} Formatted notification message
 */
function buildTemplate(data) {
  const scoreIndicator = data.match_score >= 85 ? '🟢' : data.match_score >= 70 ? '🟡' : '🔴';

  const pswText = data.post_study_visa ? '✅ PSW' : '❌ No PSW';
  const languageText = data.english_taught ? '✅ English-Taught' : ' [WARNING]  Local Language';
  const pakEligibleText = data.pakistan_eligible
    ? '✅ Pakistan Accepted'
    : '❌ Pakistan Not Accepted';

  let appFeeText = ' [WARNING]  Fee: Unknown';
  if (data.application_fee) {
    const feeLower = data.application_fee.toLowerCase();
    if (feeLower.includes('none') || feeLower.includes('waived') || feeLower.includes('0')) {
      appFeeText = '🆓 No App Fee';
    } else {
      appFeeText = ` [WARNING]  Fee: ${data.application_fee}`;
    }
  }

  const fundingText = data.fully_funded ? '✅ Fully Funded' : '❌ Partial/None';
  let blockAcctText = data.block_account || 'Unknown';
  if (
    blockAcctText.toLowerCase().includes('waived') ||
    blockAcctText.toLowerCase().includes('not required') ||
    blockAcctText.toLowerCase().includes('not applicable')
  ) {
    blockAcctText = 'Waived';
  }

  const spouseText = data.spouse_allowance ? ' Spouse Support: Yes' : ' Spouse Support: No';

  const fallbackApply =
    data.apply_link && data.apply_link !== 'Not found' ? data.apply_link : data.official_link;
  const fallbackSource =
    data.official_link && data.official_link !== 'Not found' ? data.official_link : 'Not specified';

  return `
${scoreIndicator} ${data.match_score}% MATCH | ${data.scholarship_name || 'Unknown Opportunity'}
 ${data.uni_country || 'Unknown Location'}

▪  [FAST]  Verdict: ${data.verdict}
▪  Program: ${data.program_name || 'Not specified'} (${data.program_format || 'Unknown Format'})
▪  Deadline: ${data.deadline || 'Unknown'}
▪  Eligibility: ${pakEligibleText} | ${appFeeText}
▪  [NOTE]  Reqs: ${data.test_requirements || 'Not specified'} | CGPA: ${data.cgpa_requirement || 'Not specified'} | Exp: ${data.work_experience || 'Not specified'}
▪  Finance: ${fundingText} (Block Acct: ${blockAcctText}) | ${spouseText}
▪  Logistics: ${languageText} | ${pswText}

 Apply: ${fallbackApply}
 [INFO]  Source: ${fallbackSource}
`.trim();
}

module.exports = { buildTemplate };
