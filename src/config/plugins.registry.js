'use strict';

const { registry } = require('../core/registry');

const { WhatsAppListener } = require('../plugins/listeners/whatsapp');
const { GeminiAnalyzer } = require('../plugins/analyzers/gemini');
const { PuppeteerScraper } = require('../plugins/scrapers/puppeteer');
const { JinaScraper } = require('../plugins/scrapers/jina');
const { WhatsAppNotifier } = require('../plugins/notifiers/whatsapp');
const { ScholarshipsProvider } = require('../providers/scholarships');

function registerBuiltInPlugins() {
  registry.registerPlugin('listener', 'whatsapp-listener', WhatsAppListener);

  registry.registerPlugin('analyzer', 'gemini-analyzer', GeminiAnalyzer);

  registry.registerPlugin('scraper', 'puppeteer-scraper', PuppeteerScraper);
  registry.registerPlugin('scraper', 'jina-scraper', JinaScraper);

  registry.registerPlugin('notifier', 'whatsapp-notifier', WhatsAppNotifier);

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
