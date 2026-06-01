'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const EVENTS = require('../../config/constants/events');

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const formatChatId = (phoneNumber) => `${String(phoneNumber).replace(/\D/g, '')}@c.us`;

function initWhatsAppListener(broker) {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

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
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source: 'WhatsAppListener:auth_failure',
      message: `Authentication failure: ${msg}`,
    });
  });

  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp] Client disconnected — reason:', reason);
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
      console.log(`[WhatsApp] URL extracted from message: ${url}`);
      broker.emit(EVENTS.WHATSAPP.LINK_EXTRACTED, url);
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
      const rawNumber = process.env.MY_PHONE_NUMBER;
      if (!rawNumber) {
        throw new Error('Environment variable MY_PHONE_NUMBER is not set.');
      }

      const chatId = formatChatId(rawNumber);
      console.log(`[WhatsApp] Sending notification to ${chatId}...`);
      await client.sendMessage(chatId, formattedMessage);
      console.log('[WhatsApp] Notification delivered successfully.');
    } catch (err) {
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