'use strict';

const { LRUCache, urlCache } = require('../../../src/utils/cache');

describe('LRUCache Utility', () => {
  let cache;

  beforeEach(() => {
    // Create a small cache for easier testing of limits
    cache = new LRUCache(3, 50); // maxSize = 3, TTL = 50ms
  });

  test('should set and get values correctly', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  test('should return undefined for non-existent keys', () => {
    expect(cache.get('unknown')).toBeUndefined();
  });

  test('should verify existence of keys using has()', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('unknown')).toBe(false);
  });

  test('should update existing keys and move them to most recently used', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Update key1
    cache.set('key1', 'new-value1');
    expect(cache.get('key1')).toBe('new-value1');

    // Set a 4th key. If LRU works, key2 should be evicted (as key1 was updated and key3 was recent)
    cache.set('key4', 'value4');
    expect(cache.has('key2')).toBe(false);
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  test('should evict oldest key when cache exceeds maxSize', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // Add key4 (should evict key1)
    cache.set('key4', 'value4');

    expect(cache.has('key1')).toBe(false);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.size()).toBe(3);
  });

  test('should evict keys that have expired (TTL)', async () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    // Wait for TTL (50ms) to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.has('key1')).toBe(false);
  });

  test('should delete keys correctly', () => {
    cache.set('key1', 'value1');
    expect(cache.has('key1')).toBe(true);

    cache.delete('key1');
    expect(cache.has('key1')).toBe(false);
    expect(cache.size()).toBe(0);
  });

  test('should clear the entire cache', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.has('key1')).toBe(false);
  });

  test('should expose urlCache instance of LRUCache', () => {
    expect(urlCache).toBeInstanceOf(LRUCache);
  });
});
