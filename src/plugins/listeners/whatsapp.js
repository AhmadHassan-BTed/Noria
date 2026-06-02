'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs   = require('fs');
const path = require('path');

const { BaseListener }      = require('../base');
const { validateUrl }       = require('../../utils/validators');
const { metrics }           = require('../../utils/metrics');
const { withRetry }         = require('../../utils/retry');
const { initConnectionManager } = require('./connection-manager');
const { ChannelFetcher }    = require('./channel-fetcher');  // ← NEW

// =============================================================================
// File Logger (unchanged from original)
// =============================================================================

class SessionLogger {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logDir    = 'data';
    this.logFile   = path.join(this.logDir, `logs-${sessionId}.log`);
    this.maxFileSize = 5 * 1024 * 1024; // 5 MB

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _rotateIfNeeded() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxFileSize) {
          const backup = `${this.logFile}.old`;
          if (fs.existsSync(backup)) fs.unlinkSync(backup);
          fs.renameSync(this.logFile, backup);
        }
      }
    } catch { /* non-fatal */ }
  }

  log(level, category, message, metadata = null) {
    try {
      this._rotateIfNeeded();
      const ts    = new Date().toISOString();
      let   entry = `[${ts}] [${level}] [${category}] ${message}`;
      if (metadata) entry += ` | ${JSON.stringify(metadata)}`;
      fs.appendFileSync(this.logFile, entry + '\n');
    } catch (err) {
      console.error(`[SessionLogger] Write failed: ${err.message}`);
    }
  }

  info(cat, msg, meta)  { this.log('INFO',  cat, msg, meta); }
  warn(cat, msg, meta)  { this.log('WARN',  cat, msg, meta); }
  error(cat, msg, meta) { this.log('ERROR', cat, msg, meta); }
  debug(cat, msg, meta) { this.log('DEBUG', cat, msg, meta); }

  clear() {
    try {
      if (fs.existsSync(this.logFile)) fs.unlinkSync(this.logFile);
    } catch { /* non-fatal */ }
  }
}

// =============================================================================
// Constants
// =============================================================================

const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const CHAT_ID_SUFFIX = Object.freeze({
  PERSONAL: '@c.us',
  GROUP:    '@g.us',
  CHANNEL:  '@newsletter',
});

/**
 * Source mode flag — controls which message origins trigger URL extraction.
 * Exported so callers can use SOURCE_MODE.CHANNELS instead of raw strings.
 */
const SOURCE_MODE = Object.freeze({
  CHATS:    'chats',
  CHANNELS: 'channels',
  BOTH:     'both',
});

const CHANNEL_CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour (re-fetch from fetcher)
const MAX_DEDUP_CACHE_SIZE = 2_000;

// =============================================================================
// WhatsAppListener
// =============================================================================

