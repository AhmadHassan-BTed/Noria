'use strict';

/**
 * Core — Function-Based Registry
 *
 * Registers domain modules (plain objects) and infrastructure adapters
 * (functions or lightweight modules). No class prototype checks.
 * No inheritance validation.
 *
 * Registration types:
 *   • Domains:   Plain objects with { buildPrompt, buildTemplate, schema, metadata }
 *   • Adapters:  Function modules keyed by (type, name)
 *   • Listeners: Constructor classes (the ONLY class-based registration — WhatsApp is stateful)
 */

class PluginRegistry {
  constructor() {
    this.domains = new Map();
    this.adapters = new Map();
    this.listeners = new Map();
  }

  // ─── Domain Registration ──────────────────────────────────────────────────

  /**
   * Register a domain module (plain object).
   *
   * @param {string} name - Domain name (e.g. 'scholarships', 'jobs')
   * @param {object} domainModule - Plain object with { buildPrompt, resolveProfile, buildTemplate, schema, metadata }
   */
  registerDomain(name, domainModule) {
    if (this.domains.has(name)) {
      throw new Error(`Domain already registered: ${name}`);
    }

    // Validate required exports
    const required = ['buildPrompt', 'resolveProfile', 'buildTemplate', 'schema'];
    for (const fn of required) {
      if (typeof domainModule[fn] !== 'function' && typeof domainModule[fn] !== 'object') {
        throw new Error(
          `Domain interface violation: '${name}' must export '${fn}' ` +
            `(got ${typeof domainModule[fn]})`
        );
      }
    }

    this.domains.set(name, domainModule);
    console.log(`[Registry] Domain registered: ${name}`);
  }

  /**
   * @param {string} name
   * @returns {object} Domain module
   */
  getDomain(name) {
    const domain = this.domains.get(name);
    if (!domain) {
      throw new Error(`Domain not found: ${name}`);
    }
    return domain;
  }

  // ─── Adapter Registration ─────────────────────────────────────────────────

  /**
   * Register an infrastructure adapter (function module).
   *
   * @param {string} type - Adapter type (e.g. 'scraper', 'llm', 'sender')
   * @param {string} name - Adapter name (e.g. 'jina-scraper', 'gemini')
   * @param {object} adapterModule - Module with exported functions (e.g. { scrape }, { generateStructuredData })
   */
  registerAdapter(type, name, adapterModule) {
    const key = `${type}:${name}`;
    if (this.adapters.has(key)) {
      throw new Error(`Adapter already registered: ${key}`);
    }

    this.adapters.set(key, adapterModule);
    console.log(`[Registry] Adapter registered: ${key}`);
  }

  /**
   * @param {string} type
   * @param {string} name
   * @returns {object} Adapter module
   */
  getAdapter(type, name) {
    const key = `${type}:${name}`;
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new Error(`Adapter not found: ${key}`);
    }
    return adapter;
  }

  // ─── Listener Registration ────────────────────────────────────────────────

  /**
   * Register a listener class (the only class-based registration).
   * Listeners are stateful (WebSocket, QR, auth) so they stay class-based.
   *
   * @param {string} name - Listener name (e.g. 'whatsapp-listener')
   * @param {Function} ListenerClass - Constructor class
   */
  registerListener(name, ListenerClass) {
    if (this.listeners.has(name)) {
      throw new Error(`Listener already registered: ${name}`);
    }

    // Validate required methods on the prototype
    const prototype = ListenerClass.prototype;
    if (!prototype) {
      throw new Error(`Listener registration error: '${name}' is not a valid constructor`);
    }

    const requiredMethods = ['initialize', 'on', 'close'];
    for (const method of requiredMethods) {
      if (typeof prototype[method] !== 'function') {
        throw new Error(
          `Listener interface violation: '${ListenerClass.name}' must implement '${method}()'`
        );
      }
    }

    this.listeners.set(name, ListenerClass);
    console.log(`[Registry] Listener registered: ${name}`);
  }

  /**
   * @param {string} name
   * @param {object} config
   * @returns {object} Listener instance
   */
  createListener(name, config = {}) {
    const ListenerClass = this.listeners.get(name);
    if (!ListenerClass) {
      throw new Error(`Listener not found: ${name}`);
    }
    return new ListenerClass(config);
  }

  // ─── Introspection ────────────────────────────────────────────────────────

  listDomains() {
    return Array.from(this.domains.keys());
  }

  listAdapters(type) {
    const prefix = type ? `${type}:` : '';
    const result = [];
    for (const key of this.adapters.keys()) {
      if (!type || key.startsWith(prefix)) {
        result.push(key);
      }
    }
    return result;
  }

  listListeners() {
    return Array.from(this.listeners.keys());
  }
}

const registry = new PluginRegistry();

module.exports = { PluginRegistry, registry };
