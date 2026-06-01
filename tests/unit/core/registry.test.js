'use strict';

const { PluginRegistry, registry } = require('../../../src/core/registry');

describe('PluginRegistry Core', () => {
  let testRegistry;

  class MockListenerPlugin {
    constructor(config) {
      this.config = config;
    }
    initialize() {}
    on() {}
    close() {}
  }

  class MockScraperPlugin {
    constructor(config) {
      this.config = config;
    }
    scrape() {}
  }

  class MockAnalyzerPlugin {
    constructor(config) {
      this.config = config;
    }
    analyze() {}
    setProvider() {}
  }

  class MockNotifierPlugin {
    constructor(config) {
      this.config = config;
    }
    send() {}
    setProvider() {}
    format() {}
  }

  class MockProvider {
    constructor(config) {
      this.config = config;
    }
    getAnalyzer() {}
    getNotifier() {}
    getSchema() {}
    getMetadata() {}
  }

  beforeEach(() => {
    testRegistry = new PluginRegistry();
  });

  test('should initialize with empty collections', () => {
    expect(testRegistry.listPlugins()).toEqual([]);
    expect(testRegistry.listProviders()).toEqual([]);
  });

  test('should register and retrieve plugins correctly', () => {
    testRegistry.registerPlugin('listener', 'whatsapp', MockListenerPlugin);
    const pluginClass = testRegistry.getPlugin('listener', 'whatsapp');
    expect(pluginClass).toBe(MockListenerPlugin);
  });

  test('should throw error when registering duplicate plugins', () => {
    testRegistry.registerPlugin('listener', 'whatsapp', MockListenerPlugin);
    expect(() => {
      testRegistry.registerPlugin('listener', 'whatsapp', MockListenerPlugin);
    }).toThrow('Plugin already registered: listener:whatsapp');
  });

  test('should throw error when registering plugin violating interface', () => {
    class InvalidPlugin {}
    expect(() => {
      testRegistry.registerPlugin('listener', 'invalid', InvalidPlugin);
    }).toThrow(
      "Plugin interface violation: Plugin class 'InvalidPlugin' registered as type 'listener' must implement method 'initialize()'"
    );
  });

  test('should throw error when registering non-constructor plugin class', () => {
    expect(() => {
      testRegistry.registerPlugin('listener', 'invalid', {});
    }).toThrow("Plugin registry error: listener:invalid is not a valid constructor class");
  });

  test('should throw error when getting non-existent plugin', () => {
    expect(() => {
      testRegistry.getPlugin('listener', 'unknown');
    }).toThrow('Plugin not found: listener:unknown');
  });

  test('should register and retrieve providers correctly', () => {
    testRegistry.registerProvider('scholarships', MockProvider);
    const providerClass = testRegistry.getProvider('scholarships');
    expect(providerClass).toBe(MockProvider);
  });

  test('should throw error when registering duplicate providers', () => {
    testRegistry.registerProvider('scholarships', MockProvider);
    expect(() => {
      testRegistry.registerProvider('scholarships', MockProvider);
    }).toThrow('Provider already registered: scholarships');
  });

  test('should throw error when registering provider violating interface', () => {
    class InvalidProvider {}
    expect(() => {
      testRegistry.registerProvider('invalid', InvalidProvider);
    }).toThrow(
      "Provider interface violation: Provider class 'InvalidProvider' must implement method 'getAnalyzer()' to abide by the BaseProvider interface"
    );
  });

  test('should throw error when registering non-constructor provider class', () => {
    expect(() => {
      testRegistry.registerProvider('invalid', {});
    }).toThrow("Provider registry error: Provider 'invalid' is not a valid constructor class");
  });

  test('should throw error when getting non-existent provider', () => {
    expect(() => {
      testRegistry.getProvider('unknown');
    }).toThrow('Provider not found: unknown');
  });

  test('should instantiate plugins with config', () => {
    testRegistry.registerPlugin('analyzer', 'gemini', MockAnalyzerPlugin);
    const config = { apiKey: 'secret' };
    const instance = testRegistry.instantiatePlugin('analyzer', 'gemini', config);

    expect(instance).toBeInstanceOf(MockAnalyzerPlugin);
    expect(instance.config).toEqual(config);
  });

  test('should instantiate providers with config', () => {
    testRegistry.registerProvider('scholarships', MockProvider);
    const config = { rules: [] };
    const instance = testRegistry.instantiateProvider('scholarships', config);

    expect(instance).toBeInstanceOf(MockProvider);
    expect(instance.config).toEqual(config);
  });

  test('should list registered plugins, optionally filtering by type', () => {
    testRegistry.registerPlugin('listener', 'whatsapp', MockListenerPlugin);
    testRegistry.registerPlugin('scraper', 'puppeteer', MockScraperPlugin);
    testRegistry.registerPlugin('scraper', 'jina', MockScraperPlugin);

    expect(testRegistry.listPlugins()).toEqual([
      'listener:whatsapp',
      'scraper:puppeteer',
      'scraper:jina',
    ]);

    expect(testRegistry.listPlugins('scraper')).toEqual([
      'scraper:puppeteer',
      'scraper:jina',
    ]);

    expect(testRegistry.listPlugins('listener')).toEqual([
      'listener:whatsapp',
    ]);
  });

  test('should list registered providers', () => {
    testRegistry.registerProvider('scholarships', MockProvider);
    testRegistry.registerProvider('jobs', MockProvider);

    expect(testRegistry.listProviders()).toEqual(['scholarships', 'jobs']);
  });

  test('should expose default shared registry instance', () => {
    expect(registry).toBeInstanceOf(PluginRegistry);
  });
});
