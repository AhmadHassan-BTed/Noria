'use strict';

class Metrics {
  constructor() {
    this.scraper = { attempts: 0, successes: 0, failures: 0, retries: 0 };
    this.analyzer = { attempts: 0, matches: 0, rejects: 0, failures: 0, retries: 0 };
    this.whatsapp = { sends: 0, failures: 0, retries: 0, disconnects: 0, reconnects: 0 };
    this.gemini = { tokens: 0, requests: 0, errors: 0 };
    this.startTime = Date.now();
  }

  recordScraperAttempt() {
    this.scraper.attempts++;
  }
  recordScraperSuccess() {
    this.scraper.successes++;
  }
  recordScraperFailure() {
    this.scraper.failures++;
  }
  recordScraperRetry() {
    this.scraper.retries++;
  }

  recordAnalyzerAttempt() {
    this.analyzer.attempts++;
  }
  recordAnalyzerMatch() {
    this.analyzer.matches++;
  }
  recordAnalyzerReject() {
    this.analyzer.rejects++;
  }
  recordAnalyzerFailure() {
    this.analyzer.failures++;
  }
  recordAnalyzerRetry() {
    this.analyzer.retries++;
  }

  recordWhatsAppSend() {
    this.whatsapp.sends++;
  }
  recordWhatsAppFailure() {
    this.whatsapp.failures++;
  }
  recordWhatsAppRetry() {
    this.whatsapp.retries++;
  }
  recordWhatsAppDisconnect() {
    this.whatsapp.disconnects++;
  }
  recordWhatsAppReconnect() {
    this.whatsapp.reconnects++;
  }

  recordGeminiTokens(count) {
    this.gemini.tokens += count;
  }
  recordGeminiRequest() {
    this.gemini.requests++;
  }
  recordGeminiError() {
    this.gemini.errors++;
  }

  getUptimeMs() {
    return Date.now() - this.startTime;
  }

  getReport() {
    const uptime = this.getUptimeMs();
    const hours = (uptime / 3600000).toFixed(2);

    return `
╔═══════════════════════════════════════════════╗
║           NORIA — METRICS REPORT              ║
╠═══════════════════════════════════════════════╣
║ Uptime: ${hours.padEnd(8)}hours                       ║
╠═══════════════════════════════════════════════╣
║ SCRAPER                                       ║
║   Attempts:  ${String(this.scraper.attempts).padStart(6)}  Successes: ${String(this.scraper.successes).padStart(6)} ║
║   Failures:  ${String(this.scraper.failures).padStart(6)}  Retries:   ${String(this.scraper.retries).padStart(6)} ║
╠═══════════════════════════════════════════════╣
║ ANALYZER                                      ║
║   Attempts:  ${String(this.analyzer.attempts).padStart(6)}  Matches:   ${String(this.analyzer.matches).padStart(6)} ║
║   Rejects:   ${String(this.analyzer.rejects).padStart(6)}  Failures:  ${String(this.analyzer.failures).padStart(6)} ║
║   Retries:   ${String(this.analyzer.retries).padStart(6)}  Gemini Tokens: ${String(this.gemini.tokens).padStart(5)} ║
╠═══════════════════════════════════════════════╣
║ WHATSAPP                                      ║
║   Sends:     ${String(this.whatsapp.sends).padStart(6)}  Failures:  ${String(this.whatsapp.failures).padStart(6)} ║
║   Retries:   ${String(this.whatsapp.retries).padStart(6)}  Disconnects: ${String(this.whatsapp.disconnects).padStart(4)} ║
║   Reconnects: ${String(this.whatsapp.reconnects).padStart(5)} ║
╚═══════════════════════════════════════════════╝`;
  }
}

const metrics = new Metrics();

module.exports = { metrics, Metrics };
