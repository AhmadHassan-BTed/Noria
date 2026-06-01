'use strict';

const {
  validateUrl,
  validateScraperPayload,
  validateAnalyzerResponse,
  validateContent,
  MIN_CONTENT_LENGTH,
} = require('../../../src/utils/validators');

describe('Validators Utility', () => {
  describe('validateUrl', () => {
    test('should return trimmed URL when valid', () => {
      const input = '  https://example.com/scholarship  ';
      const result = validateUrl(input);
      expect(result).toBe('https://example.com/scholarship');
    });

    test('should throw error for non-string input', () => {
      expect(() => validateUrl(123)).toThrow('Invalid URL: received number, expected non-empty string');
      expect(() => validateUrl(null)).toThrow('Invalid URL: received object, expected non-empty string');
    });

    test('should throw error for empty or invalid URL format', () => {
      expect(() => validateUrl('')).toThrow('Invalid URL: received string, expected non-empty string');
      expect(() => validateUrl('http://')).toThrow('Invalid URL format: http://');
      expect(() => validateUrl('ftp://example.com')).toThrow('Invalid URL format: ftp://example.com');
    });

    test('should throw error for URL exceeding max length', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2040);
      expect(() => validateUrl(longUrl)).toThrow('URL exceeds max length');
    });
  });

  describe('validateScraperPayload', () => {
    test('should return formatted payload when valid', () => {
      const payload = {
        url: 'https://example.com/job',
        text: 'This is a very long text representing opportunity details that easily exceeds the minimum required characters for validation. Let us add some more characters just to be absolutely sure that it is valid.',
      };
      const result = validateScraperPayload(payload);
      expect(result.url).toBe(payload.url);
      expect(result.text).toBe(payload.text);
    });

    test('should throw error if payload is not an object', () => {
      expect(() => validateScraperPayload(null)).toThrow('Invalid scraper payload: expected object');
      expect(() => validateScraperPayload('payload')).toThrow('Invalid scraper payload: expected object');
    });

    test('should throw error if url is missing or not a string', () => {
      const invalid = { text: 'a'.repeat(300) };
      expect(() => validateScraperPayload(invalid)).toThrow("Scraper payload missing valid 'url'");
    });

    test('should throw error if text is missing or not a string', () => {
      const invalid = { url: 'https://example.com' };
      expect(() => validateScraperPayload(invalid)).toThrow("Scraper payload missing valid 'text'");
    });

    test('should throw error if scraped content is too short', () => {
      const payload = {
        url: 'https://example.com',
        text: 'Short content',
      };
      expect(() => validateScraperPayload(payload)).toThrow('Scraped content too short');
    });
  });

  describe('validateAnalyzerResponse', () => {
    const validResponse = {
      match_score: 85,
      uni_country: 'Germany',
      scholarship_name: 'DAAD Scholarship',
      program_name: 'Computer Science',
      deadline: '2026-10-15',
      fully_funded: true,
      english_taught: true,
      post_study_visa: true,
      verdict: 'Excellent match',
      apply_link: 'https://daad.de/apply',
      official_link: 'https://daad.de',
    };

    test('should return response when all fields are valid', () => {
      const result = validateAnalyzerResponse(validResponse);
      expect(result).toEqual(validResponse);
    });

    test('should throw error if response is not an object', () => {
      expect(() => validateAnalyzerResponse(null)).toThrow('Analyzer response invalid: expected object');
    });

    test('should throw error if required field is missing or empty', () => {
      const missingField = { ...validResponse };
      delete missingField.match_score;
      expect(() => validateAnalyzerResponse(missingField)).toThrow("Analyzer response missing required field: 'match_score'");

      const emptyField = { ...validResponse, uni_country: '' };
      expect(() => validateAnalyzerResponse(emptyField)).toThrow("Analyzer response field 'uni_country' is empty or null");
    });

    test('should throw error if match_score is not a number or out of bounds', () => {
      const invalidType = { ...validResponse, match_score: '85' };
      expect(() => validateAnalyzerResponse(invalidType)).toThrow("Analyzer 'match_score' must be a number");

      const lowScore = { ...validResponse, match_score: -5 };
      expect(() => validateAnalyzerResponse(lowScore)).toThrow("Analyzer 'match_score' out of range (0-100)");

      const highScore = { ...validResponse, match_score: 105 };
      expect(() => validateAnalyzerResponse(highScore)).toThrow("Analyzer 'match_score' out of range (0-100)");
    });

    test('should throw error if boolean fields are not boolean', () => {
      const invalidFullyFunded = { ...validResponse, fully_funded: 'yes' };
      expect(() => validateAnalyzerResponse(invalidFullyFunded)).toThrow("Analyzer 'fully_funded' must be boolean");

      const invalidEnglish = { ...validResponse, english_taught: null };
      expect(() => validateAnalyzerResponse(invalidEnglish)).toThrow("Analyzer response field 'english_taught' is empty or null");
    });
  });

  describe('validateContent', () => {
    test('should return true for long content', () => {
      const content = 'a'.repeat(MIN_CONTENT_LENGTH + 10);
      expect(validateContent(content)).toBe(true);
    });

    test('should return false for short content', () => {
      expect(validateContent('short')).toBe(false);
    });

    test('should return false for non-string content', () => {
      expect(validateContent(null)).toBe(false);
      expect(validateContent(123)).toBe(false);
    });
  });
});
