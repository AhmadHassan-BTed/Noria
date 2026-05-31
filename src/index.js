'use strict';

// =============================================================================
// 0.  Environment  —  MUST be the very first statement.
// =============================================================================
// dotenv.config() writes .env values into process.env before any service
// module is required.  If this call were deferred, modules that read
// process.env at require-time (e.g. the Gemini API key check) would find
// undefined and throw before the application has a chance to start cleanly.
// =============================================================================
require('dotenv').config();

const os = require('os');

// =============================================================================
// 1.  Infrastructure  (no side-effects on import)
// =============================================================================
const broker = require('./queue/broker');
const EVENTS = require('./config/constants/events');

// =============================================================================
// 2.  Service layer  (import init functions; nothing starts yet)
// =============================================================================
const { initWhatsAppListener }   = require('./services/listener/whatsapp');
const { initPuppeteerScraper }   = require('./services/scraper/puppeteer');
const { initGeminiAnalyzer }     = require('./services/analyzer/gemini');
const { initNotifierDispatcher } = require('./services/notifier/dispatcher');

// =============================================================================
// 3.  Hardware detection
// =============================================================================

/**
 * Detects whether the process is running on a Raspberry Pi (Linux + ARM) and,
 * if so, points Puppeteer at the system-installed Chromium binary rather than
 * the bundled one — which either doesn't exist or won't run on that architecture.
 *
 * Setting the env variable here (before puppeteer is ever launched) is safe
 * because Puppeteer reads PUPPETEER_EXECUTABLE_PATH at launch time, not at
 * require time.
 */
function detectAndConfigureHardware() {
  const platform = os.platform();
  const arch     = os.arch();
  const cpus     = os.cpus();
  const model    = cpus.length > 0 ? cpus[0].model : 'unknown CPU';

  console.log(`[Boot] 🖥️  Host  : ${os.hostname()}`);
  console.log(`[Boot] ⚙️  CPU   : ${model} (${os.cpus().length} core(s), ${arch})`);
  console.log(`[Boot] 💾  RAM   : ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB total`);
  console.log(`[Boot] 🐧  OS    : ${platform} ${os.release()}`);

  if (platform === 'linux' && arch.includes('arm')) {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
    console.log('[Boot] 🍓  Raspberry Pi detected — Puppeteer → /usr/bin/chromium-browser');
  } else {
    console.log('[Boot] 💻  Non-ARM host — Puppeteer will use its bundled Chromium.');
  }
}

// =============================================================================
// 4.  Event bridges  (orchestrator-owned routing logic)
// =============================================================================

/**
 * Wires the single routing rule that cannot live inside any individual service
 * without breaking the 0%-coupling constraint.
 *
 * Rule:  WHATSAPP.LINK_EXTRACTED  →  SCRAPER.START
 *
 * Why here and not inside whatsapp.js or puppeteer.js?
 *   If whatsapp.js emitted SCRAPER.START directly it would implicitly know
 *   that a scraper service exists — a coupling violation.
 *   If puppeteer.js listened for LINK_EXTRACTED it would know it's downstream
 *   of a WhatsApp listener — also a coupling violation.
 *   The orchestrator is the only layer whose job IS to know the full topology,
 *   so it owns these routing rules exclusively.
 *
 * Future extensions: add additional bridge rules here, never inside services.
 */
function wireEventBridges() {
  // Bridge: URL extracted from a WhatsApp message → kick off a scrape job
  broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, (url) => {
    console.log(`[Bridge] 🔀  LINK_EXTRACTED → SCRAPER.START  (${url})`);
    broker.emit(EVENTS.SCRAPER.START, url);
  });

  console.log('[Boot] 🔌  Event bridges wired.');
}

// =============================================================================
// 5.  Process-level safety nets
// =============================================================================

/**
 * Registers handlers for uncaught exceptions and unhandled promise rejections.
 * These are the absolute last line of defence — errors that escaped every
 * service-level try/catch block.  They are funnelled into SYSTEM.ERROR so the
 * broker's global handler formats and surfaces them consistently.
 *
 * NOTE: After logging, the process exits.  Attempting to continue after an
 * uncaught exception leaves the application in an undefined state, which is
 * more dangerous than restarting cleanly (use a process manager like pm2 or
 * systemd to auto-restart on exit code 1).
 */
