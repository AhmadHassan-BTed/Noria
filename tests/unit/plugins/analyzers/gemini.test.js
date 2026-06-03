'use strict';

const { GeminiAnalyzer } = require('../../../../src/plugins/analyzers/gemini');
const { validateAnalyzerResponse } = require('../../../../src/utils/validators');
const { metrics } = require('../../../../src/utils/metrics');

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

describe('GeminiAnalyzer', () => {
  let analyzer;
  let mockProvider;
  let mockModelInstance;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'mock-api-key';
    mockModelInstance = {
      generateContent: jest.fn(),
    };
    
    analyzer = new GeminiAnalyzer({ model: 'gemini-2.5-flash' });
    analyzer.genAI.getGenerativeModel = jest.fn().mockReturnValue(mockModelInstance);

    mockProvider = {
      getSchema: jest.fn().mockReturnValue({ type: 'object' }),
      getAnalyzer: jest.fn().mockReturnValue({
        analyze: jest.fn().mockResolvedValue({
          prompt: 'Mock prompt',
          schema: { type: 'object' },
        }),
      }),
    };
    analyzer.setProvider(mockProvider);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should throw error if API key not set', () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => new GeminiAnalyzer()).toThrow('[Gemini] GEMINI_API_KEY not set in environment');
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

      const models = await analyzer.getSupportedModels();

      expect(models).toEqual([
        'gemini-2.5-flash',
        'gemini-1.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
      ]);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Verify caching: calling it again shouldn't fetch
      const models2 = await analyzer.getSupportedModels();
      expect(models2).toEqual(models);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should fall back to defaults if fetch fails', async () => {
      global.fetch.mockRejectedValue(new Error('Network failure'));

      const models = await analyzer.getSupportedModels();
      expect(models).toEqual(['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']);
    });
  });

  describe('analyze', () => {
    beforeEach(() => {
      // Mock validation to pass by default
      validateAnalyzerResponse.mockImplementation((data) => data);
    });

    test('should analyze successfully with primary model', async () => {
      analyzer._supportedModelsCache = ['gemini-2.5-flash', 'gemini-1.5-flash'];
      
      const mockGenAIResponse = {
        response: {
          text: jest.fn().mockReturnValue(JSON.stringify({ match_score: 80, reason: 'Good opportunity' })),
        },
      };
      mockModelInstance.generateContent.mockResolvedValue(mockGenAIResponse);

      const result = await analyzer.analyze('Scraped web page text', { url: 'https://test.url' });

      expect(result).toEqual({ match_score: 80, reason: 'Good opportunity' });
      expect(analyzer.genAI.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-2.5-flash' })
      );
      expect(analyzer.model).toBe('gemini-2.5-flash');
    });

    test('should fall back to next model upon hitting 429 quota error', async () => {
      analyzer._supportedModelsCache = ['gemini-2.5-flash', 'gemini-1.5-flash'];

      const quotaError = new Error('429 Too Many Requests: quota exceeded');
      
      mockModelInstance.generateContent
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce({
          response: {
            text: jest.fn().mockReturnValue(JSON.stringify({ match_score: 95, reason: 'Excellent opportunity' })),
          },
        });

      const result = await analyzer.analyze('Scraped text content', { url: 'https://test.url' });

      expect(result).toEqual({ match_score: 95, reason: 'Excellent opportunity' });
      
      expect(analyzer.genAI.getGenerativeModel).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ model: 'gemini-2.5-flash' })
      );
      expect(analyzer.genAI.getGenerativeModel).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ model: 'gemini-1.5-flash' })
      );
      
      expect(analyzer.model).toBe('gemini-1.5-flash');
    });

    test('should throw immediately on non-429 structural error without falling back', async () => {
      analyzer._supportedModelsCache = ['gemini-2.5-flash', 'gemini-1.5-flash'];

      const structuralErr = new Error('Invalid prompt or parameter block');
      mockModelInstance.generateContent.mockRejectedValue(structuralErr);

      await expect(analyzer.analyze('Scraped text content')).rejects.toThrow('Invalid prompt or parameter block');
      
      expect(analyzer.genAI.getGenerativeModel).toHaveBeenCalledTimes(1);
    });
  });
});
