'use strict';

const {
  CHAT_ID_SUFFIX,
  SOURCE_MODE,
  VALID_ORIGINS,
  normalizeSourceMode,
} = require('../../../../src/plugins/listeners/source-mode');

describe('source-mode module', () => {
  // =========================================================================
  // Constants
  // =========================================================================

  describe('CHAT_ID_SUFFIX', () => {
    test('should export frozen object with PERSONAL, GROUP, CHANNEL', () => {
      expect(CHAT_ID_SUFFIX.PERSONAL).toBe('@c.us');
      expect(CHAT_ID_SUFFIX.GROUP).toBe('@g.us');
      expect(CHAT_ID_SUFFIX.CHANNEL).toBe('@newsletter');
      expect(Object.isFrozen(CHAT_ID_SUFFIX)).toBe(true);
    });
  });

  describe('SOURCE_MODE', () => {
    test('should export frozen presets object', () => {
      expect(SOURCE_MODE.ALL).toBe('all');
      expect(SOURCE_MODE.CHATS).toBe('chats');
      expect(SOURCE_MODE.CHANNELS).toBe('channels');
      expect(SOURCE_MODE.BOTH).toBe('both');
      expect(SOURCE_MODE.INDIVIDUAL).toBe('individual');
      expect(SOURCE_MODE.GROUPS).toBe('groups');
      expect(Object.isFrozen(SOURCE_MODE)).toBe(true);
    });
  });

  describe('VALID_ORIGINS', () => {
    test('should export frozen array with three canonical origins', () => {
      expect(VALID_ORIGINS).toEqual(['individual', 'groups', 'channels']);
      expect(Object.isFrozen(VALID_ORIGINS)).toBe(true);
    });
  });

  // =========================================================================
  // normalizeSourceMode
  // =========================================================================

  describe('normalizeSourceMode', () => {
    // ── Legacy keyword shortcuts ──────────────────────────────────────────

    test('"all" → all three origins', () => {
      expect(normalizeSourceMode('all')).toEqual(['individual', 'groups', 'channels']);
    });

    test('"both" → all three origins', () => {
      expect(normalizeSourceMode('both')).toEqual(['individual', 'groups', 'channels']);
    });

    test('"chats" → [individual, groups]', () => {
      expect(normalizeSourceMode('chats')).toEqual(['individual', 'groups']);
    });

    test('"channels" → [channels]', () => {
      expect(normalizeSourceMode('channels')).toEqual(['channels']);
    });

    // ── Case insensitivity & trimming ─────────────────────────────────────

    test('trims whitespace and normalizes case', () => {
      expect(normalizeSourceMode('  BOTH  ')).toEqual(['individual', 'groups', 'channels']);
      expect(normalizeSourceMode('Chats')).toEqual(['individual', 'groups']);
    });

    // ── Single origin ─────────────────────────────────────────────────────

    test('"individual" → [individual]', () => {
      expect(normalizeSourceMode('individual')).toEqual(['individual']);
    });

    test('"groups" → [groups]', () => {
      expect(normalizeSourceMode('groups')).toEqual(['groups']);
    });

    // ── Comma-separated ──────────────────────────────────────────────────

    test('"individual,groups" → [individual, groups]', () => {
      expect(normalizeSourceMode('individual,groups')).toEqual(['individual', 'groups']);
    });

    test('"groups,channels" → [groups, channels]', () => {
      expect(normalizeSourceMode('groups,channels')).toEqual(['groups', 'channels']);
    });

    test('"individual, groups , channels" → all three (trimmed)', () => {
      expect(normalizeSourceMode('individual, groups , channels')).toEqual([
        'individual', 'groups', 'channels',
      ]);
    });

    test('filters out invalid entries in comma-separated string', () => {
      expect(normalizeSourceMode('individual,bogus,channels')).toEqual([
        'individual', 'channels',
      ]);
    });

    // ── Array form ────────────────────────────────────────────────────────

    test('array ["individual", "channels"] → same', () => {
      expect(normalizeSourceMode(['individual', 'channels'])).toEqual([
        'individual', 'channels',
      ]);
    });

    test('array normalizes case and trims', () => {
      expect(normalizeSourceMode(['  GROUPS ', 'Channels'])).toEqual([
        'groups', 'channels',
      ]);
    });

    test('array filters out invalid entries', () => {
      expect(normalizeSourceMode(['individual', 'bogus', 'groups'])).toEqual([
        'individual', 'groups',
      ]);
    });

    // ── Error cases ──────────────────────────────────────────────────────

    test('throws on invalid string', () => {
      expect(() => normalizeSourceMode('invalid-mode')).toThrow(
        '[sourceMode] Invalid sourceMode: "invalid-mode"'
      );
    });

    test('throws on empty array (all invalid)', () => {
      expect(() => normalizeSourceMode(['bogus', 'nope'])).toThrow(
        '[sourceMode] Invalid sourceMode array'
      );
    });

    test('throws on comma-separated with all invalid entries', () => {
      expect(() => normalizeSourceMode('bogus,nope')).toThrow(
        '[sourceMode] Invalid sourceMode: "bogus,nope"'
      );
    });
  });
});