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

    services.provider = registry.instantiateProvider(providerName, pipelineConfig.config || {});

    const stages = pipelineConfig.stages;

    if (stages.listen) {
      const pluginName = stages.listen.plugin || stages.listen;
      const listenConfig = {
        ...(stages.listen.config || {}),
        ...(customConfig.listen || {}),
      };
      services.listener = registry.instantiatePlugin(
        'listener',
        pluginName,
        listenConfig
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
      const analyzeConfig = {
        ...(analyzerConfig.config || {}),
        ...(customConfig.analyze || {}),
      };
      services.analyzer = registry.instantiatePlugin(
        'analyzer',
        analyzerName,
        analyzeConfig
      );
      services.analyzer.setProvider(services.provider);
    }

    if (stages.notify) {
      const notifierConfig = stages.notify;
      const notifierName = notifierConfig.plugin || notifierConfig;
      const notifyConfig = {
        ...(notifierConfig.config || {}),
        ...(customConfig.notify || {}),
      };
      services.notifier = registry.instantiatePlugin(
        'notifier',
        notifierName,
        notifyConfig
      );
      services.notifier.setProvider(services.provider);
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

    // 1. Listen stage triggers scraper:start
    if (services.listener) {
      services.listener.on('link_extracted', (payload) => {
        // Backward/forward compatibility:
        // - legacy: listener emits a bare string URL
        // - current: listener emits { url: string, ... }
        const url =
          typeof payload === 'string'
            ? payload
            : payload && typeof payload.url === 'string'
              ? payload.url
              : undefined;

        const messageText = payload && typeof payload === 'object' ? payload.messageText : undefined;

        this.broker.emit(EventTypes.SCRAPER.START, {
          pipelineName,
          instanceId,
          provider,
          url,
          messageText,
        });
      });
    }

    // 2. Handle scraper:start
    this.broker.on(EventTypes.SCRAPER.START, async (event) => {
      // If the event is not for this instance, ignore
      if (event.instanceId && event.instanceId !== instanceId) {
        return;
      }
      if (!event.instanceId && event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url, messageText } = event;
      console.log(`[Pipeline:${instanceId}] Starting scraper for URL: ${url}`);

      try {
        // A. Caching Check (Deduplication)
        const path = require('path');
        const clearCacheFlag = path.join(__dirname, '..', '..', 'data', `clear-cache-${instanceId}.flag`);
        const { urlCache } = require('../utils/cache');
        if (fs.existsSync(clearCacheFlag)) {
          console.log(`[Pipeline:${instanceId}] Clear cache flag detected. Clearing URL cache...`);
          urlCache.clear();
          try {
            fs.unlinkSync(clearCacheFlag);
          } catch (err) {
            console.warn(`[Pipeline:${instanceId}] Failed to delete clear-cache flag: ${err.message}`);
          }
        }

        if (urlCache.has(url)) {
          console.log(`[Pipeline:${instanceId}] URL already processed (Cache hit): ${url}`);
          return;
        }

        // B. Scraper execution (Primary with Fallback and Resilient Native Fetch Recovery)
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
              const fetchRes = await fetch(url, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5',
                }
              });
              if (!fetchRes.ok) {
                throw new Error(`Resilient Fetch returned status ${fetchRes.status}`);
              }
              const rawHtml = await fetchRes.text();
              
              // Clean HTML text content
              let textContent = rawHtml;
              textContent = textContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
              textContent = textContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
              textContent = textContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ');
              textContent = textContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ');
              textContent = textContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ');
              textContent = textContent.replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<br\s*\/?>/gi, '\n');
              textContent = textContent.replace(/<[^>]+>/g, ' ');
              textContent = textContent
                .replace(/&nbsp;/gi, ' ')
                .replace(/&amp;/gi, '&')
                .replace(/&lt;/gi, '<')
                .replace(/&gt;/gi, '>')
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/gi, "'")
                .replace(/&mdash;/gi, '—')
                .replace(/&ndash;/gi, '–');
              textContent = textContent.replace(/[ \t]+/g, ' ');
              textContent = textContent.replace(/\n\s*\n+/g, '\n\n').trim();
              
              if (!textContent) {
                throw new Error('Resilient Fetch extracted empty content.');
              }
              
              scrapedData = { url, text: textContent };
              console.log(`[Pipeline:${instanceId}] Native fetch recovery completed successfully (${textContent.length} chars).`);
            } catch (fetchErr) {
              console.error(`[Pipeline:${instanceId}] Resilient fetch recovery also failed: ${fetchErr.message}`);
              throw fallbackErr; // Throw original fallback error if fetch also failed
            }
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
        this.broker.emit(EventTypes.SCRAPER.SUCCESS, { pipelineName, instanceId, url });

        // Trigger Analyzer stage
        this.broker.emit(EventTypes.ANALYZER.START, {
          pipelineName,
          instanceId,
          provider,
          url,
          text: validatedPayload.text,
          messageText,
        });
      } catch (err) {
        console.error(`[Pipeline:${instanceId}] Scrape stage failed:`, err.message);
        this.broker.emit(EventTypes.SCRAPER.FAILED, { pipelineName, instanceId, url, error: err.message });
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `scraper:${instanceId}`,
          url,
          message: err.message,
          stack: err.stack,
        });
      }
    });

    // 3. Handle analyzer:start
    this.broker.on(EventTypes.ANALYZER.START, async (event) => {
      if (event.instanceId && event.instanceId !== instanceId) {
        return;
      }
      if (!event.instanceId && event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url, text, messageText } = event;
      console.log(`[Pipeline:${instanceId}] Starting analyzer for URL: ${url}`);

      try {
        if (!services.analyzer) {
          throw new Error('Analyzer service not registered for this pipeline.');
        }

        // A. Analyze the content using the active analyzer plugin
        const validatedResponse = await services.analyzer.analyze(text, { url, messageText });

        // Add original URL to results
        validatedResponse.url = url;

        console.log(
          `[Pipeline:${instanceId}] Analysis match score: ${validatedResponse.match_score}`
        );

        if (validatedResponse.match_score >= 50) {
          this.broker.emit(EventTypes.ANALYZER.MATCH_FOUND, {
            pipelineName,
            instanceId,
            provider,
            url,
            result: validatedResponse,
          });
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
        console.error(`[Pipeline:${instanceId}] Analyze stage failed:`, err.message);
        this.broker.emit(EventTypes.ANALYZER.FAILED, { pipelineName, instanceId, url, error: err.message });
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `analyzer:${instanceId}`,
          url,
          message: err.message,
          stack: err.stack,
        });
      }
    });

    // 4. Handle analyzer:match_found
    this.broker.on(EventTypes.ANALYZER.MATCH_FOUND, async (event) => {
      if (event.instanceId && event.instanceId !== instanceId) {
        return;
      }
      if (!event.instanceId && event.pipelineName && event.pipelineName !== pipelineName) {
        return;
      }

      const { url, result } = event;
      console.log(`[Pipeline:${instanceId}] Match found! Preparing notification...`);

      try {
        if (!services.notifier) {
          throw new Error('Notifier service not registered for this pipeline.');
        }

        // A. Format the message
        const message = services.notifier.format(result);

        // B. Send notification using the dynamic, configured notifier plugin instance
        await services.notifier.send(services.notifier.phoneNumber, message);

        this.broker.emit(EventTypes.NOTIFIER.SEND, { pipelineName, instanceId, url });
        console.log(`[Pipeline:${instanceId}] Notification sent successfully!`);
      } catch (err) {
        console.error(`[Pipeline:${instanceId}] Notify stage failed:`, err.message);
        this.broker.emit(EventTypes.SYSTEM.ERROR, {
          source: `notifier:${instanceId}`,
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
