'use strict';

/**
 * Infrastructure — WhatsApp Sender (Stateless)
 *
 * Pure function for sending WhatsApp messages.
 * The client instance and target are passed as arguments — no `this`,
 * no class state, no BaseNotifier, no provider reference.
 */

const { metrics } = require('../../utils/metrics');
const { withRetry } = require('../../utils/retry');

// =============================================================================
// Constants
// =============================================================================

const CHAT_ID_SUFFIX = Object.freeze({
  PERSONAL: '@c.us',
  GROUP: '@g.us',
  CHANNEL: '@newsletter',
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalises any phone number format into a whatsapp-web.js chatId.
 *
 * Accepted input examples:
 *   '+923001234567'       → '923001234567@c.us'
 *   '923001234567'        → '923001234567@c.us'
 *   '0092 300 1234567'    → '923001234567@c.us'
 *   '923001234567@c.us'   → '923001234567@c.us'  (already formatted — passthrough)
 *   '1234567890@g.us'     → '1234567890@g.us'    (group — passthrough)
 *
 * @param {string} raw
 * @returns {string}
 */
function normaliseChatId(raw) {
  const str = String(raw).trim();

  // Already a fully-qualified chatId — return as-is regardless of suffix
  if (str.includes('@')) {
    return str;
  }

  // Strip everything that isn't a digit, then append the personal chat suffix
  return `${str.replace(/\D/g, '')}${CHAT_ID_SUFFIX.PERSONAL}`;
}

/**
 * Returns a privacy-safe label for a chatId suitable for log lines.
 *
 * @param {string} chatId
 * @returns {string}
 */
function maskChatId(chatId) {
  const atIdx = chatId.indexOf('@');
  if (atIdx === -1) {
    return '***';
  }

  const id = chatId.slice(0, atIdx);
  const suffix = chatId.slice(atIdx);

  if (id.length < 7) {
    return `***${suffix}`;
  }

  const head = id.slice(0, 4);
  const tail = id.slice(-3);
  const middle = '*'.repeat(id.length - head.length - tail.length);

  return `${head}${middle}${tail}${suffix}`;
}

/**
 * Creates a typed Error with a machine-readable `.code` property.
 *
 * @param {string} code    - Snake-case error code.
 * @param {string} message - Human-readable explanation.
 * @returns {Error}
 */
function makeError(code, message) {
  const err = new Error(`WhatsAppSender: ${message}`);
  err.code = code;
  err.source = 'WhatsAppSender';
  return err;
}

// =============================================================================
// Core Send Function (Stateless)
// =============================================================================

/**
 * Sends a WhatsApp message via the provided client instance.
 *
 * @param {import('whatsapp-web.js').Client} client - Active WA client.
 * @param {string} target      - Recipient phone number or chatId.
 * @param {string} message     - Message body.
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]     - Retry attempts on transient failure.
 * @param {number} [options.baseDelayMs=1000] - Initial retry back-off delay (ms).
 * @returns {Promise<void>}
 * @throws {Error} with a `.code` property on validation or delivery failure.
 */
async function sendMessage(client, target, message, options = {}) {
  const { maxRetries = 3, baseDelayMs = 1000 } = options;

  // ── Validate client ─────────────────────────────────────────────────────
  if (!client) {
    throw makeError(
      'CLIENT_NOT_READY',
      'WhatsApp client is not available. ' +
        'The connection may still be establishing or was closed.'
    );
  }

  // ── Validate target ─────────────────────────────────────────────────────
  if (!target) {
    throw makeError('NO_TARGET', 'No target specified. Pass a phone number or chatId.');
  }

  const chatId = normaliseChatId(target);

  // Guard: subscribers cannot send messages TO a WhatsApp Channel
  if (chatId.endsWith(CHAT_ID_SUFFIX.CHANNEL)) {
    throw makeError(
      'INVALID_TARGET_CHANNEL',
      `Cannot send to a channel (${chatId}). ` +
        'WhatsApp Channels are broadcast-only; only admins can post to them.'
    );
  }

  // Guard: plausible phone number length
  const numericPart = chatId.split('@')[0];
  if (numericPart.length < 7) {
    throw makeError(
      'INVALID_TARGET_FORMAT',
      `Target "${target}" resolved to "${numericPart}", which is too short ` +
        'to be a valid phone number. Check the format.'
    );
  }

  // ── Validate message ────────────────────────────────────────────────────
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw makeError('EMPTY_MESSAGE', 'Message body is empty or not a string.');
  }

  // ── Send with retry ─────────────────────────────────────────────────────
  const masked = maskChatId(chatId);
  console.log(`[WhatsAppSender]   Sending to ${masked}...`);
  metrics.recordWhatsAppSend?.();

  let sentMsg = null;
  try {
    await withRetry(
      async () => {
        sentMsg = await client.sendMessage(chatId, message);
      },
      {
        maxRetries,
        baseDelayMs,
        onRetry: ({ attempt, delay }) => {
          console.warn(
            `[WhatsAppSender] ↩   Retry ${attempt}/${maxRetries} ` +
              `for ${masked} after ${delay}ms`
          );
          metrics.recordWhatsAppRetry?.();
        },
      }
    );

    if (sentMsg && sentMsg.id && sentMsg.id._serialized) {
      global.botSentMessageIds = global.botSentMessageIds || new Set();
      global.botSentMessageIds.add(sentMsg.id._serialized);
    }

    console.log(`[WhatsAppSender] ✅  Delivered to ${masked}.`);
  } catch (err) {
    metrics.recordWhatsAppFailure?.();
    console.error(
      `[WhatsAppSender] ❌  Delivery failed for ${masked} ` +
        `after ${maxRetries} attempt(s): ${err.message}`
    );
    throw err;
  }
}

module.exports = { sendMessage, normaliseChatId, maskChatId };
