'use strict';

const { BaseNotifier } = require('../base');
const { getConnectionManager } = require('../listeners/connection-manager');
const { metrics } = require('../../utils/metrics');
const { withRetry } = require('../../utils/retry');

// =============================================================================
// Constants
// =============================================================================

const CHAT_ID_SUFFIX = Object.freeze({
  PERSONAL: '@c.us',
  GROUP:    '@g.us',
  CHANNEL:  '@newsletter',
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
  if (str.includes('@')) return str;

  // Strip everything that isn't a digit, then append the personal chat suffix
  return `${str.replace(/\D/g, '')}${CHAT_ID_SUFFIX.PERSONAL}`;
}

/**
 * Returns a privacy-safe label for a chatId suitable for log lines.
 * Masks the middle digits so full numbers are never written to stdout/stderr.
 *
 * Examples:
 *   '923001234567@c.us'  →  '9230****567@c.us'
 *   '1234567890@g.us'    →  '1234***890@g.us'
 *
 * @param {string} chatId
 * @returns {string}
 */
function maskChatId(chatId) {
  const atIdx = chatId.indexOf('@');
  if (atIdx === -1) return '***';

  const id     = chatId.slice(0, atIdx);
  const suffix = chatId.slice(atIdx);

  if (id.length < 7) return `***${suffix}`;

  const head   = id.slice(0, 4);
  const tail   = id.slice(-3);
  const middle = '*'.repeat(id.length - head.length - tail.length);

  return `${head}${middle}${tail}${suffix}`;
}

// =============================================================================
// Error factory
// =============================================================================

/**
 * Creates a typed Error with a machine-readable `.code` property.
 * This lets callers distinguish error types without string-matching the message.
 *
 * @param {string} code    - Snake-case error code.
 * @param {string} message - Human-readable explanation.
 * @returns {Error}
 */
function makeError(code, message) {
  const err  = new Error(`WhatsAppNotifier: ${message}`);
  err.code   = code;
  err.source = 'WhatsAppNotifier';
  return err;
}

// =============================================================================
// Class
// =============================================================================

class WhatsAppNotifier extends BaseNotifier {
  /**
   * @param {object} config
   * @param {string} [config.phoneNumber]      - Default recipient (fallback when
   *                                             target is omitted in send()).
   * @param {number} [config.maxRetries=3]     - Retry attempts on transient failure.
   * @param {number} [config.baseDelayMs=1000] - Initial retry back-off delay (ms).
   */
  constructor(config = {}) {
    super(config);
    this.phoneNumber = config.phoneNumber  ?? null;
    this.maxRetries  = config.maxRetries   ?? 3;
    this.baseDelayMs = config.baseDelayMs  ?? 1_000;
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Resolves and validates the whatsapp-web.js client from the connection
   * manager.  Throws typed errors so the caller gets actionable information
   * rather than a generic "cannot read property of undefined" crash.
   *
   * @returns {import('whatsapp-web.js').Client}
   */
  _getReadyClient() {
    const connMgr = getConnectionManager();

    if (!connMgr) {
      throw makeError(
        'CONN_MANAGER_MISSING',
        'Connection manager is not initialised. ' +
        'Ensure WhatsAppListener.initialize() has resolved before sending.'
      );
    }

    const client = connMgr.getClient();

    if (!client) {
      throw makeError(
        'CLIENT_NOT_READY',
        'WhatsApp client is not available. ' +
        'The connection may still be establishing or was closed.'
      );
    }

    return client;
  }

  /**
   * Resolves and validates the send target.
   *
   * Accepts:
   *   • Phone numbers in any format (digits, spaces, dashes, leading '+')
   *   • Fully-qualified @c.us chatIds  (personal)
   *   • Fully-qualified @g.us chatIds  (group)
   *
   * Rejects:
   *   • @newsletter chatIds — channels are receive-only for subscribers.
   *     Only channel admins can post; a subscriber account cannot send TO one.
   *   • Empty or missing targets with no configured fallback.
   *   • Numbers that resolve to fewer than 7 digits (implausibly short).
   *
   * @param {string|null|undefined} target
   * @returns {string} Normalised chatId.
   */
  _resolveTarget(target) {
    const raw = target || this.phoneNumber;

    if (!raw) {
      throw makeError(
        'NO_TARGET',
        'No target specified. Pass a phone number to send(), or set ' +
        'config.phoneNumber in the constructor.'
      );
    }

    const chatId = normaliseChatId(raw);

    // Guard: subscribers cannot send messages TO a WhatsApp Channel
    if (chatId.endsWith(CHAT_ID_SUFFIX.CHANNEL)) {
      throw makeError(
        'INVALID_TARGET_CHANNEL',
        `Cannot send to a channel (${chatId}). ` +
        'WhatsApp Channels are broadcast-only; only admins can post to them.'
      );
    }

    // Guard: plausible phone number length
    // Real numbers are ≥ 7 digits even for the shortest country + local combos
    const numericPart = chatId.split('@')[0];
    if (numericPart.length < 7) {
      throw makeError(
        'INVALID_TARGET_FORMAT',
        `Target "${raw}" resolved to "${numericPart}", which is too short ` +
        'to be a valid phone number. Check the format.'
      );
    }

    return chatId;
  }

  /**
   * Validates the message body before attempting delivery.
   * @param {string} message
   */
  _validateMessage(message) {
    if (!message || typeof message !== 'string' || !message.trim()) {
      throw makeError(
        'EMPTY_MESSAGE',
        'Message body is empty or not a string.'
      );
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Sends a WhatsApp message to the specified target (or config.phoneNumber).
   * Retries on transient failures with exponential back-off.
   *
   * WhatsApp markdown is supported in the message body:
   *   *bold*   _italic_   ~strikethrough~   ```mono```
   *
   * @param {string|null} target   - Recipient phone number or chatId.
   *                                 Pass null/undefined to use the constructor default.
   * @param {string}      message  - Message body.
   * @returns {Promise<void>}
   * @throws {Error} with a `.code` property on validation or delivery failure.
   */
  async send(target, message) {
    // ── Validation (fail fast, before any I/O) ─────────────────────────────
    const client  = this._getReadyClient();
    const chatId  = this._resolveTarget(target);
    this._validateMessage(message);

    const masked = maskChatId(chatId);
    console.log(`[WhatsAppNotifier] 📤  Sending to ${masked}...`);
    metrics.recordWhatsAppSend?.();

    try {
      await withRetry(
        async () => {
          await client.sendMessage(chatId, message);
        },
        {
          maxRetries:  this.maxRetries,
          baseDelayMs: this.baseDelayMs,
          onRetry: ({ attempt, delay }) => {
            console.warn(
              `[WhatsAppNotifier] ↩️   Retry ${attempt}/${this.maxRetries} ` +
              `for ${masked} after ${delay}ms`
            );
            metrics.recordWhatsAppRetry?.();
          },
        }
      );

      console.log(`[WhatsAppNotifier] ✅  Delivered to ${masked}.`);

    } catch (err) {
      metrics.recordWhatsAppFailure?.();
      console.error(
        `[WhatsAppNotifier] ❌  Delivery failed for ${masked} ` +
        `after ${this.maxRetries} attempt(s): ${err.message}`
      );
      // Re-throw so the broker's SYSTEM.ERROR handler surfaces it
      throw err;
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { WhatsAppNotifier };