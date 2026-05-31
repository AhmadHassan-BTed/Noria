'use strict';

// =============================================================================
// NORIA  —  Event Contract
// =============================================================================
// This file is the single source of truth for every event name that flows
// through the central broker.  Services MUST import and reference these
// constants instead of using magic strings.
//
// Why deep-freeze?
//   A shallow Object.freeze() only prevents mutation of the top-level object.
//   Without freezing nested objects, code could still mutate, for example,
//   EVENTS.SYSTEM.ERROR = 'something-else' at runtime.
//   deepFreeze() recursively seals every nested object, making the contract
//   truly immutable for the lifetime of the process.
//
// Why namespaced string values (e.g. 'scraper.success')?
//   Namespaced strings survive serialisation (logs, debugging tools) and
//   remain self-explanatory without needing to resolve the constant back to
//   its property path.  Compare a raw log of 'SUCCESS' versus 'scraper.success'.
// =============================================================================

/**
 * Recursively freezes an object and every object nested within it.
 * Returns the original (now frozen) reference.
 *
 * @template T
 * @param {T} obj
 * @returns {Readonly<T>}
 */
function deepFreeze(obj) {
  // Freeze the own enumerable + non-enumerable properties
  Object.getOwnPropertyNames(obj).forEach((key) => {
    const value = obj[key];
    if (value !== null && typeof value === 'object') {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

// =============================================================================
// Contract definition
// =============================================================================

const EVENTS = deepFreeze({

  // ---------------------------------------------------------------------------
  // SYSTEM — lifecycle and global fault signalling
  // ---------------------------------------------------------------------------
  SYSTEM: {
    /** Emitted once by the orchestrator after all services initialise. */
    BOOTED: 'system.booted',

    /**
     * Emitted by any service when it catches an unrecoverable error.
     * Payload: { source: string, message: string, stack?: string, url?: string }
     */
    ERROR: 'system.error',
  },

  // ---------------------------------------------------------------------------
  // WHATSAPP — inbound message lifecycle
  // ---------------------------------------------------------------------------
  WHATSAPP: {
    /** Emitted once the WhatsApp client is authenticated and the socket is open. */
    READY: 'whatsapp.ready',

    /**
     * Emitted for every incoming message before any URL extraction is attempted.
     * Payload: raw whatsapp-web.js Message object.
     * Useful for auditing, rate-limiting, or building a secondary message router.
     */
    MESSAGE_RECEIVED: 'whatsapp.message_received',

    /**
     * Emitted when a URL is successfully extracted from a message body.
     * Payload: url (string)
     */
    LINK_EXTRACTED: 'whatsapp.link_extracted',
  },

  // ---------------------------------------------------------------------------
  // SCRAPER — Puppeteer page-fetch lifecycle
  // ---------------------------------------------------------------------------
  SCRAPER: {
    /**
     * Emitted by the orchestrator bridge to trigger a new scrape job.
     * Payload: url (string)
     */
    START: 'scraper.start',

    /**
     * Emitted by the scraper after text is successfully extracted from a page.
     * Payload: { url: string, text: string }
     */
    SUCCESS: 'scraper.success',

    /**
     * Emitted by the scraper when navigation or extraction fails.
     * Payload: { url: string, reason: string }
     * Reserved for consumers that need to react specifically to scrape failures
     * (e.g. a retry queue) without filtering the generic SYSTEM.ERROR stream.
     */
    FAILED: 'scraper.failed',
  },

  // ---------------------------------------------------------------------------
  // ANALYZER — Gemini AI evaluation lifecycle
  // ---------------------------------------------------------------------------
  ANALYZER: {
    /**
     * Emitted when Gemini confirms all hard eligibility requirements are met.
     * Payload: { url: string, ai_data: object }
     */
    MATCH_FOUND: 'analyzer.match_found',

    /**
     * Emitted when Gemini determines the scholarship does not meet the criteria.
     * Payload: { url: string, ai_data: object }
     * Reserved for consumers that audit or count non-matches (e.g. metrics).
     */
    NO_MATCH: 'analyzer.no_match',
  },

  // ---------------------------------------------------------------------------
  // NOTIFIER — outbound delivery
  // ---------------------------------------------------------------------------
  NOTIFIER: {
    /**
     * Emitted by the Dispatcher with a fully-formatted message string.
     * The WhatsApp listener consumes this and calls client.sendMessage().
     * Payload: formattedMessage (string)
     */
    SEND: 'notifier.send',
  },
});

module.exports = EVENTS;