'use strict';

const { sendMessage, normaliseChatId, maskChatId } = require('../../../../src/infrastructure/messaging/whatsapp-sender');
const { withRetry } = require('../../../../src/utils/retry');

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

describe('WhatsApp Sender', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = {
      sendMessage: jest.fn().mockResolvedValue({ id: { _serialized: 'msg123' } }),
    };
  });

  describe('normaliseChatId', () => {
    test('should accept already-qualified c.us chatId', () => {
      expect(normaliseChatId('923001234567@c.us')).toBe('923001234567@c.us');
    });

    test('should accept already-qualified g.us chatId', () => {
      expect(normaliseChatId('1234567890@g.us')).toBe('1234567890@g.us');
    });

    test('should normalise raw phone numbers', () => {
      expect(normaliseChatId('+92 300 1234567')).toBe('923001234567@c.us');
      expect(normaliseChatId('00923001234567')).toBe('00923001234567@c.us');
    });
  });

  describe('maskChatId', () => {
    test('should mask private phone number details', () => {
      expect(maskChatId('923001234567@c.us')).toBe('9230*****567@c.us');
    });

    test('should handle short ids', () => {
      expect(maskChatId('123@newsletter')).toBe('***@newsletter');
    });
  });

  describe('sendMessage', () => {
    test('should throw error when client is missing', async () => {
      await expect(sendMessage(null, '923001234567', 'test')).rejects.toThrow('client is not available');
    });

    test('should throw error when target is missing', async () => {
      await expect(sendMessage(mockClient, null, 'test')).rejects.toThrow('No target specified');
    });

    test('should throw error when target ends with @newsletter', async () => {
      await expect(sendMessage(mockClient, '12345@newsletter', 'test')).rejects.toThrow('Cannot send to a channel');
    });

    test('should throw error when number resolves to less than 7 digits', async () => {
      await expect(sendMessage(mockClient, '12345', 'test')).rejects.toThrow('too short to be a valid phone number');
    });

    test('should throw error for empty or non-string messages', async () => {
      await expect(sendMessage(mockClient, '923001234567', null)).rejects.toThrow('Message body is empty');
      await expect(sendMessage(mockClient, '923001234567', '')).rejects.toThrow('Message body is empty');
      await expect(sendMessage(mockClient, '923001234567', '   ')).rejects.toThrow('Message body is empty');
    });

    test('should send message successfully and record metrics', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await sendMessage(mockClient, '923009876543', '*Hello World*');

      expect(mockClient.sendMessage).toHaveBeenCalledWith('923009876543@c.us', '*Hello World*');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Delivered to 9230*****543@c.us'));

      consoleLogSpy.mockRestore();
    });

    test('should retry on transient error and bubble up on final failure', async () => {
      const error = new Error('Network timeout');
      mockClient.sendMessage.mockRejectedValue(error);

      await expect(sendMessage(mockClient, '923009876543', 'Retry message')).rejects.toThrow('Network timeout');

      expect(withRetry).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          maxRetries: 3,
          baseDelayMs: 1000,
          onRetry: expect.any(Function),
        })
      );
    });
  });
});
