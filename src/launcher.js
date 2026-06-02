'use strict';

require('dotenv').config();

const broker = require('./queue/broker');
const { PipelineOrchestrator } = require('./core/pipeline');
const { initialize: initializeRegistry } = require('./config/plugins.registry');

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

  console.log('[Launcher] Launching dynamic pipeline instance...');
  console.log(`  Template  : ${template}`);
  console.log(`  Instance  : ${instance}`);
  console.log(`  Session ID: ${sessionId || 'default'}`);
  console.log(`  Channels  : ${channels || 'None (watch all)'}`);
  console.log(`  Phone     : ${phone || 'Default'}`);
  console.log('');

  initializeRegistry();

  const orchestrator = new PipelineOrchestrator(broker);

  // Load template from pipelines directory
  const pipelinePath = `./pipelines/${template}.yaml`;
  orchestrator.loadPipelineFromYAML(pipelinePath);

  // Parse allowed channels
  const allowedChannels = channels
    ? channels.split(',').map((c) => c.trim()).filter(Boolean)
    : [];

  const customConfig = {
    listen: {
      sessionId: sessionId || 'default',
      allowedChannels: allowedChannels,
      sourceMode: allowedChannels.length > 0 ? 'both' : 'chats',
    },
    notify: {
      sessionId: sessionId || 'default',
      phoneNumber: phone || undefined,
    },
  };

  await orchestrator.initializePipeline(template, customConfig, instance);
  orchestrator.wirePipelineEvents(template, instance);

  console.log(`[Launcher] Pipeline instance ${instance} is running.`);
}

launch().catch((err) => {
  console.error('[Launcher] Fatal error:', err.message);
  process.exit(1);
});
