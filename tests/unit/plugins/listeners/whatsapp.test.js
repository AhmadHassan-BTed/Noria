'use strict';

const { WhatsAppListener, SOURCE_MODE } = require('../../../../src/plugins/listeners/whatsapp');
const { initConnectionManager } = require('../../../../src/plugins/listeners/connection-manager');
const { withRetry } = require('../../../../src/utils/retry');

jest.mock('whatsapp-web.js', () => {
  const mockClientInstance = {
    initialize: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    getChats: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue({}),
  };
  return {
    Client: jest.fn().mockImplementation(() => mockClientInstance),
    LocalAuth: jest.fn(),
  };
});

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn(),
}));

jest.mock('../../../../src/plugins/listeners/connection-manager', () => ({
  initConnectionManager: jest.fn(),
  getConnectionManager: jest.fn(),
}));

jest.mock('../../../../src/utils/retry', () => ({
  withRetry: jest.fn().mockImplementation((fn) => fn()),
}));

jest.mock('../../../../src/utils/metrics', () => ({
  metrics: {
    recordWhatsAppRetry: jest.fn(),
    recordWhatsAppFailure: jest.fn(),
  },
}));

describe('WhatsAppListener', () => {
  let listener;
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new WhatsAppListener();
    mockClient = listener.client;
  });

  describe('Constructor & Configuration', () => {
    test('should construct with default configuration', () => {
      expect(listener.sourceMode).toBe(SOURCE_MODE.CHATS);
      expect(listener.allowedChannels).toEqual([]);
      expect(listener.client).toBeDefined();
    });

    test('should accept and store customized config options', () => {
      const customListener = new WhatsAppListener({
        sourceMode: 'both',
        allowedChannels: ['  123@newsletter  ', 'CS Masters Opportunity'],
      });
      expect(customListener.sourceMode).toBe(SOURCE_MODE.BOTH);
      expect(customListener.allowedChannels).toEqual(['123@newsletter', 'CS Masters Opportunity']);
    });

    test('should accept and configure sessionId and dynamic auth strategy dataPath', () => {
      const customListener = new WhatsAppListener({
        sessionId: 'user_123',
      });
      expect(customListener.sessionId).toBe('user_123');
    });

    test('should throw error on invalid sourceMode', () => {
      expect(() => {
        new WhatsAppListener({ sourceMode: 'invalid-mode' });
      }).toThrow('[WhatsAppListener] Invalid sourceMode: "invalid-mode"');
    });
  });

  describe('Source Gating & Classification', () => {
    test('_isChannelMessage should classify newsletter suffix as channel', () => {
      expect(listener._isChannelMessage({ from: '123@newsletter' })).toBe(true);
      expect(listener._isChannelMessage({ from: '923001234567@c.us' })).toBe(false);
      expect(listener._isChannelMessage({ from: '123456789@g.us' })).toBe(false);
    });

    test('_shouldProcess should deduplicate messages', async () => {
      const msg = {
        id: { _serialized: 'msg123' },
        from: '923001234567@c.us',
      };
      listener._markProcessed('msg123');

      const shouldProcess = await listener._shouldProcess(msg);
      expect(shouldProcess).toBe(false);
    });

    test('_shouldProcess should gate by SOURCE_MODE.CHATS', async () => {
      listener.sourceMode = SOURCE_MODE.CHATS;

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(true);
      expect(await listener._shouldProcess(channelMsg)).toBe(false);
    });

    test('_shouldProcess should gate by SOURCE_MODE.CHANNELS', async () => {
      listener.sourceMode = SOURCE_MODE.CHANNELS;

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(false);
      expect(await listener._shouldProcess(channelMsg)).toBe(true);
    });

    test('_shouldProcess should gate by SOURCE_MODE.BOTH', async () => {
      listener.sourceMode = SOURCE_MODE.BOTH;

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(true);
      expect(await listener._shouldProcess(channelMsg)).toBe(true);
    });
  });

  describe('Channel Whitelist & Name Resolution', () => {
    test('should allow whitelisted channel by exact ID', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'channels',
        allowedChannels: ['target-channel@newsletter'],
      });

      const msg = {
        id: { _serialized: 'msg-ch' },
        from: 'target-channel@newsletter',
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
    });

    test('should allow whitelisted channel by resolved display name', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'channels',
        allowedChannels: ['Scholarship Alerts'],
      });

      const getChatMock = jest.fn().mockResolvedValue({
        name: 'Scholarship Alerts',
      });
      const msg = {
        id: { _serialized: 'msg-ch' },
        from: 'another-channel@newsletter',
        getChat: getChatMock,
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
      expect(getChatMock).toHaveBeenCalled();
      
      // Secondary check should hits cache without calling getChat again
      getChatMock.mockClear();
      expect(await listener._shouldProcess(msg)).toBe(true);
      expect(getChatMock).not.toHaveBeenCalled();
    });

    test('should fail closed when channel display name cannot be resolved', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'channels',
        allowedChannels: ['Scholarship Alerts'],
      });

      const msg = {
        id: { _serialized: 'msg-ch' },
        from: 'another-channel@newsletter',
        getChat: jest.fn().mockRejectedValue(new Error('Network failure')),
      };

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await listener._shouldProcess(msg)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Deduplication Cache Size Control', () => {
    test('should enforce MAX_DEDUP_CACHE_SIZE', () => {
      for (let i = 0; i < 2005; i++) {
        listener._markProcessed(`msg-${i}`);
      }
      expect(listener._processedIds.size).toBe(2000);
      // Oldest element should be evicted
      expect(listener._processedIds.has('msg-0')).toBe(false);
      expect(listener._processedIds.has('msg-5')).toBe(true);
    });
  });

  describe('_handleMessage Pipeline & Emission', () => {
    test('should ignore message if _shouldProcess resolves false', async () => {
      const msg = { id: { _serialized: 'msg123' }, from: '923001234567@c.us' };
      listener._markProcessed('msg123');

      const emitSpy = jest.spyOn(listener, '_emit');
      await listener._handleMessage(msg);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    test('should ignore message if body is missing or has no URL', async () => {
      const msg = {
        id: { _serialized: 'msg124' },
        from: '923001234567@c.us',
        body: 'Just a normal text message without link.',
      };

      const emitSpy = jest.spyOn(listener, '_emit');
      await listener._handleMessage(msg);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    test('should extract URL and emit structured link_extracted event', async () => {
      const msg = {
        id: { _serialized: 'msg125' },
        from: '923001234567@c.us',
        body: 'Check out this website: https://scholarships.org/apply-now right here!',
      };

      const emitSpy = jest.spyOn(listener, '_emit');
      await listener._handleMessage(msg);

      expect(emitSpy).toHaveBeenCalledWith('link_extracted', {
        url: 'https://scholarships.org/apply-now',
        source: 'chat',
        channelId: null,
        channelName: null,
        messageId: 'msg125',
        timestamp: expect.any(Date),
      });
    });

    test('should include channel name in payload for channel source', async () => {
      listener.sourceMode = SOURCE_MODE.BOTH;
      const msg = {
        id: { _serialized: 'msg-ch-1' },
        from: '12345@newsletter',
        body: 'Apply at https://careers.google.com/jobs',
        getChat: jest.fn().mockResolvedValue({ name: 'Google Jobs' }),
      };

      const emitSpy = jest.spyOn(listener, '_emit');
      await listener._handleMessage(msg);

      expect(emitSpy).toHaveBeenCalledWith('link_extracted', {
        url: 'https://careers.google.com/jobs',
        source: 'channel',
        channelId: '12345@newsletter',
        channelName: 'Google Jobs',
        messageId: 'msg-ch-1',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Lifecycle & Pre-fetching', () => {
    test('initialize resolves on client ready and pre-fetches channels', async () => {
      const mockGetChats = jest.fn().mockResolvedValue([
        { id: { _serialized: 'chat1@newsletter' }, name: 'Channel One' },
        { id: { _serialized: 'chat2@c.us' }, name: 'User' },
      ]);
      mockClient.getChats = mockGetChats;
      listener.sourceMode = SOURCE_MODE.BOTH;

      const initPromise = listener.initialize();

      // Simulate Ready event
      const readyCallback = mockClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
      await readyCallback();

      await expect(initPromise).resolves.toBeUndefined();
      expect(initConnectionManager).toHaveBeenCalledWith(mockClient, 'default');
      expect(mockGetChats).toHaveBeenCalled();
      expect(listener._channelCache.get('chat1@newsletter').name).toBe('Channel One');
    });

    test('close destroys client and clears connection', async () => {
      await listener.close();
      expect(mockClient.destroy).toHaveBeenCalled();
    });
  });

  describe('Subscribed Channels Utility', () => {
    test('getSubscribedChannels filters and returns channel IDs and names', async () => {
      mockClient.getChats.mockResolvedValue([
        { id: { _serialized: '123@newsletter' }, name: 'Opportunities Channel' },
        { id: { _serialized: '999@c.us' }, name: 'A Friend' },
      ]);

      const channels = await listener.getSubscribedChannels();
      expect(channels).toEqual([
        { id: '123@newsletter', name: 'Opportunities Channel' },
      ]);
    });
  });

  describe('Outgoing Notifications', () => {
    test('send calls client sendMessage with retry', async () => {
      await listener.send('923001234567', 'Test Message');
      expect(mockClient.sendMessage).toHaveBeenCalledWith('923001234567@c.us', 'Test Message');
    });
  });
});
