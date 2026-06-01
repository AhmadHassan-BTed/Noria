'use strict';

const { PluginRegistry, registry } = require('../../../src/core/registry');

describe('PluginRegistry Core', () => {
  let testRegistry;

  class MockPlugin {
    constructor(config) {
      this.config = config;
    }
  }

  class MockProvider {
    constructor(config) {
      this.config = config;
    }
  }

  beforeEach(() => {
    testRegistry = new PluginRegistry();
  });

  test('should initialize with empty collections', () => {
    expect(testRegistry.listPlugins()).toEqual([]);
    expect(testRegistry.listProviders()).toEqual([]);
  });

  test('should register and retrieve plugins correctly', () => {
    testRegistry.registerPlugin('listener', 'whatsapp', MockPlugin);
    const pluginClass = testRegistry.getPlugin('listener', 'whatsapp');
    expect(pluginClass).toBe(MockPlugin);
  });

  test('should throw error when registering duplicate plugins', () => {
    testRegistry.registerPlugin('listener', 'whatsapp', MockPlugin);
    expect(() => {
      testRegistry.registerPlugin('listener', 'whatsapp', MockPlugin);
    }).toThrow('Plugin already registered: listener:whatsapp');
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

  test('should throw error when getting non-existent provider', () => {
    expect(() => {
      testRegistry.getProvider('unknown');
    }).toThrow('Provider not found: unknown');
  });

  test('should instantiate plugins with config', () => {
    testRegistry.registerPlugin('analyzer', 'gemini', MockPlugin);
    const config = { apiKey: 'secret' };
    const instance = testRegistry.instantiatePlugin('analyzer', 'gemini', config);

    expect(instance).toBeInstanceOf(MockPlugin);
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
    testRegistry.registerPlugin('listener', 'whatsapp', MockPlugin);
    testRegistry.registerPlugin('scraper', 'puppeteer', MockPlugin);
    testRegistry.registerPlugin('scraper', 'jina', MockPlugin);

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
