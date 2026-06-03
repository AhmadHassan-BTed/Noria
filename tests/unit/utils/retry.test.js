'use strict';

const { withRetry, isRetryableError, extractRetryDelayMs } = require('../../../src/utils/retry');

describe('Retry Utility', () => {
  describe('isRetryableError', () => {
    test('should return true for network and timeout errors', () => {
      expect(isRetryableError(new Error('timeout error'))).toBe(true);
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isRetryableError(new Error('something network-related'))).toBe(true);
    });

    test('should return true for specific status codes', () => {
      const err429 = new Error('Rate limit');
      err429.status = 429;
      expect(isRetryableError(err429)).toBe(true);

      const err500 = new Error('Server error');
      err500.statusCode = 500;
      expect(isRetryableError(err500)).toBe(true);

      const err502 = new Error('Bad gateway');
      err502.status = 502;
      expect(isRetryableError(err502)).toBe(true);

      const err503 = new Error('Service unavailable');
      err503.statusCode = 503;
      expect(isRetryableError(err503)).toBe(true);
    });

    test('should return false for null, undefined, or non-retryable errors', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError(new Error('Bad request'))).toBe(false);
      
      const err400 = new Error('Bad request');
      err400.status = 400;
      expect(isRetryableError(err400)).toBe(false);
    });
  });

  describe('withRetry', () => {
    test('should execute successfully on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(mockFn);
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should retry on retryable error and succeed eventually', async () => {
      let callCount = 0;
      const retryableError = new Error('timeout');
      
      const mockFn = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw retryableError;
        }
        return 'eventual success';
      });

      const onRetryMock = jest.fn();

      const result = await withRetry(mockFn, {
        maxRetries: 3,
        baseDelayMs: 1,
        onRetry: onRetryMock,
      });

      expect(result).toBe('eventual success');
      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(onRetryMock).toHaveBeenCalledTimes(2);
      expect(onRetryMock).toHaveBeenNthCalledWith(1, {
        attempt: 1,
        maxRetries: 3,
        delay: expect.any(Number),
        error: 'timeout',
      });
    });

    test('should fail and throw last error if max retries reached', async () => {
      const retryableError = new Error('ECONNRESET');
      const mockFn = jest.fn().mockRejectedValue(retryableError);

      await expect(withRetry(mockFn, {
        maxRetries: 3,
        baseDelayMs: 1,
      })).rejects.toThrow('ECONNRESET');

      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    test('should throw immediately on non-retryable error without retrying', async () => {
      const nonRetryableError = new Error('Bad input');
      const mockFn = jest.fn().mockRejectedValue(nonRetryableError);

      await expect(withRetry(mockFn, {
        maxRetries: 3,
        baseDelayMs: 1,
      })).rejects.toThrow('Bad input');

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('extractRetryDelayMs', () => {
    test('should return null for null or missing error message', () => {
      expect(extractRetryDelayMs(null)).toBeNull();
      expect(extractRetryDelayMs(new Error())).toBeNull();
    });

    test('should extract delay from JSON format', () => {
      const err = new Error('Some error details with {"retryDelay":"48s"} block.');
      expect(extractRetryDelayMs(err)).toBe(48000);

      const errMs = new Error('Error details with {"retryDelay":"500ms"} block.');
      expect(extractRetryDelayMs(errMs)).toBe(500);
    });

    test('should extract delay from plain text format', () => {
      const err = new Error('Please retry in 48.184025976s. Some other text.');
      expect(extractRetryDelayMs(err)).toBeCloseTo(48184, 0);

      const errMs = new Error('Please retry in 100ms. Some other text.');
      expect(extractRetryDelayMs(errMs)).toBe(100);
    });

    test('should be used by withRetry to determine backoff delay', async () => {
      let calls = 0;
      const rateLimitErr = new Error('Please retry in 1.5s. Exceeded quota.');
      rateLimitErr.status = 429;

      const mockFn = jest.fn().mockImplementation(async () => {
        calls++;
        if (calls < 2) {
          throw rateLimitErr;
        }
        return 'success';
      });

      const onRetryMock = jest.fn();
      await withRetry(mockFn, {
        maxRetries: 2,
        onRetry: onRetryMock,
      });

      expect(onRetryMock).toHaveBeenCalledTimes(1);
      // parsed delay is 1500ms + 1500ms safety buffer = 3000ms
      expect(onRetryMock.mock.calls[0][0].delay).toBe(3000);
    });
  });
});
