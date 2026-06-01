'use strict';

class LRUCache {
  constructor(maxSize = 500, ttlMs = 86400000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  set(key, value) {
    const now = Date.now();

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + this.ttlMs,
    });

    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    const entry = this.cache.get(key);
    const now = Date.now();

    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

const urlCache = new LRUCache(
  parseInt(process.env.CACHE_MAX_SIZE || '500'),
  parseInt(process.env.CACHE_TTL_MS || '86400000')
);

module.exports = { LRUCache, urlCache };
