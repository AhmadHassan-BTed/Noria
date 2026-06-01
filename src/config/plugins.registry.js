'use strict';

const { registry } = require('../core/registry');

const { WhatsAppListener } = require('./listeners/whatsapp');
const { GeminiAnalyzer } = require('./analyzers/gemini');
const { initPuppeteerScraper } = require('./scrapers/puppeteer-plugin');
const { initJinaScraper } = require('./scrapers/jina-plugin');
const { initWhatsAppNotifier } = require('./notifiers/whatsapp-plugin');
const { ScholarshipsProvider } = require('../providers/scholarships');

function registerBuiltInPlugins() {
  registry.registerPlugin('listener', 'whatsapp-listener', WhatsAppListener);

  registry.registerPlugin('analyzer', 'gemini-analyzer', GeminiAnalyzer);

  registry.registerPlugin('scraper', 'puppeteer-scraper', initPuppeteerScraper);
  registry.registerPlugin('scraper', 'jina-scraper', initJinaScraper);

  registry.registerPlugin('notifier', 'whatsapp-notifier', initWhatsAppNotifier);

  console.log('[Registry] Built-in plugins registered');
}

function registerBuiltInProviders() {
  registry.registerProvider('scholarships', ScholarshipsProvider);

  console.log('[Registry] Built-in providers registered');
}

function initialize() {
  registerBuiltInPlugins();
  registerBuiltInProviders();
}

module.exports = { initialize };
