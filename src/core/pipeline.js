'use strict';

const fs = require('fs');
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
      services.listener = registry.instantiatePlugin(
        'listener',
        pluginName,
        stages.listen.config || {}
      );
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
      services.analyzer = registry.instantiatePlugin(
        'analyzer',
        analyzerName,
        analyzerConfig.config || {}
      );
      services.analyzer.setProvider(services.provider);
    }

    if (stages.notify) {
      const notifierConfig = stages.notify;
      const notifierName = notifierConfig.plugin || notifierConfig;
      services.notifier = registry.instantiatePlugin(
        'notifier',
        notifierName,
        notifierConfig.config || {}
      );
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

    // 1. Listen stage triggers scraper:start
    if (services.listener) {
      services.listener.on('link_extracted', (url) => {
        this.broker.emit(EventTypes.SCRAPER.START, {
          pipelineName,
          provider,
          url,
        });
      });
    }

    // 2. Handle scraper:start
    this.broker.on(EventTypes.SCRAPER.START, async (event) => {
      // If the event is not for this pipeline, ignore
      if (event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url } = event;
      console.log(`[Pipeline:${pipelineName}] Starting scraper for URL: ${url}`);

      try {
        // A. Caching Check (Deduplication)
        const { urlCache } = require('../utils/cache');
        if (urlCache.has(url)) {
          console.log(`[Pipeline:${pipelineName}] URL already processed (Cache hit): ${url}`);
          return;
        }

        // B. Scraper execution (Primary with Fallback)
        let scrapedData;
        try {
          if (services.primaryScraper) {
            scrapedData = await services.primaryScraper.scrape(url);
          }
        } catch (primaryErr) {
          console.warn(
            `[Pipeline:${pipelineName}] Primary scraper failed: ${primaryErr.message}. Trying fallback...`
          );
          if (services.fallbackScraper) {
            scrapedData = await services.fallbackScraper.scrape(url);
          } else {
            throw primaryErr;
          }
        }

        if (!scrapedData || !scrapedData.text) {
          throw new Error('Scraper failed to extract any content.');
        }

        // C. Validate scraper payload
        const { validateScraperPayload } = require('../utils/validators');
        const validatedPayload = validateScraperPayload({ url, text: scrapedData.text });

        // Add to cache to prevent duplicate evaluations
        urlCache.set(url, true);

        // Emit SCRAPER.SUCCESS
        this.broker.emit(EventTypes.SCRAPER.SUCCESS, { pipelineName, url });

        // Trigger Analyzer stage
        this.broker.emit(EventTypes.ANALYZER.START, {
          pipelineName,
          provider,
          url,
          text: validatedPayload.text,
        });
      } catch (err) {
        console.error(`[Pipeline:${pipelineName}] Scrape stage failed:`, err.message);
        this.broker.emit(EventTypes.SCRAPER.FAILED, { pipelineName, url, error: err.message });
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `scraper:${pipelineName}`,
          url,
          message: err.message,
          stack: err.stack,
        });
      }
    });

    // 3. Handle analyzer:start
    this.broker.on(EventTypes.ANALYZER.START, async (event) => {
      if (event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url, text } = event;
      console.log(`[Pipeline:${pipelineName}] Starting analyzer for URL: ${url}`);

      try {
        if (!services.analyzer) {
          throw new Error('Analyzer service not registered for this pipeline.');
        }

        // A. Analyze the content using the active analyzer plugin
        const validatedResponse = await services.analyzer.analyze(text, { url });

        // Add original URL to results
        validatedResponse.url = url;

        console.log(
          `[Pipeline:${pipelineName}] Analysis match score: ${validatedResponse.match_score}`
        );

        if (validatedResponse.match_score >= 50) {
          this.broker.emit(EventTypes.ANALYZER.MATCH_FOUND, {
            pipelineName,
            provider,
            url,
            result: validatedResponse,
          });
        } else {
          this.broker.emit(EventTypes.ANALYZER.NO_MATCH, {
            pipelineName,
            provider,
            url,
            result: validatedResponse,
          });
        }
      } catch (err) {
        console.error(`[Pipeline:${pipelineName}] Analyze stage failed:`, err.message);
        this.broker.emit(EventTypes.ANALYZER.FAILED, { pipelineName, url, error: err.message });
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `analyzer:${pipelineName}`,
          url,
          message: err.message,
          stack: err.stack,
        });
      }
    });

    // 4. Handle analyzer:match_found
    this.broker.on(EventTypes.ANALYZER.MATCH_FOUND, async (event) => {
      if (event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url, result } = event;
      console.log(`[Pipeline:${pipelineName}] Match found! Preparing notification...`);

      try {
        if (!services.notifier) {
          throw new Error('Notifier service not registered for this pipeline.');
        }

        // A. Format the message
        const message = services.notifier.format(result);

        // B. Send notification using the dynamic, configured notifier plugin instance
        await services.notifier.send(pipelineConfig.stages.notify.config.phoneNumber, message);

        this.broker.emit(EventTypes.NOTIFIER.SEND, { pipelineName, url });
        console.log(`[Pipeline:${pipelineName}] Notification sent successfully!`);
      } catch (err) {
        console.error(`[Pipeline:${pipelineName}] Notify stage failed:`, err.message);
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `notifier:${pipelineName}`,
          url,
          message: err.message,
          stack: err.stack,
        });
      }
    });

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
    for (const [, services] of this.activeServices.entries()) {
      if (services.listener && typeof services.listener.close === 'function') {
        await services.listener.close();
      }
    }
    console.log('[Pipeline] All pipelines shut down');
  }
}

module.exports = { PipelineOrchestrator };
