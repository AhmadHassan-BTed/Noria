'use strict';

/**
 * Infrastructure — LLM Request Queue
 *
 * Rate-limiting serial queue for Gemini API requests.
 * This is legitimately stateful (manages timing), but is NEVER
 * passed between modules — it's internal to the LLM adapter.
 */

class RequestQueue {
  constructor(minDelayMs = 3000) {
    this.minDelayMs = minDelayMs;
    this.lastRequestTime = 0;
    this.queue = Promise.resolve();
  }

  async add(fn) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        const delay = Math.max(0, this.minDelayMs - elapsed);
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        this.lastRequestTime = Date.now();
        try {
          const res = await fn();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

module.exports = { RequestQueue };
