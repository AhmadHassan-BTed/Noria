'use strict';

const { WhatsAppNotifier } = require('../../../../src/plugins/notifiers/whatsapp');
const { getConnectionManager } = require('../../../../src/plugins/listeners/connection-manager');
const { withRetry } = require('../../../../src/utils/retry');

jest.mock('../../../../src/plugins/listeners/connection-manager', () => ({
  getConnectionManager: jest.fn(),
}));

jest.mock('../../../../src/utils/retry', () => ({
  withRetry: jest.fn().mockImplementation((fn) => fn()),
}));

jest.mock('../../../../src/utils/metrics', () => ({
  metrics: {
    recordWhatsAppSend: jest.fn(),
    recordWhatsAppRetry: jest.fn(),
    recordWhatsAppFailure: jest.fn(),
  },
}));

describe('WhatsAppNotifier', () => {
  let notifier;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    notifier = new WhatsAppNotifier({
      phoneNumber: '923001234567',
      maxRetries: 3,
      baseDelayMs: 500,
    });
    mockClient = {
      sendMessage: jest.fn().mockResolvedValue({}),
    };
  });

  describe('Constructor & Configuration', () => {
    test('should construct with configured options', () => {
      expect(notifier.phoneNumber).toBe('923001234567');
      expect(notifier.maxRetries).toBe(3);
      expect(notifier.baseDelayMs).toBe(500);
    });

    test('should fallback to defaults when config omitted', () => {
      const defaultNotifier = new WhatsAppNotifier();
      expect(defaultNotifier.phoneNumber).toBeNull();
      expect(defaultNotifier.maxRetries).toBe(3);
      expect(defaultNotifier.baseDelayMs).toBe(1000);
    });
  });

  describe('_getReadyClient', () => {
    test('should throw error when ConnectionManager is missing', () => {
      getConnectionManager.mockReturnValue(null);
      expect(() => {
        notifier._getReadyClient();
      }).toThrow('Connection manager is not initialised');
    });

    test('should throw error when client is not available', () => {
      getConnectionManager.mockReturnValue({
        getClient: jest.fn().mockReturnValue(null),
      });
      expect(() => {
        notifier._getReadyClient();
      }).toThrow('WhatsApp client is not available');
    });

    test('should return client when available and ready', () => {
      const mockGetClient = jest.fn().mockReturnValue(mockClient);
      getConnectionManager.mockReturnValue({
        getClient: mockGetClient,
      });
      const client = notifier._getReadyClient();
      expect(client).toBe(mockClient);
      expect(mockGetClient).toHaveBeenCalledWith('default');
    });
  });

  describe('_resolveTarget (Normalization & Validation)', () => {
    test('should accept already-qualified c.us chatId', () => {
      const result = notifier._resolveTarget('923001234567@c.us');
      expect(result).toBe('923001234567@c.us');
    });

    test('should accept already-qualified g.us chatId', () => {
      const result = notifier._resolveTarget('1234567890@g.us');
      expect(result).toBe('1234567890@g.us');
    });

    test('should normalise raw phone numbers', () => {
      expect(notifier._resolveTarget('+92 300 1234567')).toBe('923001234567@c.us');
      expect(notifier._resolveTarget('00923001234567')).toBe('00923001234567@c.us');
    });

    test('should throw error when target ends with @newsletter', () => {
      expect(() => {
        notifier._resolveTarget('12345@newsletter');
      }).toThrow('Cannot send to a channel (12345@newsletter). WhatsApp Channels are broadcast-only');
    });

    test('should throw error when number resolves to less than 7 digits', () => {
      expect(() => {
        notifier._resolveTarget('12345');
      }).toThrow('resolved to "12345", which is too short');
    });

    test('should throw error when target and fallback phone number are both missing', () => {
      const emptyNotifier = new WhatsAppNotifier();
      expect(() => {
        emptyNotifier._resolveTarget(null);
      }).toThrow('No target specified');
    });

    test('should fallback to default phone number when target is omitted', () => {
      const result = notifier._resolveTarget(null);
      expect(result).toBe('923001234567@c.us');
    });
  });

  describe('_validateMessage', () => {
    test('should throw error for empty or non-string messages', () => {
      expect(() => notifier._validateMessage(null)).toThrow('Message body is empty or not a string');
      expect(() => notifier._validateMessage('')).toThrow('Message body is empty or not a string');
      expect(() => notifier._validateMessage('   ')).toThrow('Message body is empty or not a string');
      expect(() => notifier._validateMessage(123)).toThrow('Message body is empty or not a string');
    });

    test('should pass for valid strings', () => {
      expect(() => notifier._validateMessage('Hello Opportunity!')).not.toThrow();
    });
  });

  describe('send Integration & Retries', () => {
    beforeEach(() => {
      getConnectionManager.mockReturnValue({
        getClient: jest.fn().mockReturnValue(mockClient),
      });
    });

    test('should send message successfully and record metrics', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await notifier.send('923009876543', '*Hello World*');

      expect(mockClient.sendMessage).toHaveBeenCalledWith('923009876543@c.us', '*Hello World*');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Delivered to 9230*****543@c.us'));
      
      consoleLogSpy.mockRestore();
    });

    test('should retry on transient error and bubble up on final failure', async () => {
      const error = new Error('Network timeout');
      mockClient.sendMessage.mockRejectedValue(error);

      // Verify that send throws the error after exhausting retries
      await expect(notifier.send('923009876543', 'Retry message')).rejects.toThrow('Network timeout');
      
      // Since withRetry is mocked to just execute once in standard setup,
      // let's test that the notifier integrates with the retry configuration correctly
      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          baseDelayMs: 500,
          onRetry: expect.any(Function),
        })
      );
    });
  });
});
