'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const EVENTS = require('../../config/constants/events');
const { validateUrl } = require('../../utils/validators');
const { withRetry } = require('../../utils/retry');
const { metrics } = require('../../utils/metrics');
const { initConnectionManager } = require('./connection-manager');

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const formatChatId = (phoneNumber) => `${String(phoneNumber).replace(/\D/g, '')}@c.us`;

function initWhatsAppListener(broker) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  const connMgr = initConnectionManager(broker, client);

  client.on('qr', (qr) => {
    console.log('[WhatsApp] Scan the QR code below to authenticate:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('[WhatsApp] Client is ready — listening for incoming messages.');
    broker.emit(EVENTS.WHATSAPP.READY);
  });

  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp] Authentication failed:', msg);
    metrics.recordWhatsAppDisconnect();
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source: 'WhatsAppListener:auth_failure',
      message: `Authentication failure: ${msg}`,
    });
  });

  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Client disconnected — reason:', reason);
    metrics.recordWhatsAppDisconnect();
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source: 'WhatsAppListener:disconnected',
      message: `Client disconnected: ${reason}`,
    });
  });

  client.on('message', (msg) => {
    try {
      const body = msg.body;
      if (!body || typeof body !== 'string') return;

      const matches = body.match(URL_REGEX);
      if (!matches || matches.length === 0) return;

      const url = matches[0];

      try {
        const validatedUrl = validateUrl(url);
        console.log(`[WhatsApp] URL extracted and validated: ${validatedUrl}`);
        broker.emit(EVENTS.WHATSAPP.LINK_EXTRACTED, validatedUrl);
      } catch (validErr) {
        console.warn(`[WhatsApp] URL validation failed: ${validErr.message}`);
        broker.emit(EVENTS.SYSTEM.ERROR, {
          source: 'WhatsAppListener:urlValidation',
          message: `Invalid URL extracted: ${validErr.message}`,
        });
      }
    } catch (err) {
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'WhatsAppListener:onMessage',
        message: err.message,
        stack: err.stack,
      });
    }
  });

  broker.on(EVENTS.NOTIFIER.SEND, async (formattedMessage) => {
    try {
      const target = process.env.NOTIFICATION_TARGET;
      if (!target) {
        throw new Error('Environment variable NOTIFICATION_TARGET is not set.');
      }

      const chatId = formatChatId(target);
      console.log(`[WhatsApp] Sending notification to ${chatId}...`);
      metrics.recordWhatsAppSend();

      await withRetry(
        async () => {
          await client.sendMessage(chatId, formattedMessage);
        },
        {
          maxRetries: 2,
          baseDelayMs: 1000,
          onRetry: ({ attempt, delay, error }) => {
            console.warn(`[WhatsApp] Send retry ${attempt}/2 after ${delay}ms: ${error}`);
            metrics.recordWhatsAppRetry();
          },
        },
      );

      console.log('[WhatsApp] Notification delivered successfully.');
    } catch (err) {
      metrics.recordWhatsAppFailure();
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'WhatsAppListener:onNotifierSend',
        message: err.message,
        stack: err.stack,
      });
    }
  });

  console.log('[WhatsApp] Initializing client (this may take a few seconds)...');
  client.initialize();
}

module.exports = { initWhatsAppListener };