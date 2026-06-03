'use strict';

/**
 * Core — Pipeline Orchestrator (Data-Coupling)
 *
 * The central nervous system of Noria. Reads pipeline YAML configs,
 * resolves domain modules and infrastructure adapters from the registry,
 * and wires event-driven data flow between them.
 *
 * KEY ARCHITECTURAL RULES:
 *   • NO class instances are passed between stages.
 *   • NO setProvider() calls anywhere.
 *   • Every inter-stage communication is via plain data (strings, JSON objects).
 *   • The flow reads like an intuitive, procedural story.
 */

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
      let fileContent = fs.readFileSync(filePath, 'utf8');

      // Interpolate environment variables of the form ${VAR_NAME}
      fileContent = fileContent.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, p1) => {
        return process.env[p1] !== undefined ? process.env[p1] : match;
      });

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

  async initializePipeline(pipelineName, customConfig = {}, instanceId = pipelineName) {
    const pipelineConfig = this.pipelines.get(pipelineName);
    if (!pipelineConfig) {
      throw new Error(`Pipeline not found: ${pipelineName}`);
    }

    console.log(`[Pipeline] Initializing: ${instanceId} (Template: ${pipelineName})`);

    const services = {};
    const providerName = pipelineConfig.provider;

    // ── Resolve domain module (plain object — no class instantiation) ──────
    services.domain = registry.getDomain(providerName);

    const stages = pipelineConfig.stages;

    // ── Listener (the only class-based component) ─────────────────────────
    if (stages.listen) {
      const pluginName = stages.listen.plugin || stages.listen;
      const listenConfig = {
        ...(stages.listen.config || {}),
        ...(customConfig.listen || {}),
      };
      services.listener = registry.createListener(pluginName, listenConfig);
      await services.listener.initialize();
    }

    // ── Scrapers (stateless function modules) ─────────────────────────────
    if (stages.scrape) {
      const scrapeConfig = stages.scrape;
      const primaryScraperName = scrapeConfig.primary || scrapeConfig;
      const fallbackScraperName = scrapeConfig.fallback;

      services.primaryScraper = registry.getAdapter('scraper', primaryScraperName);

      if (fallbackScraperName) {
        services.fallbackScraper = registry.getAdapter('scraper', fallbackScraperName);
      }

      // Resilient fetch is always available as last-resort fallback
      try {
        services.resilientScraper = registry.getAdapter('scraper', 'resilient-fetch');
      } catch {
        // Optional — not all setups register it
      }
    }

    // ── LLM adapter (stateless function module) ───────────────────────────
    if (stages.analyze) {
      const analyzerConfig = stages.analyze;
      const analyzerName = analyzerConfig.plugin || analyzerConfig;

      // Map analyzer plugin name to LLM adapter name
      const llmName = analyzerName.replace('-analyzer', '');
      services.llm = registry.getAdapter('llm', llmName);

      // Store analysis config for later use
      services.llmConfig = {
        model: customConfig.analyze?.model || analyzerConfig.config?.model,
        temperature: customConfig.analyze?.temperature || analyzerConfig.config?.temperature,
      };
    }

    // ── Sender adapter (stateless function module) ────────────────────────
    if (stages.notify) {
      const notifierConfig = stages.notify;
      const notifierName = notifierConfig.plugin || notifierConfig;

      // Map notifier plugin name to sender adapter name
      const senderName = notifierName.replace('-notifier', '-sender');
      services.sender = registry.getAdapter('sender', senderName);

      // Store notification config
      services.notifyConfig = {
        phoneNumber: customConfig.notify?.phoneNumber || notifierConfig.config?.phoneNumber,
        sessionId: customConfig.notify?.sessionId || customConfig.listen?.sessionId || 'default',
      };
    }

    this.activeServices.set(instanceId, services);
    console.log(`[Pipeline] Initialized: ${instanceId}`);
    return services;
  }

  wirePipelineEvents(pipelineName, instanceId = pipelineName) {
    const pipelineConfig = this.pipelines.get(pipelineName);
    const services = this.activeServices.get(instanceId);

    if (!pipelineConfig || !services) {
      throw new Error(`Pipeline not ready: ${instanceId}`);
    }

    const provider = pipelineConfig.provider;

    // ═══════════════════════════════════════════════════════════════════════
    // 1. LISTEN → SCRAPER.START
    //    Listener emits 'link_extracted' → broker emits SCRAPER.START
    // ═══════════════════════════════════════════════════════════════════════
    if (services.listener) {
      services.listener.on('link_extracted', (payload) => {
        const url =
          typeof payload === 'string'
            ? payload
            : payload && typeof payload.url === 'string'
              ? payload.url
              : undefined;

        const messageText =
          payload && typeof payload === 'object' ? payload.messageText : undefined;

        this.broker.emit(EventTypes.SCRAPER.START, {
          pipelineName,
          instanceId,
          provider,
          url,
          messageText,
        });
      });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. SCRAPER.START → Scrape → Analyze → (Match?) → Notify
    //    The entire pipeline stage flow, reading like a procedural story.
    // ═══════════════════════════════════════════════════════════════════════
    this.broker.on(EventTypes.SCRAPER.START, async (event) => {
      // ── Instance gating ─────────────────────────────────────────────────
      if (event.instanceId && event.instanceId !== instanceId) {
        return;
      }
      if (!event.instanceId && event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url, messageText } = event;
      console.log(`[Pipeline:${instanceId}] Starting scraper for URL: ${url}`);

      try {
        // ── A. Cache check (deduplication) ─────────────────────────────────
        const path = require('path');
        const clearCacheFlag = path.join(
          __dirname,
          '..',
          '..',
          'data',
          `clear-cache-${instanceId}.flag`
        );
        const { urlCache } = require('../utils/cache');

        if (fs.existsSync(clearCacheFlag)) {
          console.log(`[Pipeline:${instanceId}] Clear cache flag detected. Clearing URL cache...`);
          urlCache.clear();
          try {
            fs.unlinkSync(clearCacheFlag);
          } catch (err) {
            console.warn(
              `[Pipeline:${instanceId}] Failed to delete clear-cache flag: ${err.message}`
            );
          }
        }

        if (urlCache.has(url)) {
          console.log(`[Pipeline:${instanceId}] URL already processed (Cache hit): ${url}`);
          return;
        }

        // ── B. SCRAPE — Infrastructure call, returns plain data ────────────
        let scrapedData;
        try {
          if (services.primaryScraper) {
            scrapedData = await services.primaryScraper.scrape(url);
          }
        } catch (primaryErr) {
          console.warn(
            `[Pipeline:${instanceId}] Primary scraper failed: ${primaryErr.message}. Trying fallback...`
          );
          try {
            if (services.fallbackScraper) {
              scrapedData = await services.fallbackScraper.scrape(url);
            } else {
              throw primaryErr;
            }
          } catch (fallbackErr) {
            console.warn(
              `[Pipeline:${instanceId}] Fallback scraper failed: ${fallbackErr.message}. Initiating resilient native fetch recovery...`
            );
            try {
              if (services.resilientScraper) {
                scrapedData = await services.resilientScraper.scrape(url);
                console.log(
                  `[Pipeline:${instanceId}] Native fetch recovery completed successfully (${scrapedData.text.length} chars).`
                );
              } else {
                // Inline fallback if resilient-fetch adapter not registered
                const resilientFetch = require('../infrastructure/scraper/resilientFetch');
                scrapedData = await resilientFetch.scrape(url);
                console.log(
                  `[Pipeline:${instanceId}] Native fetch recovery completed successfully (${scrapedData.text.length} chars).`
                );
              }
            } catch (fetchErr) {
              console.error(
                `[Pipeline:${instanceId}] Resilient fetch recovery also failed: ${fetchErr.message}`
              );
              throw fallbackErr;
            }
          }
        }

        if (!scrapedData || !scrapedData.text) {
          throw new Error('Scraper failed to extract any content.');
        }

        // ── C. Validate scraped payload ───────────────────────────────────
        const { validateScraperPayload } = require('../utils/validators');
        const validatedPayload = validateScraperPayload({ url, text: scrapedData.text });

        // Add to cache to prevent duplicate evaluations
        urlCache.set(url, true);

        // Emit SCRAPER.SUCCESS
        this.broker.emit(EventTypes.SCRAPER.SUCCESS, { pipelineName, instanceId, url });

        // ── D. ANALYZE — Domain prompt + Infrastructure LLM ───────────────
        if (!services.llm || !services.domain) {
          throw new Error('LLM adapter or domain module not registered for this pipeline.');
        }

        const { config: appConfig } = require('../config');
        const domain = services.domain;

        // D1. Resolve applicant profile (domain function on plain config data)
        const profile = domain.resolveProfile(appConfig.getAll());

        // D2. Truncate text to LLM-safe length
        const maxTextLength = 15000;
        const safeText = validatedPayload.text.slice(0, maxTextLength);

        // D3. Build the prompt (pure domain function — returns a string)
        const prompt = domain.buildPrompt(safeText, profile, messageText);

        // D4. Call LLM (infrastructure function — returns plain JSON)
        console.log(`[Pipeline:${instanceId}] Starting analyzer for URL: ${url}`);
        const aiData = await services.llm.generateStructuredData(
          prompt,
          domain.schema,
          services.llmConfig || {}
        );

        // D5. Validate AI response
        const { validateAnalyzerResponse } = require('../utils/validators');
        let validatedResponse;
        try {
          validatedResponse = validateAnalyzerResponse(aiData, domain.schema, url);
        } catch (validErr) {
          throw new Error(`Response validation failed: ${validErr.message}`);
        }

        // Add original URL to results
        validatedResponse.url = url;

        console.log(
          `[Pipeline:${instanceId}] Analysis match score: ${validatedResponse.match_score}`
        );

        // ── E. MATCH CHECK — Pure logic on plain data ─────────────────────
        if (validatedResponse.match_score >= 50) {
          this.broker.emit(EventTypes.ANALYZER.MATCH_FOUND, {
            pipelineName,
            instanceId,
            provider,
            url,
            result: validatedResponse,
          });

          // ── F. NOTIFY — Domain template + Infrastructure sender ─────────
          if (services.sender) {
            console.log(`[Pipeline:${instanceId}] Match found! Preparing notification...`);

            // F1. Build notification message (pure domain function)
            const notificationMessage = domain.buildTemplate(validatedResponse);

            // F2. Resolve the WhatsApp client (from connection manager)
            const {
              getConnectionManager,
            } = require('../infrastructure/messaging/connection-manager');
            const sessionId = services.notifyConfig?.sessionId || 'default';
            const client = getConnectionManager()?.getClient(sessionId);

            const phoneNumber = services.notifyConfig?.phoneNumber;

            // F3. Send message (stateless infrastructure function)
            await services.sender.sendMessage(client, phoneNumber, notificationMessage);

            this.broker.emit(EventTypes.NOTIFIER.SEND, { pipelineName, instanceId, url });
            console.log(`[Pipeline:${instanceId}] Notification sent successfully!`);
          }
        } else {
          this.broker.emit(EventTypes.ANALYZER.NO_MATCH, {
            pipelineName,
            instanceId,
            provider,
            url,
            result: validatedResponse,
          });
        }
      } catch (err) {
        console.error(`[Pipeline:${instanceId}] Pipeline stage failed:`, err.message);
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `pipeline:${instanceId}`,
          url,
          message: err.message,
          stack: err.stack,
        });
      }
    });

    console.log(`[Pipeline] Events wired: ${instanceId}`);
  }

  getService(instanceId, serviceName) {
    const services = this.activeServices.get(instanceId);
    if (!services) {
      throw new Error(`Pipeline not initialized: ${instanceId}`);
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