function registerProcessSafetyNets() {
  process.on('uncaughtException', (err) => {
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source:  'process:uncaughtException',
      message: err.message,
      stack:   err.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const isError = reason instanceof Error;
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source:  'process:unhandledRejection',
      message: isError ? reason.message : String(reason),
      stack:   isError ? reason.stack   : undefined,
    });
    process.exit(1);
  });
}

// =============================================================================
// 6.  Graceful shutdown
// =============================================================================

/**
 * Registers handlers for OS termination signals.
 *
 * SIGINT  — Ctrl-C in a terminal session.
 * SIGTERM — Sent by systemd, Docker, pm2, or Kubernetes when stopping the
 *           container / service unit.  Without this handler, Docker would
 *           wait 10 seconds then force-kill the process (SIGKILL), leaving
 *           the WhatsApp session file in a potentially corrupt state.
 *
 * The handler logs a farewell message and exits cleanly (code 0), which
 * signals the process manager that this was an intentional stop, not a crash.
 */
function registerShutdownHandlers() {
  const onShutdown = (signal) => {
    console.log(`\n[Noria] 🛑  ${signal} received — shutting down gracefully...`);
    console.log('[Noria]    Goodbye.\n');
    process.exit(0);
  };

  process.on('SIGINT',  () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
}

// =============================================================================
// 7.  Boot sequence
// =============================================================================

/**
 * Orchestrates the full startup of the Noria pipeline.
 *
 * Initialization order matters:
 *   Services are started back-to-front through the pipeline so that every
 *   downstream listener is registered before any upstream service could
 *   theoretically emit.  In practice, WhatsApp takes several seconds to
 *   connect, so a race condition is extremely unlikely — but defensive
 *   ordering is free and correct.
 *
 *   Dispatcher  (last consumer)     ← registers first
 *   Analyzer                        ← registers second
 *   Scraper                         ← registers third
 *   Event bridges                   ← wired before WhatsApp starts
 *   WhatsApp listener               ← starts the async auth/connect flow last
 *
 * The try/catch converts any synchronous startup failure (e.g. a missing
 * GEMINI_API_KEY that causes initGeminiAnalyzer to throw) into a SYSTEM.ERROR
 * event before terminating, ensuring the error is visible through the same
 * formatted channel as all other faults.
 */
function boot() {
  const bar = '─'.repeat(54);
  console.log(`\n${bar}`);
  console.log('  🌊  NORIA  —  24/7 Event-Driven Telemetry Pipeline');
  console.log(`  📅  ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}  (Asia/Karachi)`);
  console.log(`${bar}\n`);

  // ── Hardware & environment ─────────────────────────────────────────────
  detectAndConfigureHardware();
  console.log('');

  try {
    // ── Safety nets (registered before anything can fail) ───────────────
    registerProcessSafetyNets();
    registerShutdownHandlers();
    console.log('[Boot] 🛡️   Process safety nets registered.');

    // ── Service initialisation (back-to-front pipeline order) ───────────
    initNotifierDispatcher(broker);  // stage 4 of 4 — listens for MATCH_FOUND
    initGeminiAnalyzer(broker);      // stage 3 of 4 — listens for SCRAPER.SUCCESS
    initPuppeteerScraper(broker);    // stage 2 of 4 — listens for SCRAPER.START
    console.log('');

    // ── Orchestrator routing rules ───────────────────────────────────────
    wireEventBridges();
    console.log('');

    // ── Trigger service (starts the async WhatsApp auth/connect flow) ────
    initWhatsAppListener(broker);    // stage 1 of 4 — emits LINK_EXTRACTED
    console.log('');

    // ── Signal that all synchronous setup is complete ────────────────────
    // Note: WHATSAPP.READY will fire later, asynchronously, once the
    // WhatsApp socket handshake completes. SYSTEM.BOOTED means "all service
    // listeners are in place and the pipeline is accepting events."
    broker.emit(EVENTS.SYSTEM.BOOTED);

  } catch (err) {
    // A synchronous throw during initialisation (e.g. missing API key)
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source:  'Orchestrator:boot',
      message: err.message,
      stack:   err.stack,
    });
    // Exit with a non-zero code so process managers know to restart
    process.exit(1);
  }
}

// =============================================================================
// Entry point
// =============================================================================
boot();