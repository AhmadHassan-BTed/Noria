'use strict';

const EVENTS = require('../../config/constants/events');

// ---------------------------------------------------------------------------
// Visual separator used in the formatted message.
// WhatsApp renders this as a horizontal rule in monospace-like blocks.
// ---------------------------------------------------------------------------
const DIVIDER = '─'.repeat(33);

/**
 * Formats a scholarship match result into a clean, emoji-rich WhatsApp message.
 *
 * The template is designed for instant readability on a mobile screen:
 *   • Critical info (program name, deadline) is at the top
 *   • AI reasoning is in italics (WhatsApp markdown: _text_)
 *   • The source URL is last — it's the least urgent piece of info
 *
 * @param {string} url        - Source URL scraped by the Puppeteer service.
 * @param {object} ai_data    - Parsed JSON object returned by Gemini.
 * @param {string} ai_data.program_name - Full program / scholarship name.
 * @param {string} ai_data.deadline     - Application deadline string.
 * @param {string} ai_data.analysis     - AI justification for the match.
 * @returns {string} Formatted WhatsApp message string.
 */
function formatNotification(url, ai_data) {
  // Render a human-readable timestamp in Pakistan Standard Time (UTC+5)
  const timestamp = new Date().toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  // Guard against missing fields — the AI occasionally leaves a field empty
  // even when the schema requires it; these fallbacks keep the message clean.
  const programName = ai_data.program_name?.trim() || 'Unknown Program';
  const deadline    = ai_data.deadline?.trim()     || 'Not specified';
  const analysis    = ai_data.analysis?.trim()     || 'No analysis provided.';

  // WhatsApp markdown reference:
  //   *bold*      →  bold text
  //   _italic_    →  italic text
  //   ```mono```  →  monospace block (useful for URLs)
  //
  // Lines are joined with '\n' to match WhatsApp's expected line-break format.
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

/**
 * Initializes the notification dispatcher service and binds it to the broker.
 *
 * INBOUND   (Broker → Dispatcher)
 *   • EVENTS.ANALYZER.MATCH_FOUND → { url: string, ai_data: object }
 *     Receives a confirmed match, formats it into a WhatsApp-ready string.
 *
 * OUTBOUND  (Dispatcher → Broker)
 *   • EVENTS.NOTIFIER.SEND → formattedMessage: string
 *     The WhatsApp listener picks this up and calls client.sendMessage().
 *   • EVENTS.SYSTEM.ERROR  → on formatting failure or missing payload fields.
 *
 * ARCHITECTURAL ROLE:
 *   This is a pure transformation service — it has no I/O of its own and
 *   no knowledge of WhatsApp internals. It converts structured data into
 *   a human-readable string and hands it off. This keeps the WhatsApp
 *   service focused entirely on transport concerns.
 *
 * @param {import('events').EventEmitter} broker - The central event bus.
 */
function initNotifierDispatcher(broker) {

  broker.on(EVENTS.ANALYZER.MATCH_FOUND, ({ url, ai_data }) => {
    try {
      // -----------------------------------------------------------------
      // Guard — ensure the payload from the Analyzer is well-formed
      // -----------------------------------------------------------------
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

      console.log(`[Dispatcher]  Formatting notification for: "${ai_data.program_name}"`);

      // -----------------------------------------------------------------
      // Transform structured data → human-readable WhatsApp message
      // -----------------------------------------------------------------
      const formattedMessage = formatNotification(url, ai_data);

      // -----------------------------------------------------------------
      // Hand the ready-to-send string to the WhatsApp listener
      // -----------------------------------------------------------------
      broker.emit(EVENTS.NOTIFIER.SEND, formattedMessage);
      console.log('[Dispatcher]  NOTIFIER.SEND emitted — message queued for delivery.');

    } catch (err) {
      console.error('[Dispatcher]  Failed to dispatch notification →', err.message);
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'NotifierDispatcher',
        url:     url ?? 'unknown',
        message: err.message,
        stack:   err.stack,
      });
    }
  });

  console.log('[Dispatcher]  Notifier dispatcher service initialized and listening.');
}

module.exports = { initNotifierDispatcher };