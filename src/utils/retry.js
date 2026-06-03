'use strict';

function isRetryableError(err) {
  if (!err) {
    return false;
  }

  const message = (err.message || '').toLowerCase();
  const statusCode = err.status || err.statusCode;

  // Network/timeout errors
  if (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('too many requests')
  ) {
    return true;
  }

  // Rate limit and server errors
  if (statusCode === 429 || statusCode === 503 || statusCode === 500 || statusCode === 502) {
    return true;
  }

  return false;
}

function extractRetryDelayMs(err) {
  if (!err || !err.message) {
    return null;
  }
  
  // 1. Try to find retryDelay in JSON format: "retryDelay":"48s" or "retryDelay": "48s"
  const jsonMatch = err.message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)(s|ms)"/);
  if (jsonMatch) {
    const value = parseFloat(jsonMatch[1]);
    const unit = jsonMatch[2];
    return unit === 's' ? value * 1000 : value;
  }
  
  // 2. Try to find plain text format: "Please retry in 48.184025976s"
  const textMatch = err.message.match(/Please retry in (\d+(?:\.\d+)?)\s*(s|ms)/i);
  if (textMatch) {
    const value = parseFloat(textMatch[1]);
    const unit = textMatch[2].toLowerCase();
    return unit === 's' ? value * 1000 : value;
  }

  return null;
}

async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 60000, // Increase max delay limit to 60s
    jitterFactor = 0.1,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries || !isRetryableError(err)) {
        throw err;
      }

      // Check if it's a rate limit error to apply aggressive backoff
      const lowerMsg = (err.message || '').toLowerCase();
      const isRateLimit = err.status === 429 || err.statusCode === 429 || 
                          lowerMsg.includes('429') || lowerMsg.includes('quota') || 
                          lowerMsg.includes('too many requests');

      const currentBaseDelay = isRateLimit ? Math.max(baseDelayMs, 15000) : baseDelayMs;

      const exponentialDelay = currentBaseDelay * Math.pow(2, attempt - 1);
      const jitter = exponentialDelay * jitterFactor * Math.random();
      let delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      // Check if the error specifies a retry delay from Google API
      const parsedDelayMs = extractRetryDelayMs(err);
      if (parsedDelayMs) {
        delay = parsedDelayMs + 1500; // Add 1.5s safety buffer
      }

      if (onRetry) {
        onRetry({
          attempt,
          maxRetries,
          delay: Math.round(delay),
          error: err.message,
        });
      }

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

module.exports = { withRetry, isRetryableError, extractRetryDelayMs };
