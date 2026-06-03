'use strict';

const {
  generateStructuredData,
  getSupportedModels,
  ensureInitialized,
  _resetForTesting,
} = require('../../../../src/infrastructure/llm/gemini');
const { validateAnalyzerResponse } = require('../../../../src/utils/validators');
const { metrics } = require('../../../../src/utils/metrics');
const { GoogleGenerativeAI } = require('@google/generative-ai');

jest.mock('@google/generative-ai');
jest.mock('../../../../src/utils/validators');
jest.mock('../../../../src/utils/metrics', () => ({
  metrics: {
    recordGeminiRequest: jest.fn(),
    recordAnalyzerRetry: jest.fn(),
  },
}));

jest.mock('../../../../src/utils/retry', () => ({
  withRetry: jest.fn().mockImplementation(async (fn) => fn()),
  isRetryableError: jest.fn().mockReturnValue(true),
}));

// Mock global fetch
global.fetch = jest.fn();

describe('Gemini LLM Adapter', () => {
  let mockModelInstance;
  let mockGenAIInstance;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'mock-api-key';
    _resetForTesting();
    jest.clearAllMocks();

    mockModelInstance = {
      generateContent: jest.fn(),
    };

    mockGenAIInstance = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModelInstance),
    };

    GoogleGenerativeAI.mockImplementation(() => mockGenAIInstance);
  });

  describe('ensureInitialized', () => {
    test('should throw error if API key not set', () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => ensureInitialized()).toThrow('[Gemini] GEMINI_API_KEY not set in environment');
    });

    test('should initialize successfully with API key', () => {
      expect(() => ensureInitialized('my-key')).not.toThrow();
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('my-key');
    });
  });

  describe('getSupportedModels', () => {
    test('should return priority list when fetch is successful', async () => {
      const mockResponse = {
        models: [
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.0-flash-exp', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/other-model', supportedGenerationMethods: ['otherMethod'] },
        ],
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const models = await getSupportedModels();

      expect(models).toEqual([
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
      ]);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify caching: calling it again shouldn't fetch
      const models2 = await getSupportedModels();
      expect(models2).toEqual(models);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should fall back to defaults if fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network failure'));

      const models = await getSupportedModels();
      expect(models).toEqual(['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);
    });
  });

  describe('generateStructuredData', () => {
    beforeEach(() => {
      validateAnalyzerResponse.mockImplementation((data) => data);
    });

    test('should analyze successfully with primary model', async () => {
      const mockGenAIResponse = {
        response: {
          text: jest.fn().mockReturnValue(JSON.stringify({ match_score: 80, reason: 'Good opportunity' })),
        },
      };
      mockModelInstance.generateContent.mockResolvedValue(mockGenAIResponse);

      const result = await generateStructuredData('Mock prompt', { type: 'object' });

      expect(result).toEqual({ match_score: 80, reason: 'Good opportunity' });
      expect(mockGenAIInstance.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.5-flash' })
      );
    });

    test('should fall back to next model upon hitting 429 quota error', async () => {
      // Mock getSupportedModels to avoid real network call in this test context
      const mockResponse = {
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      };
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const quotaError = new Error('429 Too Many Requests: quota exceeded');
      mockModelInstance.generateContent
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce({
          response: {
            text: jest.fn().mockReturnValue(JSON.stringify({ match_score: 95, reason: 'Excellent opportunity' })),
          },
        });

      const result = await generateStructuredData('Mock prompt', { type: 'object' });

      expect(result).toEqual({ match_score: 95, reason: 'Excellent opportunity' });

      expect(mockGenAIInstance.getGenerativeModel).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ model: 'gemini-2.5-flash' })
      );
      expect(mockGenAIInstance.getGenerativeModel).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ model: 'gemini-1.5-flash' })
      );
    });

    test('should throw immediately on non-429 structural error without falling back', async () => {
      // Mock getSupportedModels
      const mockResponse = {
        models: [
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      };
      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const structuralErr = new Error('Invalid prompt or parameter block');
      mockModelInstance.generateContent.mockRejectedValue(structuralErr);

      await expect(generateStructuredData('Mock prompt', { type: 'object' })).rejects.toThrow('Invalid prompt or parameter block');

      expect(mockGenAIInstance.getGenerativeModel).toHaveBeenCalledTimes(1);
    });
  });
});
