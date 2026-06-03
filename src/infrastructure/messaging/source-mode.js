'use strict';

// =============================================================================
// Source Mode — Constants & Normalization
// =============================================================================
// This module owns all source-mode related constants and the pure
// normalization function.  It has zero runtime dependencies and can be
// imported by any layer (listener, launcher config builder, tests).

/**
 * Chat-ID suffixes used by WhatsApp to distinguish message origins.
 */
const CHAT_ID_SUFFIX = Object.freeze({
  PERSONAL: '@c.us',
  GROUP: '@g.us',
  CHANNEL: '@newsletter',
});

/**
 * Named source-mode presets.
 * Exported so callers can use SOURCE_MODE.CHANNELS instead of raw strings.
 */
const SOURCE_MODE = Object.freeze({
  ALL: 'all',
  CHATS: 'chats',
  CHANNELS: 'channels',
  BOTH: 'both',
  INDIVIDUAL: 'individual',
  GROUPS: 'groups',
});

/**
 * Canonical set of valid origin identifiers.
 * Every normalised sourceMode array is a subset of this list.
 */
const VALID_ORIGINS = Object.freeze(['individual', 'groups', 'channels']);

// =============================================================================
// Normalization
// =============================================================================

/**
 * Normalizes a raw sourceMode config value into an array of canonical origin
 * strings.
 *
 * Accepted inputs:
 *   - Legacy strings: 'chats', 'channels', 'both', 'all'
 *   - Comma-separated strings: 'individual,groups', 'groups,channels'
 *   - Arrays: ['individual', 'groups', 'channels']
 *   - Single origin: 'individual', 'groups', 'channels'
 *
 * @param {string|string[]} raw
 * @returns {string[]} Array of canonical origins (subset of VALID_ORIGINS).
 * @throws {Error} If no valid origins can be resolved.
 */
function normalizeSourceMode(raw) {
  // ── Array form ──────────────────────────────────────────────────────────
  if (Array.isArray(raw)) {
    const filtered = raw
      .map((s) => String(s).toLowerCase().trim())
      .filter((s) => VALID_ORIGINS.includes(s));
    if (filtered.length === 0) {
      throw new Error(
        `[sourceMode] Invalid sourceMode array: [${raw.join(', ')}]. ` +
          `Valid origins: ${VALID_ORIGINS.join(' | ')}.`
      );
    }
    return filtered;
  }

  // ── String form ─────────────────────────────────────────────────────────
  const mode = String(raw).toLowerCase().trim();

  // Legacy keyword shortcuts
  if (mode === 'all' || mode === 'both') {
    return [...VALID_ORIGINS];
  }
  if (mode === 'chats') {
    return ['individual', 'groups'];
  }
  if (mode === 'channels') {
    return ['channels'];
  }

  // Comma-separated list, e.g. 'individual,channels'
  if (mode.includes(',')) {
    const filtered = mode
      .split(',')
      .map((s) => s.trim())
      .filter((s) => VALID_ORIGINS.includes(s));
    if (filtered.length === 0) {
      throw new Error(
        `[sourceMode] Invalid sourceMode: "${raw}". ` +
          `Valid origins: ${VALID_ORIGINS.join(' | ')}.`
      );
    }
    return filtered;
  }

  // Single origin, e.g. 'individual'
  if (VALID_ORIGINS.includes(mode)) {
    return [mode];
  }

  throw new Error(
    `[sourceMode] Invalid sourceMode: "${mode}". ` +
      'Valid: all | both | chats | channels | individual | groups | ' +
      'or a comma-separated combination (e.g. "individual,groups").'
  );
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  CHAT_ID_SUFFIX,
  SOURCE_MODE,
  VALID_ORIGINS,
  normalizeSourceMode,
};
