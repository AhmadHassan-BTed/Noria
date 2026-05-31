'use strict';

const EventEmitter = require('events');
const EVENTS = require('../config/constants/events');

// =============================================================================
// NoriaBroker
// =============================================================================
// A named subclass of EventEmitter that acts as the sole communication channel
// between every decoupled service in the pipeline.
//
// Singleton rationale:
//   All services share one broker instance imported from this module.  Because
//   Node.js caches require() calls, the first import creates the instance and
//   every subsequent require('./queue/broker') receives the same object.  This
//   guarantees that an event emitted in one service is visible to listeners
//   registered in all other services.
//
// Responsibilities of this class (and nothing more):
//   1. Raise the listener cap to silence false-positive memory-leak warnings.
//   2. Intercept SYSTEM.ERROR globally so no failure is ever silently swallowed.
//   3. Acknowledge SYSTEM.BOOTED with the startup banner.
//
// What this class deliberately does NOT do:
//   • Route, filter, or transform events — that belongs in the orchestrator.
//   • Hold application state — services own their own state.
//   • Import or reference any service — that would re-introduce coupling.
// =============================================================================

class NoriaBroker extends EventEmitter {
  constructor() {
    super();

    // -------------------------------------------------------------------------
    // Raise the default listener cap (10).
    // With 4 services + the orchestrator bridge + future extensions, we easily
    // exceed 10 listeners on busy events like SYSTEM.ERROR.  A generous ceiling
    // prevents Node.js from flooding stderr with MaxListenersExceededWarning
    // messages that would obscure real errors.
    // -------------------------------------------------------------------------
    this.setMaxListeners(30);

    this._bindSystemHandlers();
  }

  // ---------------------------------------------------------------------------
  // Private — only called once from the constructor
  // ---------------------------------------------------------------------------

  _bindSystemHandlers() {
    // ── SYSTEM.ERROR ───────────────────────────────────────────────────────
    // Global fault sink.  Every service emits here on catch; this handler
    // guarantees those payloads surface as formatted console output.
    //
    // IMPORTANT: Never emit EVENTS.SYSTEM.ERROR from within this handler.
    // Doing so would create an infinite recursive loop.
    // ──────────────────────────────────────────────────────────────────────
    this.on(EVENTS.SYSTEM.ERROR, (payload) => {
      // Normalise: accept both plain Error objects and structured payloads
      if (payload instanceof Error) {
        payload = {
          source:  'uncaught',
          message: payload.message,
          stack:   payload.stack,
        };
      }

      const {
        source  = 'unknown',
        url,
        message = 'No message provided.',
        stack,
      } = payload ?? {};

      const bar = '═'.repeat(52);

      console.error(`\n╔${bar}╗`);
      console.error(`║  🔴 SYSTEM ERROR                                   ║`);
      console.error(`╠${bar}╣`);
      console.error(`║  Source  : ${source.padEnd(40)} ║`);

      if (url) {
        // Truncate long URLs so the box stays aligned
        const truncated = url.length > 40 ? `${url.slice(0, 37)}...` : url;
        console.error(`║  URL     : ${truncated.padEnd(40)} ║`);
      }

      // Word-wrap message at 40 chars so it fits inside the box
      const words = message.split(' ');
      let line = '';
      const messageLines = [];
      for (const word of words) {
        if ((line + word).length > 40) { messageLines.push(line.trimEnd()); line = ''; }
        line += `${word} `;
      }
      if (line.trim()) messageLines.push(line.trimEnd());

      messageLines.forEach((ml, i) => {
        const label = i === 0 ? 'Message' : '       ';
        console.error(`║  ${label} : ${ml.padEnd(40)} ║`);
      });

      // Stack traces are verbose; print them only outside production
      if (stack && process.env.NODE_ENV !== 'production') {
        console.error(`╠${bar}╣`);
        console.error(`║  Stack (dev only):                                  ║`);
        stack.split('\n').slice(0, 6).forEach((sl) => {
          const trimmed = sl.trim().slice(0, 50);
          console.error(`║    ${trimmed.padEnd(48)} ║`);
        });
      }

      console.error(`╚${bar}╝\n`);
    });

    // ── SYSTEM.BOOTED ──────────────────────────────────────────────────────
    // Prints the startup success banner.  Kept here (rather than in index.js)
    // so the visual is driven by the event itself — a self-describing system.
    // ──────────────────────────────────────────────────────────────────────
    this.on(EVENTS.SYSTEM.BOOTED, () => {
      const bar = '═'.repeat(52);
      console.log(`\n╔${bar}╗`);
      console.log(`║                                                    ║`);
      console.log(`║   🌊  NORIA  —  Telemetry Pipeline                 ║`);
      console.log(`║        All services nominal.  Pipeline live.       ║`);
      console.log(`║                                                    ║`);
      console.log(`╚${bar}╝\n`);
    });
  }
}

// =============================================================================
// Singleton export
// =============================================================================
// Node.js caches this module after the first require(), so this single
// NoriaBroker instance is shared by every file that imports this module.
// =============================================================================

const broker = new NoriaBroker();

module.exports = broker;