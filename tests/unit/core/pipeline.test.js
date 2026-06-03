'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const { PipelineOrchestrator } = require('../../../src/core/pipeline');
const { registry } = require('../../../src/core/registry');
const { EventTypes } = require('../../../src/core/events');
const { urlCache } = require('../../../src/utils/cache');

// Mock fs and js-yaml
jest.mock('fs');
jest.mock('js-yaml');

// Mock registry
jest.mock('../../../src/core/registry', () => {
  const mockDomain = {
    resolveProfile: jest.fn().mockReturnValue({ name: 'mock-profile' }),
    buildPrompt: jest.fn().mockReturnValue('Mock prompt'),
    schema: { type: 'object' },
    buildTemplate: jest.fn().mockReturnValue('Formatted Message'),
  };

  const mockScraper = {
    scrape: jest.fn().mockResolvedValue({ text: 'Valid scraper opportunity content. '.repeat(10) }),
  };

  const mockLlm = {
    generateStructuredData: jest.fn().mockResolvedValue({ match_score: 85, verdict: 'Good alignment' }),
  };

  const mockSender = {
    sendMessage: jest.fn().mockResolvedValue(),
  };

  const mockListener = {
    initialize: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };

  return {
    registry: {
      getDomain: jest.fn().mockReturnValue(mockDomain),
      createListener: jest.fn().mockReturnValue(mockListener),
      getAdapter: jest.fn().mockImplementation((type, name) => {
        if (type === 'scraper') return mockScraper;
        if (type === 'llm') return mockLlm;
        if (type === 'sender') return mockSender;
        return null;
      }),
    },
  };
});

// Mock connection manager
jest.mock('../../../src/infrastructure/messaging/connection-manager', () => ({
  getConnectionManager: jest.fn().mockReturnValue({
    getClient: jest.fn().mockReturnValue({ name: 'mock-client' }),
  }),
}));

// Mock validators
jest.mock('../../../src/utils/validators', () => ({
  validateScraperPayload: jest.fn().mockImplementation((data) => data),
  validateAnalyzerResponse: jest.fn().mockImplementation((data) => data),
}));

