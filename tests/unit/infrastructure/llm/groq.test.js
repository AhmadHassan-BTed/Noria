'use strict';

const {
  generateStructuredData,
  getSupportedModels,
  ensureInitialized,
  _resetForTesting,
} = require('../../../../src/infrastructure/llm/groq');
const { validateAnalyzerResponse } = require('../../../../src/utils/validators');
const { metrics } = require('../../../../src/utils/metrics');

jest.mock('../../../../src/utils/validators');
jest.mock('../../../../src/utils/metrics', () => ({
  metrics: {
    recordGroqTokens: jest.fn(),
    recordAnalyzerAttempt: jest.fn(),
    recordAnalyzerRetry: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/retry', () => ({
  withRetry: jest.fn().mockImplementation(async (fn) => fn()),
  isRetryableError: jest.fn().mockReturnValue(true),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('Groq LLM Adapter', () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = 'mock-groq-key';
    _resetForTesting();
    jest.clearAllMocks();
  });

  describe('ensureInitialized', () => {
    test('should throw error if API key not set', () => {
      delete process.env.GROQ_API_KEY;
      delete process.env.LLM_API_KEY;
      expect(() => ensureInitialized()).toThrow('[Groq] GROQ_API_KEY or LLM_API_KEY not set in environment');
    });

    test('should initialize successfully with API key', () => {
      expect(() => ensureInitialized('my-key')).not.toThrow();
    });
  });

  describe('getSupportedModels', () => {
    test('should return priority list when fetch is successful', async () => {
      const mockResponse = {
        data: [
          { id: 'llama-3.3-70b-versatile', active: true },
          { id: 'llama-3.1-8b-instant', active: true },
          { id: 'some-other-model', active: false },
        ],
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const models = await getSupportedModels();

      expect(models).toContain('llama-3.3-70b-versatile');
      expect(models).toContain('llama-3.1-8b-instant');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify caching
      const models2 = await getSupportedModels();
      expect(models2).toEqual(models);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should fall back to defaults if fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network failure'));

      const models = await getSupportedModels();
      expect(models).toEqual([
        'llama-3.3-70b-versatile',
        'llama3-70b-8192',
        'mixtral-8x7b-32768',
        'llama-3.1-8b-instant',
        'gemma2-9b-it'
      ]);
    });
  });

  describe('generateStructuredData', () => {
    beforeEach(() => {
      if (validateAnalyzerResponse.mockImplementation) {
        validateAnalyzerResponse.mockImplementation((data) => data);
      }
    });

    test('should analyze successfully with primary model', async () => {
      const mockGroqResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({ match_score: 75, reason: 'Good alignment' }),
            },
          },
        ],
        usage: {
          total_tokens: 120,
        },
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockGroqResponse),
      });

      const result = await generateStructuredData('Mock prompt', { type: 'object' });

      expect(result).toEqual({ match_score: 75, reason: 'Good alignment' });
      expect(metrics.recordGroqTokens).toHaveBeenCalledWith(120);
    });
  });
});
