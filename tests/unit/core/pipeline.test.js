'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const { PipelineOrchestrator } = require('../../../src/core/pipeline');
const { registry } = require('../../../src/core/registry');

// Mock fs, js-yaml, and registry
jest.mock('fs');
jest.mock('js-yaml');
jest.mock('../../../src/core/registry', () => ({
  registry: {
    instantiateProvider: jest.fn(),
    instantiatePlugin: jest.fn(),
  },
}));

describe('PipelineOrchestrator Core', () => {
  let broker;
  let orchestrator;

  const validConfig = {
    name: 'test-pipeline',
    provider: 'scholarships',
    stages: {
      listen: { plugin: 'whatsapp-listener', config: {} },
      scrape: { primary: 'jina-scraper', fallback: 'puppeteer-scraper' },
      analyze: { plugin: 'gemini-analyzer', config: {} },
      notify: { plugin: 'whatsapp-notifier', config: {} },
    },
    config: { custom: 'value' },
  };

  beforeEach(() => {
    broker = {
      emit: jest.fn(),
      on: jest.fn(),
    };
    orchestrator = new PipelineOrchestrator(broker);
    jest.clearAllMocks();
  });

  describe('loadPipelineFromObject', () => {
    test('should load valid config and return it', () => {
      const result = orchestrator.loadPipelineFromObject(validConfig);
      expect(result).toBe(validConfig);
      expect(orchestrator.getAllPipelines()).toContain('test-pipeline');
    });

    test('should throw error for invalid config structures', () => {
      expect(() => {
        orchestrator.loadPipelineFromObject({ name: 'incomplete' });
      }).toThrow('Invalid pipeline config structure');
    });
  });

  describe('loadPipelineFromYAML', () => {
    test('should read file and parse YAML correctly', () => {
      fs.readFileSync.mockReturnValue('raw-yaml-content');
      yaml.load.mockReturnValue(validConfig);

      const result = orchestrator.loadPipelineFromYAML('pipelines/test.yaml');

      expect(fs.readFileSync).toHaveBeenCalledWith('pipelines/test.yaml', 'utf8');
      expect(yaml.load).toHaveBeenCalledWith('raw-yaml-content');
      expect(result).toBe(validConfig);
    });

    test('should throw error for missing pipeline name', () => {
      fs.readFileSync.mockReturnValue('content');
      yaml.load.mockReturnValue({ provider: 'scholarships', stages: {} });

      expect(() => {
        orchestrator.loadPipelineFromYAML('pipelines/test.yaml');
      }).toThrow('Pipeline must have a name');
    });

    test('should throw error for missing provider', () => {
      fs.readFileSync.mockReturnValue('content');
      yaml.load.mockReturnValue({ name: 'test', stages: {} });

      expect(() => {
        orchestrator.loadPipelineFromYAML('pipelines/test.yaml');
      }).toThrow('Pipeline must specify a provider');
    });

    test('should throw error for missing stages', () => {
      fs.readFileSync.mockReturnValue('content');
      yaml.load.mockReturnValue({ name: 'test', provider: 'scholarships' });

      expect(() => {
        orchestrator.loadPipelineFromYAML('pipelines/test.yaml');
      }).toThrow('Pipeline must have stages');
    });
  });

  describe('initializePipeline', () => {
    let mockProviderInstance;
    let mockListenerInstance;
    let mockScraperInstance;
    let mockAnalyzerInstance;
    let mockNotifierInstance;

    beforeEach(() => {
      orchestrator.loadPipelineFromObject(validConfig);

      mockProviderInstance = { name: 'mock-provider' };
      mockListenerInstance = { initialize: jest.fn(), on: jest.fn() };
      mockScraperInstance = { name: 'mock-scraper' };
      mockAnalyzerInstance = { setProvider: jest.fn() };
      mockNotifierInstance = { setProvider: jest.fn() };

      registry.instantiateProvider.mockReturnValue(mockProviderInstance);
      registry.instantiatePlugin.mockImplementation((type, name) => {
        if (type === 'listener') return mockListenerInstance;
        if (type === 'scraper') return mockScraperInstance;
        if (type === 'analyzer') return mockAnalyzerInstance;
        if (type === 'notifier') return mockNotifierInstance;
        return null;
      });
    });

    test('should instantiate all stages and wire them successfully', async () => {
      const services = await orchestrator.initializePipeline('test-pipeline');

      expect(registry.instantiateProvider).toHaveBeenCalledWith('scholarships', { custom: 'value' });
      expect(registry.instantiatePlugin).toHaveBeenCalledWith('listener', 'whatsapp-listener', {});
      expect(registry.instantiatePlugin).toHaveBeenCalledWith('scraper', 'jina-scraper', {});
      expect(registry.instantiatePlugin).toHaveBeenCalledWith('scraper', 'puppeteer-scraper', {});
      expect(registry.instantiatePlugin).toHaveBeenCalledWith('analyzer', 'gemini-analyzer', {});
      expect(registry.instantiatePlugin).toHaveBeenCalledWith('notifier', 'whatsapp-notifier', {});

      expect(mockListenerInstance.initialize).toHaveBeenCalled();
      expect(mockAnalyzerInstance.setProvider).toHaveBeenCalledWith(mockProviderInstance);
      expect(mockNotifierInstance.setProvider).toHaveBeenCalledWith(mockProviderInstance);

      expect(services.provider).toBe(mockProviderInstance);
      expect(services.listener).toBe(mockListenerInstance);
      expect(services.primaryScraper).toBe(mockScraperInstance);
      expect(services.fallbackScraper).toBe(mockScraperInstance);
      expect(services.analyzer).toBe(mockAnalyzerInstance);
      expect(services.notifier).toBe(mockNotifierInstance);
    });

    test('should throw error if initializing non-existent pipeline', async () => {
      await expect(orchestrator.initializePipeline('unknown')).rejects.toThrow('Pipeline not found: unknown');
    });
  });

  describe('wirePipelineEvents', () => {
    let mockListenerInstance;

    beforeEach(() => {
      orchestrator.loadPipelineFromObject(validConfig);
      mockListenerInstance = {
        on: jest.fn(),
      };
      orchestrator.activeServices.set('test-pipeline', {
        listener: mockListenerInstance,
        provider: 'scholarships',
      });
    });

    test('should wire listener events correctly', () => {
      orchestrator.wirePipelineEvents('test-pipeline');

      expect(mockListenerInstance.on).toHaveBeenCalledWith('link_extracted', expect.any(Function));

      // Trigger the handler callback
      const callback = mockListenerInstance.on.mock.calls[0][1];
      callback('https://target.url');

      expect(broker.emit).toHaveBeenCalledWith('scraper:start', {
        pipelineName: 'test-pipeline',
        provider: 'scholarships',
        url: 'https://target.url',
      });
    });

    test('should throw error if wiring unitialized pipeline', () => {
      expect(() => {
        orchestrator.wirePipelineEvents('unknown');
      }).toThrow('Pipeline not ready: unknown');
    });
  });

  describe('getService', () => {
    test('should return service when pipeline and service exist', () => {
      orchestrator.activeServices.set('test-pipeline', { provider: 'mock' });
      const service = orchestrator.getService('test-pipeline', 'provider');
      expect(service).toBe('mock');
    });

    test('should throw error when pipeline not initialized', () => {
      expect(() => {
        orchestrator.getService('unknown', 'provider');
      }).toThrow('Pipeline not initialized: unknown');
    });
  });

  describe('shutdown', () => {
    test('should close active listeners', async () => {
      const mockListener = { close: jest.fn() };
      orchestrator.activeServices.set('test-pipeline', { listener: mockListener });

      await orchestrator.shutdown();
      expect(mockListener.close).toHaveBeenCalled();
    });
  });
});
