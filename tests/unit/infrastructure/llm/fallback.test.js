'use strict';

const {
  generateStructuredData,
  getSupportedModels,
  ensureInitialized
} = require('../../../../src/infrastructure/llm/fallback');
const { registry } = require('../../../../src/core/registry');

// Mock registry getAdapter
jest.mock('../../../../src/core/registry', () => {
  const mockAdapters = {};
  return {
    registry: {
      registerAdapter: jest.fn((type, name, adapter) => {
        mockAdapters[name] = adapter;
      }),
      getAdapter: jest.fn((type, name) => {
        if (mockAdapters[name]) {
          return mockAdapters[name];
        }
        throw new Error(`Adapter not found: ${name}`);
      })
    }
  };
});

describe('Fallback LLM Adapter (Multi-LLM)', () => {
  let mockGeminiAdapter;
  let mockGroqAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.LLM_CHAIN;
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;

    mockGeminiAdapter = {
      generateStructuredData: jest.fn(),
      getSupportedModels: jest.fn()
    };

    mockGroqAdapter = {
      generateStructuredData: jest.fn(),
      getSupportedModels: jest.fn()
    };

    // Register mocks in mock registry
    registry.getAdapter.mockImplementation((type, name) => {
      if (name === 'gemini') {
        return mockGeminiAdapter;
      }
      if (name === 'groq') {
        return mockGroqAdapter;
      }
      throw new Error(`Mock adapter not found: ${name}`);
    });
  });

  test('should fallback to default env variables if LLM_CHAIN is not configured', async () => {
    process.env.LLM_PROVIDER = 'groq';
    process.env.LLM_API_KEY = 'test-key';
    mockGroqAdapter.generateStructuredData.mockResolvedValue({ success: true });

    const res = await generateStructuredData('test prompt', { type: 'object' });

    expect(res).toEqual({ success: true });
    expect(mockGroqAdapter.generateStructuredData).toHaveBeenCalledWith(
      'test prompt',
      { type: 'object' },
      expect.objectContaining({ apiKey: 'test-key' })
    );
  });

  test('should execute fallback chain sequentially and return first success', async () => {
    process.env.LLM_CHAIN = JSON.stringify([
      { provider: 'groq', apiKey: 'groq-key-1', model: 'llama3-70b' },
      { provider: 'gemini', apiKey: 'gemini-key-2', model: 'gemini-1.5' }
    ]);

    mockGroqAdapter.generateStructuredData.mockRejectedValue(new Error('Rate limit'));
    mockGeminiAdapter.generateStructuredData.mockResolvedValue({ status: 'fallback-succeeded' });

    const res = await generateStructuredData('test prompt', { type: 'object' });

    expect(res).toEqual({ status: 'fallback-succeeded' });
    expect(mockGroqAdapter.generateStructuredData).toHaveBeenCalledTimes(1);
    expect(mockGeminiAdapter.generateStructuredData).toHaveBeenCalledTimes(1);
    expect(process.env.GROQ_API_KEY).toBe('groq-key-1');
    expect(process.env.GEMINI_API_KEY).toBe('gemini-key-2');
  });

  test('should throw error if all LLMs in the chain fail', async () => {
    process.env.LLM_CHAIN = JSON.stringify([
      { provider: 'groq', apiKey: 'groq-key-1' },
      { provider: 'gemini', apiKey: 'gemini-key-2' }
    ]);

    mockGroqAdapter.generateStructuredData.mockRejectedValue(new Error('Groq Offline'));
    mockGeminiAdapter.generateStructuredData.mockRejectedValue(new Error('Gemini Offline'));

    await expect(generateStructuredData('test prompt', { type: 'object' })).rejects.toThrow(
      '[LLM Fallback] All LLMs in the chain failed. Last error: Gemini Offline'
    );
  });
});
