'use strict';

require('dotenv').config();

const broker = require('./queue/broker');
const { config } = require('./config');
const { PipelineOrchestrator } = require('./core/pipeline');
const { initialize: initializeRegistry } = require('./config/plugins.registry');
const { metrics } = require('./utils/metrics');
const { dlq } = require('./utils/queue');
const { EventTypes } = require('./core/events');

function displayBootBanner() {
  const bar = '─'.repeat(70);
  console.log(`\n${bar}`);
  console.log('  NORIA v2 — Modern Event-Driven Pipeline Architecture');
  console.log(
    `  ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}  (Asia/Karachi)`
  );
  console.log(`${bar}\n`);
}

function displaySystemInfo() {
  const system = config.getSystem();
  console.log('[Boot] System Information:');
  console.log(`  Host     : ${system.hostname}`);
  console.log(`  CPU      : ${system.cpus} cores (${system.arch})`);
  console.log(`  RAM      : ${system.totalMemory} GB`);
  console.log(`  Platform : ${system.platform}`);
  console.log('');
}

function registerProcessHandlers() {
  process.on('uncaughtException', (err) => {
    broker.emit(EventTypes.SYSTEM.ERROR, {
      source: 'process:uncaughtException',
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    const isError = reason instanceof Error;
    broker.emit(EventTypes.SYSTEM.ERROR, {
      source: 'process:unhandledRejection',
      message: isError ? reason.message : String(reason),
      stack: isError ? reason.stack : undefined,
    });
    process.exit(1);
  });

  const onShutdown = (signal) => {
    console.log(`\n[Noria] ${signal} received — shutting down gracefully...`);
    dlq.stop();
    console.log('[Noria] Goodbye.\n');
    process.exit(0);
  };

  process.on('SIGINT', () => onShutdown('SIGINT'));
  process.on('SIGTERM', () => onShutdown('SIGTERM'));
}

function startMetricsReporter() {
  setInterval(() => {
    console.log(metrics.getReport());
  }, 60000);
  console.log('[Boot] Metrics reporter started (every 60s)\n');
}

async function boot() {
  try {
    displayBootBanner();
    displaySystemInfo();

    config.validate();
    registerProcessHandlers();

    console.log('[Boot] Initializing plugin registry...');
    initializeRegistry();
    console.log('');

    const orchestrator = new PipelineOrchestrator(broker);

    console.log('[Boot] Loading pipeline configurations...');
    const activePipelines = config.get('ACTIVE_PIPELINES', ['scholarships']);

    for (const pipelineName of activePipelines) {
      const pipelinePath = `./pipelines/${pipelineName}.yaml`;
      try {
        orchestrator.loadPipelineFromYAML(pipelinePath);
      } catch (err) {
        console.warn(`[Boot] Failed to load pipeline ${pipelineName}:`, err.message);
      }
    }
    console.log('');

    console.log('[Boot] Initializing pipelines...');
    for (const pipelineName of orchestrator.getAllPipelines()) {
      await orchestrator.initializePipeline(pipelineName);
    }
    console.log('');

    console.log('[Boot] Wiring pipeline events...');
    for (const pipelineName of orchestrator.getAllPipelines()) {
      orchestrator.wirePipelineEvents(pipelineName);
    }
    console.log('');

    if (config.get('ENABLE_QUEUE_RETRY', true)) {
      dlq.start((url, attempt) => {
        console.log(`[Queue] Retrying failed URL (attempt ${attempt}): ${url}`);
        broker.emit(EventTypes.SCRAPER.START, { url });
      });
      console.log('');
    }

    startMetricsReporter();

    broker.emit(EventTypes.SYSTEM.BOOTED, {
      pipelines: orchestrator.getAllPipelines(),
      pluginsLoaded: orchestrator.getAllPipelines().length,
    });
  } catch (err) {
    console.error('[Boot] Fatal error:', err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

boot();
