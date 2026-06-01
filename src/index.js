'use strict';

require('dotenv').config();

const os = require('os');
const broker = require('./queue/broker');
const EVENTS = require('./config/constants/events');
const { initWhatsAppListener }   = require('./services/listener/whatsapp');
const { initPuppeteerScraper }   = require('./services/scraper/puppeteer');
const { initGeminiAnalyzer }     = require('./services/analyzer/gemini');
const { initNotifierDispatcher } = require('./services/notifier/dispatcher');

function detectAndConfigureHardware() {
  const platform = os.platform();
  const arch     = os.arch();
  const cpus     = os.cpus();
  const model    = cpus.length > 0 ? cpus[0].model : 'unknown CPU';

  console.log(`[Boot] Host  : ${os.hostname()}`);
  console.log(`[Boot] CPU   : ${model} (${os.cpus().length} core(s), ${arch})`);
  console.log(`[Boot] RAM   : ${(os.totalmem() / 1024 ** 3).toFixed(1)} GB total`);
  console.log(`[Boot] OS    : ${platform} ${os.release()}`);

  if (platform === 'linux' && arch.includes('arm')) {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
    console.log('[Boot] Raspberry Pi detected — Puppeteer → /usr/bin/chromium-browser');
  } else {
    console.log('[Boot] Non-ARM host — Puppeteer will use its bundled Chromium.');
  }
}

function wireEventBridges() {
  broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, (url) => {
    console.log(`[Bridge] LINK_EXTRACTED → SCRAPER.START  (${url})`);
    broker.emit(EVENTS.SCRAPER.START, url);
  });

  console.log('[Boot] Event bridges wired.');
}

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

function registerShutdownHandlers() {
  const onShutdown = (signal) => {
    console.log(`\n[Noria] ${signal} received — shutting down gracefully...`);
    console.log('[Noria] Goodbye.\n');
    process.exit(0);
  };

  process.on('SIGINT',  () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
}

function boot() {
  const bar = '─'.repeat(54);
  console.log(`\n${bar}`);
  console.log('  NORIA — 24/7 Event-Driven Telemetry Pipeline');
  console.log(`  ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}  (Asia/Karachi)`);
  console.log(`${bar}\n`);

  detectAndConfigureHardware();
  console.log('');

  try {
    registerProcessSafetyNets();
    registerShutdownHandlers();
    console.log('[Boot] Process safety nets registered.');

    initNotifierDispatcher(broker);
    initGeminiAnalyzer(broker);
    initPuppeteerScraper(broker);
    console.log('');

    wireEventBridges();
    console.log('');

    initWhatsAppListener(broker);
    console.log('');

    broker.emit(EVENTS.SYSTEM.BOOTED);

  } catch (err) {
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source:  'Orchestrator:boot',
      message: err.message,
      stack:   err.stack,
    });
    process.exit(1);
  }
}

boot();