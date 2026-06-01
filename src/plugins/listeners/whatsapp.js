'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { BaseListener } = require('../base');
const { validateUrl } = require('../../utils/validators');
const { withRetry } = require('../../utils/retry');
const { metrics } = require('../../utils/metrics');
const { initConnectionManager } = require('./connection-manager');

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

class WhatsAppListener extends BaseListener {
  constructor(config = {}) {
    super(config);
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    });
    this.callbacks = new Map();
    this.connMgr = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.client.on('qr', (qr) => {
        console.log('[WhatsApp] Scan the QR code below:');
        qrcode.generate(qr, { small: true });
      });

      this.client.on('ready', () => {
        console.log('[WhatsApp] Client ready');
        this.connMgr = initConnectionManager(this.client);
        resolve();
      });

      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Auth failed:', msg);
        reject(new Error(`Auth failure: ${msg}`));
      });

      this.client.on('message', (msg) => {
        const body = msg.body;
        if (!body || typeof body !== 'string') {
          return;
        }

        const matches = body.match(URL_REGEX);
        if (!matches) {
          return;
        }

        const url = matches[0];
        try {
          const validatedUrl = validateUrl(url);
          this._emit('link_extracted', validatedUrl);
        } catch (err) {
          console.warn('[WhatsApp] URL validation failed:', err.message);
        }
      });

      this.client.initialize().catch(reject);
    });
  }

  async send(target, message) {
    try {
      const chatId = `${String(target).replace(/\D/g, '')}@c.us`;
      metrics.recordWhatsAppSend();

      await withRetry(
        async () => {
          await this.client.sendMessage(chatId, message);
        },
        {
          maxRetries: 2,
          baseDelayMs: 1000,
          onRetry: ({ attempt, delay }) => {
            console.warn(`[WhatsApp] Send retry ${attempt}/2 after ${delay}ms`);
            metrics.recordWhatsAppRetry();
          },
        }
      );

      console.log('[WhatsApp] Message delivered');
    } catch (err) {
      metrics.recordWhatsAppFailure();
      throw err;
    }
  }

  on(eventName, callback) {
    this.callbacks.set(eventName, callback);
  }

  _emit(eventName, data) {
    const callback = this.callbacks.get(eventName);
    if (callback) {
      callback(data);
    }
  }

  async close() {
    if (this.client) {
      await this.client.destroy();
      console.log('[WhatsApp] Client closed');
    }
  }
}

module.exports = { WhatsAppListener };
