'use strict';

// =============================================================================
// Source Classifier — Message Origin Classification & Gating
// =============================================================================
// Pure, stateless utility functions that classify WhatsApp message origins
// and determine whether a message should be processed based on a configured
// set of allowed origins.
//
// These functions depend only on the CHAT_ID_SUFFIX constants from
// source-mode.js and have no side-effects, making them trivially testable
// and reusable across listeners.

const { CHAT_ID_SUFFIX } = require('./source-mode');

// =============================================================================
// Classification
// =============================================================================

/**
 * Returns true if the message originates from a WhatsApp Channel.
 *
 * @param {{ from?: string }} msg
 * @returns {boolean}
 */
function isChannelMessage(msg) {
  return typeof msg.from === 'string' &&
         msg.from.endsWith(CHAT_ID_SUFFIX.CHANNEL);
}

/**
 * Returns true if the message originates from a WhatsApp Group.
 *
 * @param {{ from?: string }} msg
 * @returns {boolean}
 */
function isGroupMessage(msg) {
  return typeof msg.from === 'string' &&
         msg.from.endsWith(CHAT_ID_SUFFIX.GROUP);
}

/**
 * Returns true if the message originates from an individual (1-to-1) chat.
 * This is the fallback — anything that is not a channel or group.
 *
 * @param {{ from?: string }} msg
 * @returns {boolean}
 */
function isIndividualMessage(msg) {
  return !isChannelMessage(msg) && !isGroupMessage(msg);
}

/**
 * Classifies a message into a canonical origin string.
 *
 * Classification rules (checked in order):
 *   1. @newsletter  → 'channels'
 *   2. @g.us        → 'groups'
 *   3. anything else → 'individual'
 *
 * @param {{ from?: string }} msg
 * @returns {'channels'|'groups'|'individual'}
 */
function classifyOrigin(msg) {
  if (isChannelMessage(msg)) return 'channels';
  if (isGroupMessage(msg))   return 'groups';
  return 'individual';
}

// =============================================================================
// Gating
// =============================================================================

/**
 * Determines whether a message's origin is included in the set of allowed
 * origins.
 *
 * @param {{ from?: string }} msg
 * @param {string[]} allowedOrigins — canonical origin strings
 * @returns {boolean}
 */
function isSourceAllowed(msg, allowedOrigins) {
  const origin = classifyOrigin(msg);
  return allowedOrigins.includes(origin);
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  isChannelMessage,
  isGroupMessage,
  isIndividualMessage,
  classifyOrigin,
  isSourceAllowed,
};