'use strict';

const EVENTS = require('../../config/constants/events');

const DIVIDER = '─'.repeat(33);

function formatNotification(url, ai_data) {
  const timestamp = new Date().toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const programName = ai_data.program_name?.trim() || 'Unknown Program';
  const deadline    = ai_data.deadline?.trim()     || 'Not specified';
  const analysis    = ai_data.analysis?.trim()     || 'No analysis provided.';

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

function initNotifierDispatcher(broker) {

  broker.on(EVENTS.ANALYZER.MATCH_FOUND, ({ url, ai_data }) => {
    try {
      if (!url || typeof url !== 'string') {
        throw new Error(
          `MATCH_FOUND payload is missing a valid 'url'. Received: ${JSON.stringify(url)}`,
        );
      }
      if (!ai_data || typeof ai_data !== 'object') {
        throw new Error(
          `MATCH_FOUND payload is missing 'ai_data'. Received: ${JSON.stringify(ai_data)}`,
        );
      }

      console.log(`[Dispatcher] Formatting notification for: "${ai_data.program_name}"`);

      const formattedMessage = formatNotification(url, ai_data);

      broker.emit(EVENTS.NOTIFIER.SEND, formattedMessage);
      console.log('[Dispatcher] NOTIFIER.SEND emitted — message queued for delivery.');

    } catch (err) {
      console.error('[Dispatcher] Failed to dispatch notification →', err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'NotifierDispatcher',
        url:     url ?? 'unknown',
        message: err.message,
        stack:   err.stack,
      });
    }
  });

  console.log('[Dispatcher] Notifier dispatcher service initialized and listening.');
}

module.exports = { initNotifierDispatcher };