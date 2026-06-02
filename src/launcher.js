'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const broker = require('./queue/broker');
const { PipelineOrchestrator } = require('./core/pipeline');
const { initialize: initializeRegistry } = require('./config/plugins.registry');

// =============================================================================
// Global Error Handlers - Write DISCONNECTED status on any crash
// =============================================================================

let currentSessionId = null;

// =============================================================================
// Global Console Redirects — Intercepts all stdout/stderr and routes them to session logs
// =============================================================================
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function writeToLogFile(level, ...args) {
  if (!currentSessionId) return;
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const logPath = path.join(dataDir, `logs-${currentSessionId}.log`);
    const ts = new Date().toISOString();
    const message = args.map(arg => {
      if (arg instanceof Error) return arg.stack;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return String(arg); }
      }
      return String(arg);
    }).join(' ');
    
    fs.appendFileSync(logPath, `[${ts}] [${level}] ${message}\n`);
  } catch (err) {
    // Fail-safe to avoid loops
  }
}

console.log = (...args) => {
  originalLog.apply(console, args);
  writeToLogFile('INFO', ...args);
};

console.warn = (...args) => {
  originalWarn.apply(console, args);
  writeToLogFile('WARN', ...args);
};

console.error = (...args) => {
  originalError.apply(console, args);
  writeToLogFile('ERROR', ...args);
};

function writeDisconnectStatus(reason) {
  if (!currentSessionId) return;
  
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const statusPath = path.join(dataDir, `status-${currentSessionId}.json`);
    fs.writeFileSync(statusPath, JSON.stringify({
      status: 'DISCONNECTED',
      reason: reason,
      timestamp: new Date().toISOString()
    }));
    
    console.error(`[Launcher] Wrote DISCONNECTED status for session ${currentSessionId}`);
  } catch (err) {
    console.error(`[Launcher] Failed to write disconnect status: ${err.message}`);
  }
}

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[Launcher] ❌ UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  writeDisconnectStatus(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = reason instanceof Error ? reason.message : String(reason);
  console.error('[Launcher] ❌ UNHANDLED REJECTION:', errorMsg);
  if (reason instanceof Error) {
    console.error(reason.stack);
  }
  writeDisconnectStatus(`Unhandled rejection: ${errorMsg}`);
  process.exit(1);
});

// Catch SIGTERM/SIGINT gracefully
process.on('SIGTERM', () => {
  console.log('[Launcher] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Launcher] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// =============================================================================
// Main Launch Function
// =============================================================================

async function launch() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const value = process.argv[i + 1];
      args[name] = value;
      i++;
    }
  }

  const { template, instance, sessionId, channels, phone } = args;

  if (!template || !instance) {
    console.error('Usage: node src/launcher.js --template <name> --instance <id> [--sessionId <id>] [--channels <list>] [--phone <num>]');
    process.exit(1);
  }

  // Set session ID for error handlers
  currentSessionId = sessionId || 'default';

  console.log('[Launcher] 🚀 Launching dynamic pipeline instance...');
  console.log(`  Template  : ${template}`);
  console.log(`  Instance  : ${instance}`);
  console.log(`  Session ID: ${currentSessionId}`);
  console.log(`  Channels  : ${channels || 'None (watch all)'}`);
  console.log(`  Phone     : ${phone || 'Default'}`);
  console.log('');

  try {
    initializeRegistry();
    console.log('[Launcher] ✅ Plugin registry initialized');
  } catch (err) {
    console.error('[Launcher] ❌ Failed to initialize registry:', err.message);
    writeDisconnectStatus(`Registry init failed: ${err.message}`);
    process.exit(1);
  }

  const orchestrator = new PipelineOrchestrator(broker);

  // Load template from pipelines directory
  const pipelinePath = `./pipelines/${template}.yaml`;
  let config;
  try {
    config = orchestrator.loadPipelineFromYAML(pipelinePath);
    console.log(`[Launcher] ✅ Pipeline config loaded from ${pipelinePath}`);
  } catch (err) {
    console.error('[Launcher] ❌ Failed to load pipeline config:', err.message);
    writeDisconnectStatus(`Config load failed: ${err.message}`);
    process.exit(1);
  }

  // Parse allowed channels
  const allowedChannels = channels
    ? channels.split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  const customConfig = {
    listen: {
      sessionId: currentSessionId,
      allowedChannels: allowedChannels,
      sourceMode: allowedChannels.length > 0 ? 'both' : 'chats',
    },
    notify: {
      sessionId: currentSessionId,
      phoneNumber: phone || undefined,
    },
  };

  try {
    console.log('[Launcher] ⏳ Initializing pipeline...');
    await orchestrator.initializePipeline(config.name, customConfig, instance);
    console.log('[Launcher] ✅ Pipeline initialized');
  } catch (err) {
    console.error('[Launcher] ❌ Pipeline initialization failed:', err.message);
    console.error(err.stack);
    writeDisconnectStatus(`Pipeline init failed: ${err.message}`);
    process.exit(1);
  }

  try {
    orchestrator.wirePipelineEvents(config.name, instance);
    console.log('[Launcher] ✅ Pipeline events wired');
  } catch (err) {
    console.error('[Launcher] ❌ Failed to wire pipeline events:', err.message);
    writeDisconnectStatus(`Event wiring failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`[Launcher] 🎉 Pipeline instance ${instance} is running.`);
  console.log('[Launcher] Waiting for WhatsApp connection...');
}

// Run with comprehensive error handling
launch().catch((err) => {
  console.error('[Launcher] ❌ Fatal error in launch():', err.message);
  console.error(err.stack);
  writeDisconnectStatus(`Fatal launch error: ${err.message}`);
  process.exit(1);
});
