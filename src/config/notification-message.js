'use strict';

const DIVIDER = '─'.repeat(33);

function buildMessage({ programName, deadline, analysis, url, timestamp }) {
  const lines = [
    ` *SCHOLARSHIP MATCH FOUND* `,
    ``,
    ` *Program:*`,
    `${programName}`,
    ``,
    ` *Application Deadline:*`,
    `${deadline}`,
    ``,
    ` *AI Analysis:*`,
    `_${analysis}_`,
    ``,
    ` *Source Link:*`,
    `${url}`,
    ``,
    DIVIDER,
    ` *Detected:* ${timestamp}`,
    `_Powered by Noria Pipeline_ `,
  ];

  return lines.join('\n');
}

module.exports = { buildMessage };