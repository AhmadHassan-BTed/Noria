'use strict';

const { PluginRegistry, registry } = require('../../../src/core/registry');

describe('PluginRegistry Core — Function-Based', () => {
  let testRegistry;

  // Mock domain module (plain object — no class)
  const mockScholarshipsDomain = {
    buildPrompt: (text, profile, messageText) => `prompt: ${text}`,
    resolveProfile: (appConfig) => ({ name: appConfig.APPLICANT_NAME || 'Test' }),
    buildTemplate: (data) => `template: ${data.match_score}`,
    schema: { type: 'object', properties: {} },
    metadata: { name: 'scholarships', version: '1.0.0' },
  };

  const mockJobsDomain = {
    buildPrompt: (text, profile) => `job prompt: ${text}`,
    resolveProfile: (appConfig) => ({ name: appConfig.APPLICANT_NAME }),
    buildTemplate: (data) => `job template: ${data.match_score}`,
    schema: { type: 'object', properties: {} },
    metadata: { name: 'jobs', version: '1.0.0' },
  };

  // Mock adapter modules (function exports — no class)
  const mockScraperAdapter = { scrape: async (url) => ({ url, text: 'content' }) };
  const mockLlmAdapter = { generateStructuredData: async (prompt, schema) => ({ match_score: 80 }) };
  const mockSenderAdapter = { sendMessage: async (client, target, message) => {} };

  // Mock listener class (the ONLY class-based registration)
  class MockListener {
    constructor(config) { this.config = config; }
    initialize() {}
    on() {}
    close() {}
  }

  beforeEach(() => {
    testRegistry = new PluginRegistry();
  });

  // ─── Domain Tests ──────────────────────────────────────────────────────────

  describe('Domain registration', () => {
    test('should initialize with empty collections', () => {
      expect(testRegistry.listDomains()).toEqual([]);
      expect(testRegistry.listAdapters()).toEqual([]);
      expect(testRegistry.listListeners()).toEqual([]);
    });

    test('should register and retrieve domains correctly', () => {
      testRegistry.registerDomain('scholarships', mockScholarshipsDomain);
      const domain = testRegistry.getDomain('scholarships');
      expect(domain).toBe(mockScholarshipsDomain);
      expect(domain.buildPrompt('test', {}, '')).toBe('prompt: test');
    });

    test('should throw error when registering duplicate domains', () => {
      testRegistry.registerDomain('scholarships', mockScholarshipsDomain);
      expect(() => {
        testRegistry.registerDomain('scholarships', mockScholarshipsDomain);
      }).toThrow('Domain already registered: scholarships');
    });

    test('should throw error for domain missing required exports', () => {
      expect(() => {
        testRegistry.registerDomain('invalid', { buildPrompt: () => {} });
      }).toThrow(/Domain interface violation.*must export/);
    });

    test('should throw error when getting non-existent domain', () => {
      expect(() => {
        testRegistry.getDomain('unknown');
      }).toThrow('Domain not found: unknown');
    });

    test('should list registered domains', () => {
      testRegistry.registerDomain('scholarships', mockScholarshipsDomain);
      testRegistry.registerDomain('jobs', mockJobsDomain);
      expect(testRegistry.listDomains()).toEqual(['scholarships', 'jobs']);
    });
  });

  // ─── Adapter Tests ─────────────────────────────────────────────────────────

  describe('Adapter registration', () => {
    test('should register and retrieve adapters correctly', () => {
      testRegistry.registerAdapter('scraper', 'jina-scraper', mockScraperAdapter);
      const adapter = testRegistry.getAdapter('scraper', 'jina-scraper');
      expect(adapter).toBe(mockScraperAdapter);
    });

    test('should throw error when registering duplicate adapters', () => {
      testRegistry.registerAdapter('scraper', 'jina', mockScraperAdapter);
      expect(() => {
        testRegistry.registerAdapter('scraper', 'jina', mockScraperAdapter);
      }).toThrow('Adapter already registered: scraper:jina');
    });

    test('should throw error when getting non-existent adapter', () => {
      expect(() => {
        testRegistry.getAdapter('scraper', 'unknown');
      }).toThrow('Adapter not found: scraper:unknown');
    });

    test('should list adapters, optionally filtering by type', () => {
      testRegistry.registerAdapter('scraper', 'jina', mockScraperAdapter);
      testRegistry.registerAdapter('scraper', 'puppeteer', mockScraperAdapter);
      testRegistry.registerAdapter('llm', 'gemini', mockLlmAdapter);
      testRegistry.registerAdapter('sender', 'whatsapp-sender', mockSenderAdapter);

      expect(testRegistry.listAdapters()).toEqual([
        'scraper:jina',
        'scraper:puppeteer',
        'llm:gemini',
        'sender:whatsapp-sender',
      ]);

      expect(testRegistry.listAdapters('scraper')).toEqual([
        'scraper:jina',
        'scraper:puppeteer',
      ]);

      expect(testRegistry.listAdapters('llm')).toEqual(['llm:gemini']);
    });
  });

  // ─── Listener Tests ────────────────────────────────────────────────────────

  describe('Listener registration', () => {
    test('should register and create listeners correctly', () => {
      testRegistry.registerListener('whatsapp-listener', MockListener);
      const instance = testRegistry.createListener('whatsapp-listener', { sessionId: 'test' });
      expect(instance).toBeInstanceOf(MockListener);
      expect(instance.config).toEqual({ sessionId: 'test' });
    });

    test('should throw error when registering duplicate listeners', () => {
      testRegistry.registerListener('whatsapp', MockListener);
      expect(() => {
        testRegistry.registerListener('whatsapp', MockListener);
      }).toThrow('Listener already registered: whatsapp');
    });

    test('should throw error for listener missing required methods', () => {
      class InvalidListener {}
      expect(() => {
        testRegistry.registerListener('invalid', InvalidListener);
      }).toThrow(/Listener interface violation.*must implement.*initialize/);
    });

    test('should throw error for non-constructor listener', () => {
      expect(() => {
        testRegistry.registerListener('invalid', {});
      }).toThrow("Listener registration error: 'invalid' is not a valid constructor");
    });

    test('should throw error when creating non-existent listener', () => {
      expect(() => {
        testRegistry.createListener('unknown');
      }).toThrow('Listener not found: unknown');
    });

    test('should list registered listeners', () => {
      testRegistry.registerListener('whatsapp', MockListener);
      expect(testRegistry.listListeners()).toEqual(['whatsapp']);
    });
  });

  // ─── Shared Instance ──────────────────────────────────────────────────────

  test('should expose default shared registry instance', () => {
    expect(registry).toBeInstanceOf(PluginRegistry);
  });
});
