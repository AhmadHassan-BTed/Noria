'use strict';

const fs = require('fs');
const path = require('path');

class DeadLetterQueue {
  constructor(maxRetries = 3, scanIntervalMs = 300000) {
    this.maxRetries = maxRetries;
    this.scanIntervalMs = scanIntervalMs;
    this.queue = new Map();
    this.deadLetterPath = path.join(__dirname, '../../logs/dead-letters.jsonl');
    this.scanInterval = null;
  }

  add(item) {
    const id = `${item.url}:${Date.now()}`;
    this.queue.set(id, {
      url: item.url,
      reason: item.reason,
      retries: 0,
      firstAttemptAt: Date.now(),
      nextRetryAt: Date.now() + 1000,
      lastError: item.lastError,
    });
    return id;
  }

  recordRetry(id, attempt) {
    if (!this.queue.has(id)) return;

    const entry = this.queue.get(id);
    entry.retries = attempt;
    const baseDelay = 5000 * Math.pow(2, Math.min(attempt - 1, 3));
    entry.nextRetryAt = Date.now() + baseDelay;
  }

  getRetryable() {
    const now = Date.now();
    const retryable = [];

    for (const [id, entry] of this.queue.entries()) {
      if (entry.retries < this.maxRetries && now >= entry.nextRetryAt) {
        retryable.push({ id, url: entry.url });
      }
    }

    return retryable;
  }

  remove(id) {
    this.queue.delete(id);
  }

  discard(id, reason = 'Max retries exceeded') {
    if (!this.queue.has(id)) return;

    const entry = this.queue.get(id);
    this._logDeadLetter({ ...entry, reason, discardedAt: new Date().toISOString() });
    this.queue.delete(id);
  }

  _logDeadLetter(entry) {
    try {
      const logsDir = path.dirname(this.deadLetterPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.deadLetterPath, line, 'utf8');
    } catch (err) {
      console.error('[Queue] Failed to log dead letter:', err.message);
    }
  }

  start(onRetry) {
    if (this.scanInterval) return;

    this.scanInterval = setInterval(() => {
      const retryable = this.getRetryable();

      for (const { id, url } of retryable) {
        const entry = this.queue.get(id);
        entry.retries++;

        if (onRetry) {
          onRetry(url, entry.retries);
        }

        this.recordRetry(id, entry.retries);

        if (entry.retries >= this.maxRetries) {
          this.discard(id);
        }
      }
    }, this.scanIntervalMs);

    console.log(`[Queue] Dead-letter queue scanner started (interval: ${this.scanIntervalMs}ms)`);
  }

  stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log('[Queue] Dead-letter queue scanner stopped.');
    }
  }

  size() {
    return this.queue.size;
  }

  clear() {
    this.queue.clear();
  }
}

const dlq = new DeadLetterQueue(
  parseInt(process.env.MAX_RETRIES || '3'),
  parseInt(process.env.QUEUE_SCAN_INTERVAL_MS || '300000'),
);

module.exports = { DeadLetterQueue, dlq };
