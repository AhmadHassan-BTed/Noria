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
    pupPage: {
      exposeFunction: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue([
        { id: 'chat1@newsletter', name: 'Channel One' }
      ]),
    }
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
    test('should construct with default configuration (chats → [individual, groups])', () => {
      expect(listener.sourceMode).toEqual(['individual', 'groups']);
      expect(listener.allowedChannels).toEqual([]);
      expect(listener.client).toBeDefined();
    });

    test('should accept and store customized config options (both → all origins)', () => {
      const customListener = new WhatsAppListener({
        sourceMode: 'both',
        allowedChannels: ['  123@newsletter  ', 'CS Masters Opportunity'],
      });
      expect(customListener.sourceMode).toEqual(['individual', 'groups', 'channels']);
      expect(customListener.allowedChannels).toEqual(['123@newsletter', 'CS Masters Opportunity']);
    });

    test('should accept array-based sourceMode', () => {
      const customListener = new WhatsAppListener({
        sourceMode: ['individual', 'channels'],
      });
      expect(customListener.sourceMode).toEqual(['individual', 'channels']);
    });

    test('should accept comma-separated string sourceMode', () => {
      const customListener = new WhatsAppListener({
        sourceMode: 'groups,channels',
      });
      expect(customListener.sourceMode).toEqual(['groups', 'channels']);
    });

    test('should accept single origin string sourceMode', () => {
      const customListener = new WhatsAppListener({
        sourceMode: 'individual',
      });
      expect(customListener.sourceMode).toEqual(['individual']);
    });

    test('should normalize "all" to all three origins', () => {
      const customListener = new WhatsAppListener({
        sourceMode: 'all',
      });
      expect(customListener.sourceMode).toEqual(['individual', 'groups', 'channels']);
    });

    test('should normalize "channels" to [channels]', () => {
      const customListener = new WhatsAppListener({
        sourceMode: 'channels',
      });
      expect(customListener.sourceMode).toEqual(['channels']);
    });

    test('should accept and configure sessionId and dynamic auth strategy dataPath', () => {
      const customListener = new WhatsAppListener({
        sessionId: 'user_123',
      });
      expect(customListener.sessionId).toBe('user_123');
    });

    test('should throw error on invalid sourceMode string', () => {
      expect(() => {
        new WhatsAppListener({ sourceMode: 'invalid-mode' });
      }).toThrow('[sourceMode] Invalid sourceMode: "invalid-mode"');
    });

    test('should throw error on empty array sourceMode', () => {
      expect(() => {
        new WhatsAppListener({ sourceMode: ['bogus', 'nope'] });
      }).toThrow('[sourceMode] Invalid sourceMode array');
    });

    test('should throw error on empty comma-separated string', () => {
      expect(() => {
        new WhatsAppListener({ sourceMode: 'bogus,nope' });
      }).toThrow('[sourceMode] Invalid sourceMode');
    });
  });

  describe('_classifyOrigin', () => {
    test('should classify @newsletter as channels', () => {
      expect(listener._classifyOrigin({ from: '123@newsletter' })).toBe('channels');
    });

    test('should classify @g.us as groups', () => {
      expect(listener._classifyOrigin({ from: '123456789@g.us' })).toBe('groups');
    });

    test('should classify @c.us as individual', () => {
      expect(listener._classifyOrigin({ from: '923001234567@c.us' })).toBe('individual');
    });

    test('should classify unknown suffix as individual (fallback)', () => {
      expect(listener._classifyOrigin({ from: '12345@unknown' })).toBe('individual');
    });
  });

  describe('_isSourceAllowed', () => {
    test('should allow channel messages when channels is in sourceMode', () => {
      listener.sourceMode = ['channels'];
      expect(listener._isSourceAllowed({ from: '123@newsletter' })).toBe(true);
    });

    test('should reject channel messages when channels is NOT in sourceMode', () => {
      listener.sourceMode = ['individual', 'groups'];
      expect(listener._isSourceAllowed({ from: '123@newsletter' })).toBe(false);
    });

    test('should allow group messages when groups is in sourceMode', () => {
      listener.sourceMode = ['groups'];
      expect(listener._isSourceAllowed({ from: '123@g.us' })).toBe(true);
    });

    test('should reject group messages when groups is NOT in sourceMode', () => {
      listener.sourceMode = ['individual', 'channels'];
      expect(listener._isSourceAllowed({ from: '123@g.us' })).toBe(false);
    });

    test('should allow individual messages when individual is in sourceMode', () => {
      listener.sourceMode = ['individual'];
      expect(listener._isSourceAllowed({ from: '923001234567@c.us' })).toBe(true);
    });

    test('should reject individual messages when individual is NOT in sourceMode', () => {
      listener.sourceMode = ['groups', 'channels'];
      expect(listener._isSourceAllowed({ from: '923001234567@c.us' })).toBe(false);
    });

    test('should allow all origins when sourceMode includes all three', () => {
      listener.sourceMode = ['individual', 'groups', 'channels'];
      expect(listener._isSourceAllowed({ from: '123@newsletter' })).toBe(true);
      expect(listener._isSourceAllowed({ from: '123@g.us' })).toBe(true);
      expect(listener._isSourceAllowed({ from: '923001234567@c.us' })).toBe(true);
    });

    test('should allow only individual when sourceMode is [individual]', () => {
      listener.sourceMode = ['individual'];
      expect(listener._isSourceAllowed({ from: '123@newsletter' })).toBe(false);
      expect(listener._isSourceAllowed({ from: '123@g.us' })).toBe(false);
      expect(listener._isSourceAllowed({ from: '923001234567@c.us' })).toBe(true);
    });

    test('should allow groups and channels but not individual', () => {
      listener.sourceMode = ['groups', 'channels'];
      expect(listener._isSourceAllowed({ from: '123@newsletter' })).toBe(true);
      expect(listener._isSourceAllowed({ from: '123@g.us' })).toBe(true);
      expect(listener._isSourceAllowed({ from: '923001234567@c.us' })).toBe(false);
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

    test('_shouldProcess should gate by sourceMode chats → [individual, groups]', async () => {
      listener.sourceMode = ['individual', 'groups']; // equivalent to legacy 'chats'

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const groupMsg = { id: { _serialized: 'msg-group' }, from: '123@g.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(true);
      expect(await listener._shouldProcess(groupMsg)).toBe(true);
      expect(await listener._shouldProcess(channelMsg)).toBe(false);
    });

    test('_shouldProcess should gate by sourceMode channels → [channels]', async () => {
      listener.sourceMode = ['channels'];

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const groupMsg = { id: { _serialized: 'msg-group' }, from: '123@g.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(false);
      expect(await listener._shouldProcess(groupMsg)).toBe(false);
      expect(await listener._shouldProcess(channelMsg)).toBe(true);
    });

    test('_shouldProcess should gate by sourceMode both → all origins', async () => {
      listener.sourceMode = ['individual', 'groups', 'channels'];

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const groupMsg = { id: { _serialized: 'msg-group' }, from: '123@g.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(true);
      expect(await listener._shouldProcess(groupMsg)).toBe(true);
      expect(await listener._shouldProcess(channelMsg)).toBe(true);
    });

    test('_shouldProcess should gate individual-only mode', async () => {
      listener.sourceMode = ['individual'];

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const groupMsg = { id: { _serialized: 'msg-group' }, from: '123@g.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(true);
      expect(await listener._shouldProcess(groupMsg)).toBe(false);
      expect(await listener._shouldProcess(channelMsg)).toBe(false);
    });

    test('_shouldProcess should gate groups+channels mode (no individual)', async () => {
      listener.sourceMode = ['groups', 'channels'];

      const chatMsg = { id: { _serialized: 'msg-chat' }, from: '923001234567@c.us' };
      const groupMsg = { id: { _serialized: 'msg-group' }, from: '123@g.us' };
      const channelMsg = { id: { _serialized: 'msg-channel' }, from: '123@newsletter' };

      expect(await listener._shouldProcess(chatMsg)).toBe(false);
      expect(await listener._shouldProcess(groupMsg)).toBe(true);
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

  describe('Group Whitelist & Name Resolution', () => {
    test('should allow whitelisted group by exact ID', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'groups',
        allowedGroups: ['target-group@g.us'],
      });

      const msg = {
        id: { _serialized: 'msg-grp' },
        from: 'target-group@g.us',
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
    });

    test('should allow whitelisted group by resolved display name', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'groups',
        allowedGroups: ['Scholarship Group'],
      });

      const getChatMock = jest.fn().mockResolvedValue({
        name: 'Scholarship Group',
      });
      const msg = {
        id: { _serialized: 'msg-grp' },
        from: 'another-group@g.us',
        getChat: getChatMock,
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
      expect(getChatMock).toHaveBeenCalled();
    });
  });

  describe('Chat Whitelist & Name Resolution', () => {
    test('should allow whitelisted chat by exact ID', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'individual',
        allowedChats: ['923217744858@c.us'],
      });

      const msg = {
        id: { _serialized: 'msg-chat' },
        from: '923217744858@c.us',
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
    });

    test('should allow whitelisted chat by phone number', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'individual',
        allowedChats: ['923217744858'],
      });

      const msg = {
        id: { _serialized: 'msg-chat' },
        from: '923217744858@c.us',
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
    });

    test('should allow whitelisted chat by resolved display name', async () => {
      listener = new WhatsAppListener({
        sourceMode: 'individual',
        allowedChats: ['John Doe'],
      });

      const getChatMock = jest.fn().mockResolvedValue({
        name: 'John Doe',
      });
      const msg = {
        id: { _serialized: 'msg-chat' },
        from: '923217744858@c.us',
        getChat: getChatMock,
      };

      expect(await listener._shouldProcess(msg)).toBe(true);
      expect(getChatMock).toHaveBeenCalled();
    });
  });

  describe('Background Groups and Chats Discovery', () => {
    test('should discover groups and chats in parallel and save to status file', async () => {
      const mockGetChats = jest.fn().mockResolvedValue([
        { id: { _serialized: 'group1@g.us', user: 'group1' }, name: 'My Group', isGroup: true },
        { id: { _serialized: 'user1@c.us', user: 'user1', server: 'c.us' }, name: 'My Friend', isGroup: false },
      ]);
      mockClient.getChats = mockGetChats;

      const updateSpy = jest.spyOn(listener, '_updateStatusFile').mockImplementation(() => {});

      await listener._discoverGroupsAndChats();
      // Wait for background events to execute
      await new Promise(r => setTimeout(r, 20));

      expect(mockGetChats).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith({ groups: ['My Group'] });
      expect(updateSpy).toHaveBeenCalledWith({ chats: ['My Friend'] });
      expect(listener._groupCache.get('group1@g.us').name).toBe('My Group');
      expect(listener._chatCache.get('user1@c.us').name).toBe('My Friend');
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
        messageText: 'Check out this website: https://scholarships.org/apply-now right here!',
      });
    });

    test('should include channel name in payload for channel source', async () => {
      listener.sourceMode = ['individual', 'groups', 'channels'];
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
        messageText: 'Apply at https://careers.google.com/jobs',
      });
    });

    test('should emit source "group" for group messages', async () => {
      listener.sourceMode = ['individual', 'groups', 'channels'];
      const msg = {
        id: { _serialized: 'msg-grp-1' },
        from: '12345@g.us',
        body: 'Check https://example.com/opportunity',
      };

      const emitSpy = jest.spyOn(listener, '_emit');
      await listener._handleMessage(msg);

      expect(emitSpy).toHaveBeenCalledWith('link_extracted', expect.objectContaining({
        source: 'group',
        channelId: null,
        channelName: null,
      }));
    });

    test('should filter group messages when groups not in sourceMode', async () => {
      listener.sourceMode = ['individual', 'channels']; // no groups
      const msg = {
        id: { _serialized: 'msg-grp-2' },
        from: '12345@g.us',
        body: 'Check https://example.com/opportunity',
      };

      const emitSpy = jest.spyOn(listener, '_emit');
      await listener._handleMessage(msg);
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Lifecycle & Pre-fetching', () => {
    test('initialize resolves on client ready and pre-fetches channels', async () => {
      const mockGetChats = jest.fn().mockResolvedValue([
        { id: { _serialized: 'chat1@newsletter' }, name: 'Channel One' },
        { id: { _serialized: 'chat2@c.us' }, name: 'User' },
      ]);
      mockClient.getChats = mockGetChats;
      listener.sourceMode = ['individual', 'groups', 'channels'];

      const initPromise = listener.initialize();

      // Simulate Ready event
      const readyCallback = mockClient.on.mock.calls.find((call) => call[0] === 'ready')[1];
      await readyCallback();

      await expect(initPromise).resolves.toBeUndefined();
      expect(initConnectionManager).toHaveBeenCalledWith(mockClient, 'default');
      
      // Wait for background channel discovery to run asynchronously
      await new Promise((r) => setTimeout(r, 50));
      
      expect(mockClient.pupPage.evaluate).toHaveBeenCalled();
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