class WhatsAppListener extends BaseListener {
  /**
   * @param {object} config
   * @param {'chats'|'channels'|'both'} [config.sourceMode='chats']
   * @param {string[]} [config.allowedChannels=[]]
   *   Whitelist: full @newsletter IDs or display names (case-insensitive).
   *   Empty = accept all subscribed channels.
   * @param {string} [config.sessionId='default']
   */
  constructor(config = {}) {
    super(config);

    // ── Source mode ───────────────────────────────────────────────────────
    const mode = config.sourceMode ?? SOURCE_MODE.CHATS;
    if (!Object.values(SOURCE_MODE).includes(mode)) {
      throw new Error(
        `[WhatsAppListener] Invalid sourceMode: "${mode}". ` +
        `Valid: ${Object.values(SOURCE_MODE).join(' | ')}.`
      );
    }
    this.sourceMode = mode;

    // ── Channel whitelist ─────────────────────────────────────────────────
    this.allowedChannels = (config.allowedChannels ?? [])
      .map((c) => String(c).trim())
      .filter(Boolean);

    // ── Session state ─────────────────────────────────────────────────────
    this.sessionId = config.sessionId ?? 'default';
    this.logger    = new SessionLogger(this.sessionId);

    /**
     * Channel name cache — local fast-path lookup keyed by channelId.
     * Populated from ChannelFetcher events; entries have a TTL.
     * Structure: Map<channelId, { name: string, cachedAt: number }>
     */
    this._channelCache   = new Map();
    this._processedIds   = new Set(); // Dedup ring buffer
    this._channelFetcher = null;      // Initialised inside initialize()

    // ── whatsapp-web.js client ────────────────────────────────────────────
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `.wwebjs_auth/session-${this.sessionId}`,
      }),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    });

    this.callbacks = new Map();
    this.connMgr   = null;

    this.logger.info('SYSTEM', 'Listener constructed', {
      sessionId:       this.sessionId,
      sourceMode:      this.sourceMode,
      allowedChannels: this.allowedChannels,
    });
  }

  // ==========================================================================
  // Private — ChannelFetcher integration
  // ==========================================================================

  /**
   * Creates and fully initialises the ChannelFetcher.
   * Called once inside the 'ready' handler, after the WA client is connected.
   *
   * Subscribes to ChannelFetcher events so the local channel cache stays in
   * sync automatically as WhatsApp delivers lazy-loaded channel data.
   */
  async _initChannelFetcher() {
    this._channelFetcher = new ChannelFetcher(this.client, {
      maxAttempts:    5,
      retryDelayMs:   4_000,
      pollIntervalMs: 60_000,
      log: (msg) => {
        console.log(msg);
        this.logger.info('CHANNEL_FETCHER', msg);
      },
    });

    // Sync ChannelFetcher discoveries into our local cache
    this._channelFetcher.on('channel:discovered', (info) => {
      this._channelCache.set(info.id, { name: info.name, cachedAt: Date.now() });
      this.logger.info('CHANNEL', `Channel discovered: "${info.name}"`, { id: info.id });
    });

    this._channelFetcher.on('channel:updated', (info) => {
      this._channelCache.set(info.id, { name: info.name, cachedAt: Date.now() });
      this.logger.info('CHANNEL', `Channel updated: "${info.name}"`, { id: info.id });
    });

    // Full setup: bridge + initial fetch
    const found = await this._channelFetcher.setup();

    // Log the whitelist status
    if (this.sourceMode !== SOURCE_MODE.CHATS) {
      if (found.length === 0) {
        console.log('[WhatsApp] ⚠️  No subscribed channels found yet (bridge is active for late arrivals).');
      } else {
        console.log(`[WhatsApp] 📡  Subscribed channels (${found.length}):`);
        found.forEach((ch) => console.log(`[WhatsApp]     • "${ch.name}" — ${ch.id}`));
      }

      if (this.allowedChannels.length > 0) {
        console.log(`[WhatsApp] 🔒  Whitelist: ${this.allowedChannels.join(', ')}`);
      } else {
        console.log('[WhatsApp] 🔓  No whitelist — accepting all subscribed channels.');
      }
    }

    // Write known channels to the status file
    return found;
  }

  // ==========================================================================
  // Private — source classification
  // ==========================================================================

  /** @param {import('whatsapp-web.js').Message} msg */
  _isChannelMessage(msg) {
    return typeof msg.from === 'string' &&
           msg.from.endsWith(CHAT_ID_SUFFIX.CHANNEL);
  }

  /** @returns {Promise<boolean>} */
  async _shouldProcess(msg) {
    const msgId     = msg.id?._serialized;
    const isChannel = this._isChannelMessage(msg);

    // Dedup (O(1))
    if (msgId && this._processedIds.has(msgId)) return false;

    // Source gate
    if (isChannel  && this.sourceMode === SOURCE_MODE.CHATS)    return false;
    if (!isChannel && this.sourceMode === SOURCE_MODE.CHANNELS) return false;

    // Whitelist
    if (isChannel && this.allowedChannels.length > 0) {
      return this._isAllowedChannel(msg);
    }

    return true;
  }

  /** Fails CLOSED: skips message if channel metadata cannot be resolved. */
  async _isAllowedChannel(msg) {
    const channelId = msg.from;

    // Fast path: exact ID match
    if (this.allowedChannels.includes(channelId)) return true;

    // Medium path: check ChannelFetcher's registry by name
    if (this._channelFetcher) {
      for (const allowed of this.allowedChannels) {
        const found = this._channelFetcher.getByName(allowed) ||
                      this._channelFetcher.getById(allowed);
        if (found && found.id === channelId) return true;
      }
    }

    // Slow path: resolve via cache → msg.getChat()
    try {
      const name = await this._resolveChannelName(channelId, msg);
      return this.allowedChannels.some(
        (a) => a.toLowerCase() === name.toLowerCase()
      );
    } catch (err) {
      console.warn(
        `[WhatsApp] ⚠️  Cannot resolve channel name for ${channelId} — skipped. ` +
        `Reason: ${err.message}`
      );
      return false;
    }
  }

  // ==========================================================================
  // Private — channel name resolution
  // ==========================================================================

  /**
   * Returns the channel display name, in priority order:
   *   1. ChannelFetcher registry (most authoritative)
   *   2. Local TTL cache
   *   3. msg.getChat() live fetch (slowest, updates both caches)
   */
  async _resolveChannelName(channelId, msg) {
    // 1. ChannelFetcher knows this channel
    if (this._channelFetcher) {
      const info = this._channelFetcher.getById(channelId);
      if (info?.name) {
        // Keep local cache in sync
        this._channelCache.set(channelId, { name: info.name, cachedAt: Date.now() });
        return info.name;
      }
    }

    // 2. Local TTL cache
    const cached = this._channelCache.get(channelId);
    if (cached && (Date.now() - cached.cachedAt) < CHANNEL_CACHE_TTL_MS) {
      return cached.name;
    }

    // 3. Live fetch
    const chat = await msg.getChat();
    const name = chat.name?.trim() ?? '';
    this._channelCache.set(channelId, { name, cachedAt: Date.now() });
    return name;
  }

  // ==========================================================================
  // Private — deduplication ring buffer
  // ==========================================================================

  _markProcessed(msgId) {
    if (!msgId) return;
    this._processedIds.add(msgId);
    if (this._processedIds.size > MAX_DEDUP_CACHE_SIZE) {
      const [oldest] = this._processedIds;
      this._processedIds.delete(oldest);
    }
  }

  // ==========================================================================
  // Private — unified message handler
  // ==========================================================================

  /**
   * Single entry point for all incoming messages (chats and channels).
   *
   * Emits 'link_extracted' with payload:
   * {
   *   url:         string,
   *   source:      'chat' | 'channel',
   *   channelId:   string | null,
   *   channelName: string | null,
   *   messageId:   string | null,
   *   timestamp:   Date,
   * }
   *
   * MIGRATION NOTE for broker bridge in index.js:
   *   // OLD: broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, (url) => ...)
   *   // NEW: broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, ({ url }) => ...)
   */
  async _handleMessage(msg) {
    try {
      const msgId     = msg.id?._serialized;
      const isChannel = this._isChannelMessage(msg);
      const msgSource = isChannel ? 'channel' : 'chat';

      this.logger.debug('MESSAGE', `Incoming ${msgSource} message`, {
        messageId: msgId,
        from:      msg.from,
        hasBody:   !!msg.body,
      });

      // ── Gate ────────────────────────────────────────────────────────────
      const shouldProcess = await this._shouldProcess(msg);
      if (!shouldProcess) {
        this.logger.debug('MESSAGE', 'Filtered (mode/whitelist/dedup)', { messageId: msgId });
        return;
      }

      // Mark processed BEFORE any await to close the dedup race window
      this._markProcessed(msgId);

      // ── URL extraction ───────────────────────────────────────────────────
      const body = msg.body;
      if (!body || typeof body !== 'string') return;

      const matches = body.match(URL_REGEX);
      if (!matches) return;

      const rawUrl = matches[0]; // One URL per message — atomic pipeline

      // ── Validation ──────────────────────────────────────────────────────
      let validatedUrl;
      try {
        validatedUrl = validateUrl(rawUrl);
      } catch (err) {
        console.warn(`[WhatsApp] URL validation failed for "${rawUrl}": ${err.message}`);
        this.logger.warn('URL', 'Validation failed', { rawUrl, error: err.message });
        return;
      }

      // ── Channel name for payload ─────────────────────────────────────────
      let channelName = null;
      if (isChannel) {
        try {
          channelName = await this._resolveChannelName(msg.from, msg);
        } catch {
          channelName = null; // Non-fatal
        }
      }

      // ── Emit ─────────────────────────────────────────────────────────────
      const source = isChannel ? 'channel' : 'chat';
      const label  = channelName ? ` "${channelName}"` : '';
      console.log(`[WhatsApp] 🔗  URL from ${source}${label}: ${validatedUrl}`);

      this.logger.info('URL_EXTRACTED', `URL from ${source}${label}`, {
        messageId:   msgId,
        url:         validatedUrl,
        channelId:   isChannel ? msg.from : null,
        channelName,
      });

      this._emit('link_extracted', {
        url:         validatedUrl,
        source,
        channelId:   isChannel ? msg.from    : null,
        channelName: isChannel ? channelName : null,
        messageId:   msgId   ?? null,
        timestamp:   new Date(),
      });

    } catch (err) {
      console.error(`[WhatsApp] ❌  Message handler error: ${err.message}`, err.stack);
      this.logger.error('MESSAGE', 'Unhandled error in message handler', {
        error: err.message,
      });
      this._emit('error', { source: 'messageHandler', error: err });
    }
  }

  // ==========================================================================
  // Public — lifecycle
  // ==========================================================================

  async initialize() {
    return new Promise((resolve, reject) => {

      // ── QR ──────────────────────────────────────────────────────────────
      this.client.on('qr', (qr) => {
        console.log('[WhatsApp] 📲  Scan the QR code below:');
        qrcode.generate(qr, { small: true });
        this.logger.info('CONNECTION', 'QR code generated');
        this._writeData(`qr-${this.sessionId}.txt`,     qr);
        this._writeData(`status-${this.sessionId}.json`, { status: 'SCAN_QR' });
      });

      // ── Ready ────────────────────────────────────────────────────────────
      this.client.on('ready', async () => {
        console.log('[WhatsApp] ✅  Client ready.');
        console.log(`[WhatsApp] ⚙️   Source mode: ${this.sourceMode.toUpperCase()}`);
        this.logger.info('CONNECTION', 'Client ready', { sourceMode: this.sourceMode });

        // Remove the QR file — no longer needed
        this._deleteData(`qr-${this.sessionId}.txt`);

        this.connMgr = initConnectionManager(this.client, this.sessionId);
        
        // Get phone number with multiple fallback methods
        let phone = '';
        try {
          // Method 1: wid.user (most common)
          phone = this.client.info?.wid?.user || '';
          
          // Method 2: Try to get from pushname or other info
          if (!phone && this.client.info) {
            phone = this.client.info.pushname || '';
          }
          
          // Method 3: Try to get from the WID object directly
          if (!phone && this.client.info?.wid) {
            // WID might have _serialized or other properties
            phone = this.client.info.wid._serialized?.split('@')[0] || '';
          }
          
          // Method 4: Try to get from me contact
          if (!phone) {
            const me = await this.client.getContactById(this.client.info?.wid?._serialized || '');
            if (me && me.id && me.id.user) {
              phone = me.id.user;
            }
          }
          
          this.logger.info('CONNECTION', `Phone number retrieved: ${phone}`, { 
            method: phone ? 'success' : 'failed',
            infoAvailable: !!this.client.info 
          });
        } catch (err) {
          console.warn('[WhatsApp] ⚠️  Could not retrieve phone number:', err.message);
          this.logger.warn('CONNECTION', 'Phone retrieval failed', { error: err.message });
        }

        // ── Channel discovery (the fix) ───────────────────────────────────
        let channelNames = [];
        try {
          const channels = await this._initChannelFetcher();
          channelNames = channels.map((c) => c.name || c.id);
        } catch (err) {
          console.warn('[WhatsApp] ⚠️  Channel fetcher init error (non-fatal):', err.message);
          this.logger.warn('CHANNEL_FETCHER', 'Init error', { error: err.message });
        }

        // Get WID as fallback identifier
        const wid = this.client.info?.wid?._serialized || '';
        
        // Write single CONNECTED status file
        this._writeData(`status-${this.sessionId}.json`, {
          status:   'CONNECTED',
          phone,
          wid,
          channels: channelNames,
        });
        
        console.log(`[WhatsApp] 📱 Connected with phone: ${phone || '(empty)'}, wid: ${wid || '(empty)'}, channels: ${channelNames.length}`);

        resolve();
      });

      // ── Auth failure ─────────────────────────────────────────────────────
      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] ❌  Auth failed:', msg);
        this.logger.error('CONNECTION', 'Auth failure', { reason: msg });
        reject(new Error(`Auth failure: ${msg}`));
      });

      // ── Disconnected ─────────────────────────────────────────────────────
      this.client.on('disconnected', (reason) => {
        console.warn('[WhatsApp] ⚠️   Disconnected:', reason);
        this.logger.warn('CONNECTION', 'Disconnected', { reason });
        this._writeData(`status-${this.sessionId}.json`, {
          status: 'DISCONNECTED',
          reason,
        });
        this._emit('disconnected', { reason });
      });

      // ── Messages ─────────────────────────────────────────────────────────
      // Primary event — fires for chats and most channel builds
      this.client.on('message', (msg) => {
        this._handleMessage(msg);
      });

      // Belt-and-suspenders for channel posts — some WA server builds route
      // channel posts through message_create instead of (or in addition to) message.
      // Deduplication by message ID prevents double-processing.
      this.client.on('message_create', (msg) => {
        if (!msg.fromMe) this._handleMessage(msg);
      });

      // ── Start initialization with comprehensive error handling ─────────
      this.logger.info('CONNECTION', 'Starting WhatsApp client initialization...');
      
      this.client.initialize()
        .then(() => {
          this.logger.info('CONNECTION', 'Client initialization promise resolved');
        })
        .catch((err) => {
          const errorMsg = err?.message || String(err);
          const errorStack = err?.stack || '';
          
          console.error('[WhatsApp] ❌  Client initialization failed:', errorMsg);
          this.logger.error('CONNECTION', 'Client initialization failed', { 
            error: errorMsg,
            stack: errorStack 
          });
          
          // Write DISCONNECTED status so the UI knows we failed
          this._writeData(`status-${this.sessionId}.json`, {
            status: 'DISCONNECTED',
            reason: `Initialization failed: ${errorMsg}`,
          });
          
          reject(err);
        });
    });
  }

  // ==========================================================================
  // Public — channel utilities
  // ==========================================================================

  /**
   * Returns all subscribed channels known to the ChannelFetcher.
   * Always returns the most up-to-date list — no need to call after init.
   *
   * @returns {Promise<Array<{ id: string, name: string, description: string, subscriberCount: number }>>}
   */
  async getSubscribedChannels() {
    if (this._channelFetcher) {
      return this._channelFetcher.getAll();
    }
    // Fallback if called before initialize()
    const allChats = await this.client.getChats();
    return allChats
      .filter((c) => c.id?._serialized?.endsWith(CHAT_ID_SUFFIX.CHANNEL))
      .map((c) => ({ id: c.id._serialized, name: c.name?.trim() || '' }));
  }

  /**
   * Forces a fresh fetch from all strategies.
   * Useful after subscribing to a new channel mid-session.
   */
  async refreshChannels() {
    if (!this._channelFetcher) {
      throw new Error('[WhatsApp] refreshChannels() called before initialize().');
    }
    return this._channelFetcher.fetchWithRetry();
  }

  /**
   * Invalidates the local name cache for one or all channels.
   * The ChannelFetcher registry is unaffected (it has its own TTL logic).
   */
  refreshChannelCache(channelId) {
    if (channelId) {
      this._channelCache.delete(channelId);
    } else {
      this._channelCache.clear();
    }
  }

  // ==========================================================================
  // Public — outgoing notifications
  // ==========================================================================

  async send(target, message) {
    const { getConnectionManager } = require('./connection-manager');
    const connMgr = getConnectionManager();
    const client  = connMgr ? connMgr.getClient() : this.client;

    if (!client) {
      throw new Error('[WhatsApp] Cannot send: client not available.');
    }

    const chatId = `${String(target).replace(/\D/g, '')}@c.us`;

    await withRetry(
      async () => { await client.sendMessage(chatId, message); },
      {
        maxRetries:  2,
        baseDelayMs: 1_000,
        onRetry: ({ attempt, delay }) => {
          console.warn(`[WhatsApp] Send retry ${attempt}/2 after ${delay}ms`);
          metrics.recordWhatsAppRetry?.();
        },
      }
    );

    console.log('[WhatsApp] ✅  Message delivered.');
  }

  // ==========================================================================
  // Public — callback registration
  // ==========================================================================

  on(eventName, callback) {
    this.callbacks.set(eventName, callback);
  }

  _emit(eventName, data) {
    const cb = this.callbacks.get(eventName);
    if (!cb) return;
    try {
      cb(data);
    } catch (err) {
      console.error(`[WhatsApp] Callback threw for "${eventName}":`, err.message);
    }
  }

  // ==========================================================================
  // Public — teardown
  // ==========================================================================

  async close() {
    this._channelFetcher?.stopPolling();
    if (this.client) {
      await this.client.destroy();
      console.log('[WhatsApp] 🛑  Client closed.');
    }
  }

  // ==========================================================================
  // Private — file helpers
  // =============================================d.m============================

  _writeData(filename, content) {
    try {
      if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });
      const str = typeof content === 'string' ? content : JSON.stringify(content);
      fs.writeFileSync(path.join('data', filename), str);
    } catch (err) {
      console.error(`[WhatsApp] Failed to write ${filename}: ${err.message}`);
    }
  }

  _deleteData(filename) {
    try {
      const p = path.join('data', filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch { /* non-fatal */ }
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { WhatsAppListener, SOURCE_MODE };