'use strict';

const EVENTS = require('../../config/constants/events');
const { formatNotification } = require('./template');

function initNotifierDispatcher(broker) {

  broker.on(EVENTS.ANALYZER.MATCH_FOUND, (payload) => {
    try {
      // Defensive structural check to protect event routing
      if (!payload || typeof payload !== 'object') {
        throw new Error(`MATCH_FOUND received an invalid or completely empty payload.`);
      }
      
      if (!payload.url || typeof payload.url !== 'string') {
        throw new Error(
          `MATCH_FOUND payload is missing a valid source 'url'. Received: ${JSON.stringify(payload.url)}`,
        );
      }

      // Safe fallback logging to guarantee no undefined interpolation
      const programLabel = payload.program_name || payload.scholarship_name || 'Unknown Program';
      console.log(`[Dispatcher] Formatting notification for: "${programLabel}"`);

      // Compile data map through your template engine
      const formattedMessage = formatNotification(payload);

      // Ship telemetry string directly out to the WhatsApp client interface
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