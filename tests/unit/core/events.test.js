'use strict';

const { Event, EventTypes } = require('../../../src/core/events');

describe('Events Core', () => {
  describe('EventTypes', () => {
    test('should contain valid, nested event string constants', () => {
      expect(EventTypes.LISTENER.INITIALIZED).toBe('listener:initialized');
      expect(EventTypes.SCRAPER.START).toBe('scraper:start');
      expect(EventTypes.ANALYZER.MATCH_FOUND).toBe('analyzer:match_found');
      expect(EventTypes.NOTIFIER.SEND).toBe('notifier:send');
      expect(EventTypes.SYSTEM.BOOTED).toBe('system:booted');
    });
  });

  describe('Event Class', () => {
    test('should construct a valid Event instance with default metadata', () => {
      const type = EventTypes.SCRAPER.START;
      const provider = 'scholarships';
      const payload = { url: 'https://example.com' };

      const event = new Event(type, provider, payload);

      expect(event.type).toBe(type);
      expect(event.provider).toBe(provider);
      expect(event.payload).toEqual(payload);
      expect(event.metadata).toBeDefined();
      expect(event.metadata.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('should merge custom metadata during construction', () => {
      const type = EventTypes.ANALYZER.MATCH_FOUND;
      const provider = 'jobs';
      const payload = { score: 95 };
      const customMeta = { traceId: '123-abc', source: 'test' };

      const event = new Event(type, provider, payload, customMeta);

      expect(event.metadata.traceId).toBe('123-abc');
      expect(event.metadata.source).toBe('test');
      expect(event.metadata.timestamp).toBeLessThanOrEqual(Date.now());
    });

    test('should serialize correctly to JSON using toJSON()', () => {
      const type = EventTypes.SYSTEM.BOOTED;
      const provider = 'system';
      const payload = { active: true };
      
      const event = new Event(type, provider, payload);
      const json = event.toJSON();

      expect(json).toEqual({
        type: type,
        provider: provider,
        payload: payload,
        metadata: {
          timestamp: event.metadata.timestamp,
        },
      });
    });
  });
});
