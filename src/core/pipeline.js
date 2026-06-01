'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { registry } = require('./registry');
const { EventTypes } = require('./events');

class PipelineOrchestrator {
  constructor(broker) {
    this.broker = broker;
    this.pipelines = new Map();
    this.activeServices = new Map();
  }

  loadPipelineFromYAML(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = yaml.load(fileContent);

      if (!config.name) {
        throw new Error('Pipeline must have a name');
      }

      if (!config.provider) {
        throw new Error('Pipeline must specify a provider');
      }

      if (!config.stages) {
        throw new Error('Pipeline must have stages');
      }

      this.pipelines.set(config.name, config);
      console.log(`[Pipeline] Loaded: ${config.name} (${filePath})`);
      return config;
    } catch (err) {
      throw new Error(`Failed to load pipeline from ${filePath}: ${err.message}`);
    }
  }

  loadPipelineFromObject(config) {
    if (!config.name || !config.provider || !config.stages) {
      throw new Error('Invalid pipeline config structure');
    }

    this.pipelines.set(config.name, config);
    console.log(`[Pipeline] Loaded: ${config.name}`);
    return config;
  }

  async initializePipeline(pipelineName) {
    const pipelineConfig = this.pipelines.get(pipelineName);
    if (!pipelineConfig) {
      throw new Error(`Pipeline not found: ${pipelineName}`);
    }

    console.log(`[Pipeline] Initializing: ${pipelineName}`);

    const services = {};
    const providerName = pipelineConfig.provider;

    services.provider = registry.instantiateProvider(providerName, pipelineConfig.config || {});

    const stages = pipelineConfig.stages;

    if (stages.listen) {
      const pluginName = stages.listen.plugin || stages.listen;
      services.listener = registry.instantiatePlugin('listener', pluginName, stages.listen.config || {});
      await services.listener.initialize();
    }

    if (stages.scrape) {
      const scrapeConfig = stages.scrape;
      const primaryScraperName = scrapeConfig.primary || scrapeConfig;
      const fallbackScraperName = scrapeConfig.fallback;

      services.primaryScraper = registry.instantiatePlugin('scraper', primaryScraperName, {});

      if (fallbackScraperName) {
        services.fallbackScraper = registry.instantiatePlugin('scraper', fallbackScraperName, {});
      }
    }

    if (stages.analyze) {
      const analyzerConfig = stages.analyze;
      const analyzerName = analyzerConfig.plugin || analyzerConfig;
      services.analyzer = registry.instantiatePlugin('analyzer', analyzerName, analyzerConfig.config || {});
      services.analyzer.setProvider(services.provider);
    }

    if (stages.notify) {
      const notifierConfig = stages.notify;
      const notifierName = notifierConfig.plugin || notifierConfig;
      services.notifier = registry.instantiatePlugin('notifier', notifierName, notifierConfig.config || {});
      services.notifier.setProvider(services.provider);
    }

    this.activeServices.set(pipelineName, services);
    console.log(`[Pipeline] Initialized: ${pipelineName}`);
    return services;
  }

  wirePipelineEvents(pipelineName) {
    const pipelineConfig = this.pipelines.get(pipelineName);
    const services = this.activeServices.get(pipelineName);

    if (!pipelineConfig || !services) {
      throw new Error(`Pipeline not ready: ${pipelineName}`);
    }

    const provider = pipelineConfig.provider;

    if (services.listener) {
      services.listener.on('link_extracted', (url) => {
        this.broker.emit(EventTypes.SCRAPER.START, {
          provider,
          url,
        });
      });
    }

    console.log(`[Pipeline] Events wired: ${pipelineName}`);
  }

  getService(pipelineName, serviceName) {
    const services = this.activeServices.get(pipelineName);
    if (!services) {
      throw new Error(`Pipeline not initialized: ${pipelineName}`);
    }

    return services[serviceName];
  }

  getAllPipelines() {
    return Array.from(this.pipelines.keys());
  }

  async shutdown() {
    for (const [name, services] of this.activeServices.entries()) {
      if (services.listener && typeof services.listener.close === 'function') {
        await services.listener.close();
      }
    }
    console.log('[Pipeline] All pipelines shut down');
  }
}

module.exports = { PipelineOrchestrator };