// Mock cache
jest.mock('../../../src/utils/cache', () => ({
  urlCache: {
    has: jest.fn().mockReturnValue(false),
    set: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock config
jest.mock('../../../src/config', () => ({
  config: {
    getAll: jest.fn().mockReturnValue({ APPLICANT_NAME: 'Test User' }),
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
      analyze: { plugin: 'gemini-analyzer', config: { model: 'gemini-2.5-flash' } },
      notify: { plugin: 'whatsapp-notifier', config: { phoneNumber: '+923000000000' } },
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
    urlCache.has.mockReturnValue(false);
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
    beforeEach(() => {
      orchestrator.loadPipelineFromObject(validConfig);
    });

    test('should resolve domains and adapters and wire them successfully', async () => {
      const services = await orchestrator.initializePipeline('test-pipeline');

      expect(registry.getDomain).toHaveBeenCalledWith('scholarships');
      expect(registry.createListener).toHaveBeenCalledWith('whatsapp-listener', {});
      expect(registry.getAdapter).toHaveBeenCalledWith('scraper', 'jina-scraper');
      expect(registry.getAdapter).toHaveBeenCalledWith('scraper', 'puppeteer-scraper');
      expect(registry.getAdapter).toHaveBeenCalledWith('llm', 'gemini');
      expect(registry.getAdapter).toHaveBeenCalledWith('sender', 'whatsapp-sender');

      expect(services.domain).toBeDefined();
      expect(services.listener).toBeDefined();
      expect(services.primaryScraper).toBeDefined();
      expect(services.fallbackScraper).toBeDefined();
      expect(services.llm).toBeDefined();
      expect(services.sender).toBeDefined();

      expect(services.llmConfig).toEqual({ model: 'gemini-2.5-flash', temperature: undefined });
      expect(services.notifyConfig).toEqual({ phoneNumber: '+923000000000', sessionId: 'default' });
    });

    test('should instantiate dynamic pipeline instance with merged configurations', async () => {
      const customConfig = {
        listen: { sessionId: 'user_xyz', allowedChannels: ['Dynamic Channel'] },
        notify: { phoneNumber: '+923334445555' },
      };

      const services = await orchestrator.initializePipeline('test-pipeline', customConfig, 'dynamic-instance-1');

      expect(registry.createListener).toHaveBeenCalledWith('whatsapp-listener', {
        sessionId: 'user_xyz',
        allowedChannels: ['Dynamic Channel'],
      });
      expect(services.notifyConfig).toEqual({
        phoneNumber: '+923334445555',
        sessionId: 'user_xyz',
      });

      expect(orchestrator.activeServices.has('dynamic-instance-1')).toBe(true);
      expect(orchestrator.activeServices.has('test-pipeline')).toBe(false);
    });

    test('should throw error if initializing non-existent pipeline', async () => {
      await expect(orchestrator.initializePipeline('unknown')).rejects.toThrow('Pipeline not found: unknown');
    });
  });

  describe('wirePipelineEvents', () => {
    let mockServices;

    beforeEach(() => {
      orchestrator.loadPipelineFromObject(validConfig);

      mockServices = {
        domain: registry.getDomain('scholarships'),
        listener: registry.createListener('whatsapp-listener'),
        primaryScraper: registry.getAdapter('scraper', 'jina-scraper'),
        fallbackScraper: registry.getAdapter('scraper', 'puppeteer-scraper'),
        llm: registry.getAdapter('llm', 'gemini'),
        sender: registry.getAdapter('sender', 'whatsapp-sender'),
        llmConfig: { model: 'gemini-2.5-flash' },
        notifyConfig: { phoneNumber: '+923000000000', sessionId: 'default' },
      };

      orchestrator.activeServices.set('test-pipeline', mockServices);
    });

    test('should wire listener events correctly', () => {
      orchestrator.wirePipelineEvents('test-pipeline');

      expect(mockServices.listener.on).toHaveBeenCalledWith('link_extracted', expect.any(Function));

      // Trigger the handler callback
      const callback = mockServices.listener.on.mock.calls[0][1];
      callback('https://target.url');

      expect(broker.emit).toHaveBeenCalledWith(EventTypes.SCRAPER.START, {
        pipelineName: 'test-pipeline',
        instanceId: 'test-pipeline',
        provider: 'scholarships',
        url: 'https://target.url',
        messageText: undefined,
      });
    });

    test('should throw error if wiring uninitialized pipeline', () => {
      expect(() => {
        orchestrator.wirePipelineEvents('unknown');
      }).toThrow('Pipeline not ready: unknown');
    });

    test('should handle scraper:start event and run the full pipeline sequentially', async () => {
      orchestrator.wirePipelineEvents('test-pipeline');

      // Find the scraper:start listener callback
      const scraperStartCall = broker.on.mock.calls.find(
        (call) => call[0] === EventTypes.SCRAPER.START
      );
      expect(scraperStartCall).toBeDefined();

      const callback = scraperStartCall[1];

      // Trigger scraper:start
      await callback({
        pipelineName: 'test-pipeline',
        instanceId: 'test-pipeline',
        url: 'https://opportunity.com/1',
      });

      expect(mockServices.primaryScraper.scrape).toHaveBeenCalledWith('https://opportunity.com/1');
      expect(broker.emit).toHaveBeenCalledWith(EventTypes.SCRAPER.SUCCESS, {
        pipelineName: 'test-pipeline',
        instanceId: 'test-pipeline',
        url: 'https://opportunity.com/1',
      });

      expect(mockServices.domain.resolveProfile).toHaveBeenCalled();
      expect(mockServices.domain.buildPrompt).toHaveBeenCalledWith(
        expect.any(String),
        { name: 'mock-profile' },
        undefined
      );
      expect(mockServices.llm.generateStructuredData).toHaveBeenCalledWith(
        'Mock prompt',
        mockServices.domain.schema,
        mockServices.llmConfig
      );

      expect(mockServices.domain.buildTemplate).toHaveBeenCalledWith({
        match_score: 85,
        verdict: 'Good alignment',
        url: 'https://opportunity.com/1',
      });
      expect(mockServices.sender.sendMessage).toHaveBeenCalledWith(
        { name: 'mock-client' },
        '+923000000000',
        'Formatted Message'
      );
      expect(broker.emit).toHaveBeenCalledWith(EventTypes.NOTIFIER.SEND, {
        pipelineName: 'test-pipeline',
        instanceId: 'test-pipeline',
        url: 'https://opportunity.com/1',
      });
    });

    test('should clear the urlCache if clear-cache flag file exists during scraper:start', async () => {
      orchestrator.wirePipelineEvents('test-pipeline');

      const scraperStartCall = broker.on.mock.calls.find(
        (call) => call[0] === EventTypes.SCRAPER.START
      );
      const callback = scraperStartCall[1];

      // Setup mock behavior for fs
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});

      urlCache.has.mockReturnValue(true);

      // Trigger scraper:start which should trigger the clear cache check
      await callback({
        pipelineName: 'test-pipeline',
        instanceId: 'test-pipeline',
        url: 'https://opportunity.com/cached',
      });

      expect(urlCache.clear).toHaveBeenCalled();
      expect(fs.existsSync).toHaveBeenCalledWith(expect.stringContaining('clear-cache-test-pipeline.flag'));
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('clear-cache-test-pipeline.flag'));
    });
  });

  describe('getService', () => {
    test('should return service when pipeline and service exist', () => {
      orchestrator.activeServices.set('test-pipeline', { domain: 'mock' });
      const service = orchestrator.getService('test-pipeline', 'domain');
      expect(service).toBe('mock');
    });

    test('should throw error when pipeline not initialized', () => {
      expect(() => {
        orchestrator.getService('unknown', 'domain');
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
