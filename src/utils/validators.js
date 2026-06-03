'use strict';

const MIN_CONTENT_LENGTH = 200;
const URL_PATTERN = /^https?:\/\/.{5,}.{2,}$/i;

function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error(`Invalid URL: received ${typeof url}, expected non-empty string`);
  }

  const trimmed = url.trim();

  if (!URL_PATTERN.test(trimmed)) {
    throw new Error(`Invalid URL format: ${trimmed.slice(0, 100)}`);
  }

  if (trimmed.length > 2048) {
    throw new Error(`URL exceeds max length (2048 chars): ${trimmed.length} chars`);
  }

  return trimmed;
}

function validateScraperPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Invalid scraper payload: expected object, got ${typeof payload}`);
  }

  const { url, text } = payload;

  if (!url || typeof url !== 'string') {
    throw new Error(`Scraper payload missing valid 'url': ${url}`);
  }

  if (!text || typeof text !== 'string') {
    throw new Error(`Scraper payload missing valid 'text': received ${typeof text}`);
  }

  const textLength = text.trim().length;
  if (textLength < MIN_CONTENT_LENGTH) {
    throw new Error(
      `Scraped content too short (${textLength} chars < ${MIN_CONTENT_LENGTH} minimum). ` +
        'Likely blocked by CAPTCHA or content not found.'
    );
  }

  return { url: url.trim(), text: text.trim() };
}

function validateAnalyzerResponse(response, schema, _url) {
  if (!schema) {
    throw new Error('Schema is required for analyzer response validation');
  }

  if (!response || typeof response !== 'object') {
    throw new Error(`Analyzer response invalid: expected object, got ${typeof response}`);
  }

  const required = (schema && schema.required) || [];

  for (const field of required) {
    if (!(field in response)) {
      throw new Error(`Analyzer response missing required field: '${field}'`);
    }

    const value = response[field];
    if (value === null || value === undefined || value === '') {
      throw new Error(`Analyzer response field '${field}' is empty or null`);
    }

    const propSchema = schema.properties && schema.properties[field];
    if (propSchema) {
      const expectedType = String(propSchema.type).toLowerCase();

      if (expectedType.includes('string')) {
        if (typeof value !== 'string') {
          throw new Error(`Analyzer '${field}' must be a string, got: ${typeof value}`);
        }
      } else if (expectedType.includes('int') || expectedType.includes('num')) {
        if (typeof value !== 'number') {
          throw new Error(`Analyzer '${field}' must be a number, got: ${typeof value}`);
        }
        if (field === 'match_score') {
          if (value < 0 || value > 100) {
            throw new Error(`Analyzer 'match_score' out of range (0-100): ${value}`);
          }
        }
      } else if (expectedType.includes('bool')) {
        if (typeof value !== 'boolean') {
          throw new Error(`Analyzer '${field}' must be boolean, got: ${typeof value}`);
        }
      }
    }
  }

  return response;
}

function validateContent(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  return text.trim().length >= MIN_CONTENT_LENGTH;
}

module.exports = {
  validateUrl,
  validateScraperPayload,
  validateAnalyzerResponse,
  validateContent,
  MIN_CONTENT_LENGTH,
};
