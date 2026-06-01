'use strict';

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.providers = new Map();
  }

  registerPlugin(type, name, pluginClass) {
    const key = `${type}:${name}`;
    if (this.plugins.has(key)) {
      throw new Error(`Plugin already registered: ${key}`);
    }

    // Dynamic Interface Verification
    const prototype = pluginClass.prototype;
    if (!prototype) {
      throw new Error(`Plugin registry error: ${key} is not a valid constructor class`);
    }

    const requiredMethods = {
      listener: ['initialize', 'on', 'close'],
      scraper: ['scrape'],
      analyzer: ['analyze', 'setProvider'],
      notifier: ['send', 'setProvider', 'format'],
    }[type];

    if (requiredMethods) {
      for (const method of requiredMethods) {
        if (typeof prototype[method] !== 'function') {
          throw new Error(
            `Plugin interface violation: Plugin class '${pluginClass.name}' registered as type '${type}' must implement method '${method}()'`
          );
        }
      }
    }

    this.plugins.set(key, pluginClass);
    console.log(`[Registry] Plugin registered: ${key}`);
  }

  registerProvider(name, providerClass) {
    if (this.providers.has(name)) {
      throw new Error(`Provider already registered: ${name}`);
    }

    // Dynamic Interface Verification
    const prototype = providerClass.prototype;
    if (!prototype) {
      throw new Error(
        `Provider registry error: Provider '${name}' is not a valid constructor class`
      );
    }

    const requiredMethods = ['getAnalyzer', 'getNotifier', 'getSchema', 'getMetadata'];
    for (const method of requiredMethods) {
      if (typeof prototype[method] !== 'function') {
        throw new Error(
          `Provider interface violation: Provider class '${providerClass.name}' must implement method '${method}()' to abide by the BaseProvider interface`
        );
      }
    }

    this.providers.set(name, providerClass);
    console.log(`[Registry] Provider registered: ${name}`);
  }

  getPlugin(type, name) {
    const key = `${type}:${name}`;
    const pluginClass = this.plugins.get(key);
    if (!pluginClass) {
      throw new Error(`Plugin not found: ${key}`);
    }
    return pluginClass;
  }

  getProvider(name) {
    const providerClass = this.providers.get(name);
    if (!providerClass) {
      throw new Error(`Provider not found: ${name}`);
    }
    return providerClass;
  }

  instantiatePlugin(type, name, config = {}) {
    const PluginClass = this.getPlugin(type, name);
    return new PluginClass(config);
  }

  instantiateProvider(name, config = {}) {
    const ProviderClass = this.getProvider(name);
    return new ProviderClass(config);
  }

  listPlugins(type) {
    const prefix = type ? `${type}:` : '';
    const plugins = [];

    for (const key of this.plugins.keys()) {
      if (!type || key.startsWith(prefix)) {
        plugins.push(key);
      }
    }

    return plugins;
  }

  listProviders() {
    return Array.from(this.providers.keys());
  }
}

const registry = new PluginRegistry();

module.exports = { PluginRegistry, registry };
