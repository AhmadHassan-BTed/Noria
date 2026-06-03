'use strict';

/**
 * Plugin/Adapter Registration
 *
 * Registers all built-in domains, infrastructure adapters, and listeners
 * with the central registry. This is the wiring point where the new
 * hexagonal architecture connects infrastructure to the core.
 */

const { registry } = require('../core/registry');

// ─── Domain Modules (plain objects) ─────────────────────────────────────────
const scholarshipsDomain = require('../domains/scholarships');
const jobsDomain = require('../domains/jobs');

// ─── Infrastructure: Listener (class-based — the only exception) ────────────
const { WhatsAppListener } = require('../infrastructure/messaging/whatsapp-listener');

// ─── Infrastructure: LLM Adapter (stateless functions) ──────────────────────
const geminiAdapter = require('../infrastructure/llm/gemini');

// ─── Infrastructure: Scraper Adapters (stateless functions) ─────────────────
const jinaScraper = require('../infrastructure/scraper/jina');
const puppeteerScraper = require('../infrastructure/scraper/puppeteer');
const resilientFetchScraper = require('../infrastructure/scraper/resilientFetch');

// ─── Infrastructure: Sender Adapter (stateless function) ────────────────────
const whatsappSender = require('../infrastructure/messaging/whatsapp-sender');

function initialize() {
  // ── Domains ───────────────────────────────────────────────────────────────
  registry.registerDomain('scholarships', scholarshipsDomain);
  registry.registerDomain('jobs', jobsDomain);
  console.log('[Registry] Domains registered');

  // ── Listener (class-based) ────────────────────────────────────────────────
  registry.registerListener('whatsapp-listener', WhatsAppListener);
  console.log('[Registry] Listeners registered');

  // ── LLM Adapters ──────────────────────────────────────────────────────────
  registry.registerAdapter('llm', 'gemini', geminiAdapter);
  console.log('[Registry] LLM adapters registered');

  // ── Scraper Adapters ──────────────────────────────────────────────────────
  registry.registerAdapter('scraper', 'jina-scraper', jinaScraper);
  registry.registerAdapter('scraper', 'puppeteer-scraper', puppeteerScraper);
  registry.registerAdapter('scraper', 'resilient-fetch', resilientFetchScraper);
  console.log('[Registry] Scraper adapters registered');

  // ── Sender Adapters ───────────────────────────────────────────────────────
  registry.registerAdapter('sender', 'whatsapp-sender', whatsappSender);
  console.log('[Registry] Sender adapters registered');
}

module.exports = { initialize };
