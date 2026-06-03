const {
  getMsgChatId,
  isChannelMessage,
  isGroupMessage,
  isIndividualMessage,
  classifyOrigin,
  isSourceAllowed,
} = require('../../../../src/plugins/listeners/source-classifier');

describe('source-classifier module', () => {
  // =========================================================================
  // getMsgChatId
  // =========================================================================

  describe('getMsgChatId', () => {
    test('returns group JID from msg.from if it ends with @g.us', () => {
      expect(getMsgChatId({ from: '123@g.us', to: '456@c.us' })).toBe('123@g.us');
    });

    test('returns group JID from msg.to if it ends with @g.us', () => {
      expect(getMsgChatId({ from: '456@c.us', to: '123@g.us' })).toBe('123@g.us');
    });

    test('returns channel JID from msg.from if it ends with @newsletter', () => {
      expect(getMsgChatId({ from: '123@newsletter', to: '456@c.us' })).toBe('123@newsletter');
    });

    test('returns channel JID from msg.to if it ends with @newsletter', () => {
      expect(getMsgChatId({ from: '456@c.us', to: '123@newsletter' })).toBe('123@newsletter');
    });

    test('returns msg.from for incoming individual message (fromMe false)', () => {
      expect(getMsgChatId({ from: '123@c.us', to: '456@c.us', fromMe: false })).toBe('123@c.us');
      expect(getMsgChatId({ from: '123@c.us', to: '456@c.us' })).toBe('123@c.us');
    });

    test('returns msg.to for outgoing individual message (fromMe true)', () => {
      expect(getMsgChatId({ from: '123@c.us', to: '456@c.us', fromMe: true })).toBe('456@c.us');
    });

    test('returns empty string if message is undefined or empty', () => {
      expect(getMsgChatId(null)).toBe('');
      expect(getMsgChatId({})).toBe(undefined);
    });
  });
  // =========================================================================
  // isChannelMessage
  // =========================================================================

  describe('isChannelMessage', () => {
    test('returns true for @newsletter suffix', () => {
      expect(isChannelMessage({ from: '123@newsletter' })).toBe(true);
    });

    test('returns false for @g.us suffix', () => {
      expect(isChannelMessage({ from: '123@g.us' })).toBe(false);
    });

    test('returns false for @c.us suffix', () => {
      expect(isChannelMessage({ from: '923001234567@c.us' })).toBe(false);
    });

    test('returns false for missing from', () => {
      expect(isChannelMessage({})).toBe(false);
    });

    test('returns false for non-string from', () => {
      expect(isChannelMessage({ from: 12345 })).toBe(false);
    });
  });

  // =========================================================================
  // isGroupMessage
  // =========================================================================

  describe('isGroupMessage', () => {
    test('returns true for @g.us suffix', () => {
      expect(isGroupMessage({ from: '123@g.us' })).toBe(true);
    });

    test('returns false for @newsletter suffix', () => {
      expect(isGroupMessage({ from: '123@newsletter' })).toBe(false);
    });

    test('returns false for @c.us suffix', () => {
      expect(isGroupMessage({ from: '923001234567@c.us' })).toBe(false);
    });

    test('returns false for missing from', () => {
      expect(isGroupMessage({})).toBe(false);
    });
  });

  // =========================================================================
  // isIndividualMessage
  // =========================================================================

  describe('isIndividualMessage', () => {
    test('returns true for @c.us suffix', () => {
      expect(isIndividualMessage({ from: '923001234567@c.us' })).toBe(true);
    });

    test('returns true for unknown suffix (fallback)', () => {
      expect(isIndividualMessage({ from: '12345@unknown' })).toBe(true);
    });

    test('returns false for @newsletter suffix', () => {
      expect(isIndividualMessage({ from: '123@newsletter' })).toBe(false);
    });

    test('returns false for @g.us suffix', () => {
      expect(isIndividualMessage({ from: '123@g.us' })).toBe(false);
    });
  });

  // =========================================================================
  // classifyOrigin
  // =========================================================================

  describe('classifyOrigin', () => {
    test('classifies @newsletter as "channels"', () => {
      expect(classifyOrigin({ from: '123@newsletter' })).toBe('channels');
    });

    test('classifies @g.us as "groups"', () => {
      expect(classifyOrigin({ from: '123456789@g.us' })).toBe('groups');
    });

    test('classifies @c.us as "individual"', () => {
      expect(classifyOrigin({ from: '923001234567@c.us' })).toBe('individual');
    });

    test('classifies unknown suffix as "individual" (fallback)', () => {
      expect(classifyOrigin({ from: '12345@unknown' })).toBe('individual');
    });

    test('classifies missing from as "individual" (fallback)', () => {
      expect(classifyOrigin({})).toBe('individual');
    });
  });

  // =========================================================================
  // isSourceAllowed
  // =========================================================================

  describe('isSourceAllowed', () => {
    test('allows channel when "channels" is in allowedOrigins', () => {
      expect(isSourceAllowed({ from: '123@newsletter' }, ['channels'])).toBe(true);
    });

    test('rejects channel when "channels" is NOT in allowedOrigins', () => {
      expect(isSourceAllowed({ from: '123@newsletter' }, ['individual', 'groups'])).toBe(false);
    });

    test('allows group when "groups" is in allowedOrigins', () => {
      expect(isSourceAllowed({ from: '123@g.us' }, ['groups'])).toBe(true);
    });

    test('rejects group when "groups" is NOT in allowedOrigins', () => {
      expect(isSourceAllowed({ from: '123@g.us' }, ['individual', 'channels'])).toBe(false);
    });

    test('allows individual when "individual" is in allowedOrigins', () => {
      expect(isSourceAllowed({ from: '923001234567@c.us' }, ['individual'])).toBe(true);
    });

    test('rejects individual when "individual" is NOT in allowedOrigins', () => {
      expect(isSourceAllowed({ from: '923001234567@c.us' }, ['groups', 'channels'])).toBe(false);
    });

    test('allows all when all three origins are present', () => {
      const all = ['individual', 'groups', 'channels'];
      expect(isSourceAllowed({ from: '123@newsletter' }, all)).toBe(true);
      expect(isSourceAllowed({ from: '123@g.us' }, all)).toBe(true);
      expect(isSourceAllowed({ from: '923001234567@c.us' }, all)).toBe(true);
    });

    test('individual-only mode rejects groups and channels', () => {
      const individualOnly = ['individual'];
      expect(isSourceAllowed({ from: '123@newsletter' }, individualOnly)).toBe(false);
      expect(isSourceAllowed({ from: '123@g.us' }, individualOnly)).toBe(false);
      expect(isSourceAllowed({ from: '923001234567@c.us' }, individualOnly)).toBe(true);
    });

    test('groups+channels mode rejects individual', () => {
      const groupsAndChannels = ['groups', 'channels'];
      expect(isSourceAllowed({ from: '123@newsletter' }, groupsAndChannels)).toBe(true);
      expect(isSourceAllowed({ from: '123@g.us' }, groupsAndChannels)).toBe(true);
      expect(isSourceAllowed({ from: '923001234567@c.us' }, groupsAndChannels)).toBe(false);
    });
  });
});