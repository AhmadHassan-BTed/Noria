'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const EVENTS = require('../../config/constants/events');

// ---------------------------------------------------------------------------
// URL extraction regex — matches http/https URLs including query strings and
// fragments. The 'g' flag allows extracting all URLs from a single message.
// ---------------------------------------------------------------------------
const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

// ---------------------------------------------------------------------------
// Sanitize a phone number string for whatsapp-web.js.
// Strips ALL non-digit characters (including the leading '+') and appends the
// required individual-chat suffix '@c.us'.
//
// Example:  '+923001234567'  →  '923001234567@c.us'
// ---------------------------------------------------------------------------
const formatChatId = (phoneNumber) => `${String(phoneNumber).replace(/\D/g, '')}@c.us`;

/**
 * Initializes the WhatsApp listener service and binds it to the central broker.
 *
 * OUTBOUND  (WhatsApp → Broker)
 *   • client 'qr'      → renders QR code in terminal for authentication
 *   • client 'ready'   → emits EVENTS.WHATSAPP.READY
 *   • client 'message' → extracts first URL, emits EVENTS.WHATSAPP.LINK_EXTRACTED
 *
 * INBOUND  (Broker → WhatsApp)
 *   • EVENTS.NOTIFIER.SEND → sends the formatted notification to MY_PHONE_NUMBER
 *
 * ARCHITECTURE NOTE:
 *   This service does NOT listen for EVENTS.SCRAPER.START or reference the
 *   scraper in any way. The bridge between LINK_EXTRACTED and SCRAPER.START
 *   belongs in the root orchestrator (index.js):
 *
 *     broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, (url) =>
 *       broker.emit(EVENTS.SCRAPER.START, url));
 *
 * @param {import('events').EventEmitter} broker - The central event bus.
 */
function initWhatsAppListener(broker) {
  // -------------------------------------------------------------------------
  // Client setup — LocalAuth persists the session to disk so the QR code only
  // needs to be scanned once. Subsequent restarts reuse the stored credentials.
  // -------------------------------------------------------------------------
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: '.wwebjs_auth', // session files are written here
    }),
    puppeteer: {
      // '--no-sandbox' is mandatory on most Linux / Docker host environments
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  // -------------------------------------------------------------------------
  // OUTBOUND — client event → broker event
  // -------------------------------------------------------------------------

  // Render an ASCII QR code in the terminal so the operator can scan it
  client.on('qr', (qr) => {
    console.log('[WhatsApp]  Scan the QR code below to authenticate:');
    qrcode.generate(qr, { small: true });
  });

  // Session is fully authenticated and the socket is open
  client.on('ready', () => {
    console.log('[WhatsApp]  Client is ready — listening for incoming messages.');
    broker.emit(EVENTS.WHATSAPP.READY);
  });

  // Session token was invalidated (e.g., logged out from phone)
  client.on('auth_failure', (msg) => {
    console.error('[WhatsApp]  Authentication failed:', msg);
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source: 'WhatsAppListener:auth_failure',
      message: `Authentication failure: ${msg}`,
    });
  });

  // Socket closed or session expired
  client.on('disconnected', (reason) => {
    console.warn('[WhatsApp]   Client disconnected — reason:', reason);
    broker.emit(EVENTS.SYSTEM.ERROR, {
      source: 'WhatsAppListener:disconnected',
      message: `Client disconnected: ${reason}`,
    });
  });

  // Core ingestion logic: every incoming message is inspected for a URL
  client.on('message', (msg) => {
    try {
      const body = msg.body;
      if (!body || typeof body !== 'string') return;

      const matches = body.match(URL_REGEX);
      if (!matches || matches.length === 0) return; // plain text — ignore silently

      // Emit only the FIRST URL to keep each pipeline run atomic.
      // Multi-URL handling (e.g. queuing) belongs in the orchestrator.
      const url = matches[0];
      console.log(`[WhatsApp]  URL extracted from message: ${url}`);
      broker.emit(EVENTS.WHATSAPP.LINK_EXTRACTED, url);
    } catch (err) {
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'WhatsAppListener:onMessage',
        message: err.message,
        stack: err.stack,
      });
    }
  });

  // -------------------------------------------------------------------------
  // INBOUND — broker event → WhatsApp client action
  // -------------------------------------------------------------------------

  // Receive the fully-formatted string from the Dispatcher and deliver it
  broker.on(EVENTS.NOTIFIER.SEND, async (formattedMessage) => {
    try {
      const rawNumber = process.env.MY_PHONE_NUMBER;
      if (!rawNumber) {
        throw new Error('Environment variable MY_PHONE_NUMBER is not set.');
      }

      const chatId = formatChatId(rawNumber);
      console.log(`[WhatsApp]  Sending notification to ${chatId}...`);
      await client.sendMessage(chatId, formattedMessage);
      console.log('[WhatsApp]  Notification delivered successfully.');
    } catch (err) {
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'WhatsAppListener:onNotifierSend',
        message: err.message,
        stack: err.stack,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Start the client — triggers the QR flow or restores the saved session
  // -------------------------------------------------------------------------
  console.log('[WhatsApp]  Initializing client (this may take a few seconds)...');
  client.initialize();
}

module.exports = { initWhatsAppListener };