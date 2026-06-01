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
      `Likely blocked by CAPTCHA or content not found.`,
    );
  }

  return { url: url.trim(), text: text.trim() };
}

function validateAnalyzerResponse(response, url) {
  if (!response || typeof response !== 'object') {
    throw new Error(`Analyzer response invalid: expected object, got ${typeof response}`);
  }

  const required = [
    'match_score', 'uni_country', 'scholarship_name', 'program_name',
    'deadline', 'fully_funded', 'english_taught', 'post_study_visa',
    'verdict', 'apply_link', 'official_link',
  ];

  for (const field of required) {
    if (!(field in response)) {
      throw new Error(`Analyzer response missing required field: '${field}'`);
    }

    const value = response[field];
    if (value === null || value === undefined || value === '') {
      throw new Error(`Analyzer response field '${field}' is empty or null`);
    }
  }

  if (typeof response.match_score !== 'number') {
    throw new Error(
      `Analyzer 'match_score' must be a number, got: ${typeof response.match_score}`,
    );
  }

  if (response.match_score < 0 || response.match_score > 100) {
    throw new Error(
      `Analyzer 'match_score' out of range (0-100): ${response.match_score}`,
    );
  }

  if (typeof response.fully_funded !== 'boolean') {
    throw new Error(
      `Analyzer 'fully_funded' must be boolean, got: ${typeof response.fully_funded}`,
    );
  }

  if (typeof response.english_taught !== 'boolean') {
    throw new Error(
      `Analyzer 'english_taught' must be boolean, got: ${typeof response.english_taught}`,
    );
  }

  if (typeof response.post_study_visa !== 'boolean') {
    throw new Error(
      `Analyzer 'post_study_visa' must be boolean, got: ${typeof response.post_study_visa}`,
    );
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
