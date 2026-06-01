'use strict';

const EVENTS = require('../../config/constants/events');
const { formatNotification } = require('./template');

function initNotifierDispatcher(broker) {

  broker.on(EVENTS.ANALYZER.MATCH_FOUND, (payload) => {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error(`MATCH_FOUND received an invalid or completely empty payload.`);
      }

      if (!payload.url || typeof payload.url !== 'string') {
        throw new Error(
          `MATCH_FOUND payload is missing a valid source 'url'. Received: ${JSON.stringify(payload.url)}`,
        );
      }

      if (!payload.match_score || typeof payload.match_score !== 'number') {
        throw new Error(`MATCH_FOUND missing valid 'match_score' field.`);
      }

      const programLabel = payload.program_name || payload.scholarship_name || 'Unknown Program';
      console.log(`[Dispatcher] Formatting notification for: "${programLabel}"`);

      const formattedMessage = formatNotification(payload);

      broker.emit(EVENTS.NOTIFIER.SEND, formattedMessage);
      console.log('[Dispatcher] NOTIFIER.SEND emitted — message queued for delivery.');

    } catch (err) {
      console.error('[Dispatcher] Failed to dispatch notification →', err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'NotifierDispatcher',
        url:     payload?.url ?? 'unknown',
        message: err.message,
        stack:   err.stack,
      });
    }
  });

  console.log('[Dispatcher] Notifier dispatcher service initialized and listening.');
}

module.exports = { initNotifierDispatcher };