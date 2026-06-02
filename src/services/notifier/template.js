'use strict';

function formatNotification(data) {
  // Determine indicators
  const scoreIndicator = data.match_score >= 85 ? '🟢' : data.match_score >= 70 ? '🟡' : '🔴';
  const fundingIcon = data.fully_funded ? '✅ Full' : '❌ Partial/None';
  const englishIcon = data.english_taught ? '✅ English' : '⚠️ Local Lang';
  const pswIcon = data.post_study_visa ? '✅ PSW Yes' : '❌ PSW No';

  return `[${data.match_score}%] ${scoreIndicator} ${data.scholarship_name || 'Unknown Grant'}
🏛️ ${data.uni_country || 'Unknown Location'}

⚡ VERDICT: ${data.verdict}

🎓 Program: ${data.program_name}
📅 Deadline: ${data.deadline}

💰 Finance: ${fundingIcon} | Block Acct: ${data.block_account}
🛂 Logistics: ${englishIcon} | ${pswIcon}

🔗 Apply: ${data.apply_link}
ℹ️ Source: ${data.url}`.trim();
}

module.exports = { formatNotification };
