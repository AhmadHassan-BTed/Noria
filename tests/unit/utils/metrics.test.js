'use strict';

const { Metrics, metrics } = require('../../../src/utils/metrics');

describe('Metrics Utility', () => {
  let testMetrics;

  beforeEach(() => {
    testMetrics = new Metrics();
  });

  test('should initialize with zeroed metrics', () => {
    expect(testMetrics.scraper).toEqual({ attempts: 0, successes: 0, failures: 0, retries: 0 });
    expect(testMetrics.analyzer).toEqual({ attempts: 0, matches: 0, rejects: 0, failures: 0, retries: 0 });
    expect(testMetrics.whatsapp).toEqual({ sends: 0, failures: 0, retries: 0, disconnects: 0, reconnects: 0 });
    expect(testMetrics.gemini).toEqual({ tokens: 0, requests: 0, errors: 0 });
    expect(testMetrics.startTime).toBeLessThanOrEqual(Date.now());
  });

  test('should correctly record scraper events', () => {
    testMetrics.recordScraperAttempt();
    testMetrics.recordScraperSuccess();
    testMetrics.recordScraperFailure();
    testMetrics.recordScraperRetry();

    expect(testMetrics.scraper).toEqual({ attempts: 1, successes: 1, failures: 1, retries: 1 });
  });

  test('should correctly record analyzer events', () => {
    testMetrics.recordAnalyzerAttempt();
    testMetrics.recordAnalyzerMatch();
    testMetrics.recordAnalyzerReject();
    testMetrics.recordAnalyzerFailure();
    testMetrics.recordAnalyzerRetry();

    expect(testMetrics.analyzer).toEqual({ attempts: 1, matches: 1, rejects: 1, failures: 1, retries: 1 });
  });

  test('should correctly record whatsapp events', () => {
    testMetrics.recordWhatsAppSend();
    testMetrics.recordWhatsAppFailure();
    testMetrics.recordWhatsAppRetry();
    testMetrics.recordWhatsAppDisconnect();
    testMetrics.recordWhatsAppReconnect();

    expect(testMetrics.whatsapp).toEqual({ sends: 1, failures: 1, retries: 1, disconnects: 1, reconnects: 1 });
  });

  test('should correctly record gemini events', () => {
    testMetrics.recordGeminiTokens(150);
    testMetrics.recordGeminiRequest();
    testMetrics.recordGeminiError();

    expect(testMetrics.gemini).toEqual({ tokens: 150, requests: 1, errors: 1 });
  });

  test('should compute valid uptime', async () => {
    const uptime = testMetrics.getUptimeMs();
    expect(uptime).toBeGreaterThanOrEqual(0);
  });

  test('should generate a formatted metrics report containing all sections', () => {
    testMetrics.recordScraperAttempt();
    testMetrics.recordAnalyzerMatch();
    testMetrics.recordWhatsAppSend();
    testMetrics.recordGeminiTokens(1000);

    const report = testMetrics.getReport();
    
    expect(report).toContain('NORIA — METRICS REPORT');
    expect(report).toContain('SCRAPER');
    expect(report).toContain('ANALYZER');
    expect(report).toContain('WHATSAPP');
    expect(report).toContain('Attempts:       1');
    expect(report).toContain('Matches:        1');
    expect(report).toContain('Sends:          1');
    expect(report).toContain('LLM Tokens:     1000');
  });

  test('should expose a default shared metrics instance', () => {
    expect(metrics).toBeInstanceOf(Metrics);
  });
});
