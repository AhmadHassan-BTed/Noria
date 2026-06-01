'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { BaseListener } = require('../base');
const { validateUrl } = require('../../utils/validators');
const { withRetry } = require('../../utils/retry');
const { metrics } = require('../../utils/metrics');
const { initConnectionManager } = require('./connection-manager');

// =============================================================================
// Constants
// =============================================================================

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/**
 * Stable whatsapp-web.js chatId suffixes.
 * These are structural identifiers baked into the WhatsApp protocol,
 * not library-specific — safe to match against permanently.
 */
const CHAT_ID_SUFFIX = Object.freeze({
  PERSONAL: '@c.us',
  GROUP:    '@g.us',
  CHANNEL:  '@newsletter', // WhatsApp Channels (Newsletters), introduced 2023
});

/**
 * Source mode flag — controls which message origins are processed.
 *
 * Exported so callers can use SOURCE_MODE.CHANNELS instead of a raw string,
 * getting IDE auto-complete and protection against typos.
 *
 *   CHATS    → Only 1-to-1 and group chats.
 *   CHANNELS → Only WhatsApp Channel posts.
 *   BOTH     → Everything.
 */
const SOURCE_MODE = Object.freeze({
  CHATS:    'chats',
  CHANNELS: 'channels',
  BOTH:     'both',
});

// Channel display-name cache TTL: 1 hour.
// Channels can be renamed; this keeps names fresh without hammering the API.
const CHANNEL_CACHE_TTL_MS = 60 * 60 * 1_000;

// Maximum message IDs held in the deduplication set.
// Prevents unbounded memory growth in 24/7 operation.
const MAX_DEDUP_CACHE_SIZE = 2_000;

// =============================================================================
// Class
// =============================================================================

class WhatsAppListener extends BaseListener {
  /**
   * @param {object} config
   *
   * @param {'chats'|'channels'|'both'} [config.sourceMode='chats']
   *   Which message sources trigger URL extraction.
   *   Default is 'chats' to preserve backward-compatible behaviour.
   *
   * @param {string[]} [config.allowedChannels=[]]
   *   Whitelist for channel messages (only evaluated when sourceMode is
   *   'channels' or 'both').  Each entry may be:
   *     • A full channel ID  — '1234567890123456789@newsletter'
   *     • A display name    — 'Scholarship Alerts'  (case-insensitive)
   *   Empty array (default) = accept messages from ALL subscribed channels.
   *
   * Example full config:
   *   {
   *     sourceMode:      'both',
   *     allowedChannels: ['923001234567@newsletter', 'CS Masters Programs'],
   *   }
   */
  constructor(config = {}) {
    super(config);

    // ── Source mode validation ────────────────────────────────────────────
    const mode = config.sourceMode ?? SOURCE_MODE.CHATS;
    if (!Object.values(SOURCE_MODE).includes(mode)) {
      throw new Error(
        `[WhatsAppListener] Invalid sourceMode: "${mode}". ` +
        `Valid values: ${Object.values(SOURCE_MODE).join(' | ')}.`
      );
    }
    this.sourceMode = mode;

    // ── Channel whitelist ─────────────────────────────────────────────────
    this.allowedChannels = (config.allowedChannels ?? [])
      .map((c) => String(c).trim())
      .filter(Boolean);

    // ── Internal state ────────────────────────────────────────────────────

    /**
     * Channel name cache — avoids a getChat() call on every message.
     * Structure: Map<channelId, { name: string, cachedAt: number }>
     */
    this._channelCache = new Map();

    /**
     * Deduplication ring buffer.
     * whatsapp-web.js can fire duplicate message events on reconnect or when
     * both 'message' and 'message_create' fire for the same channel post.
     * Tracking serialised message IDs prevents double-processing.
     */
    this._processedIds = new Set();

    // ── whatsapp-web.js client ────────────────────────────────────────────
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
    });

    this.callbacks = new Map();
    this.connMgr   = null;
  }

  // ==========================================================================
  // Private — source classification
  // ==========================================================================

  /**
   * Returns true when the message came from a WhatsApp Channel post.
   * Identified by the '@newsletter' suffix on the sender's serialised ID.
   *
   * @param {import('whatsapp-web.js').Message} msg
   * @returns {boolean}
   */
  _isChannelMessage(msg) {
    return typeof msg.from === 'string' &&
           msg.from.endsWith(CHAT_ID_SUFFIX.CHANNEL);
  }

  /**
   * Applies source-mode gating and whitelist filtering.
   * Returns false early (without any async work) when the message type is
   * excluded by sourceMode, keeping the fast path fast.
   *
   * @param {import('whatsapp-web.js').Message} msg
   * @returns {Promise<boolean>}
   */
  async _shouldProcess(msg) {
    const msgId     = msg.id?._serialized;
    const isChannel = this._isChannelMessage(msg);

    // ── Deduplication check (sync, O(1)) ──────────────────────────────────
    if (msgId && this._processedIds.has(msgId)) {
      return false;
    }

    // ── Source mode gate ──────────────────────────────────────────────────
    if (isChannel  && this.sourceMode === SOURCE_MODE.CHATS)    return false;
    if (!isChannel && this.sourceMode === SOURCE_MODE.CHANNELS) return false;

    // ── Channel whitelist (only async work, only when needed) ─────────────
    if (isChannel && this.allowedChannels.length > 0) {
      return this._isAllowedChannel(msg);
    }

    return true;
  }

  /**
   * Checks the channel whitelist by exact ID first (sync, zero cost), then
   * by case-insensitive display name (async, uses cache where possible).
   *
   * Fails CLOSED: if channel metadata cannot be resolved, the message is
   * skipped rather than processed with unknown provenance.
   *
   * @param {import('whatsapp-web.js').Message} msg
   * @returns {Promise<boolean>}
   */
  async _isAllowedChannel(msg) {
    const channelId = msg.from;

    // Fast path: exact channel ID match — no network call needed
    if (this.allowedChannels.includes(channelId)) return true;

    // Slow path: resolve the display name and compare case-insensitively
    try {
      const name = await this._resolveChannelName(channelId, msg);
      return this.allowedChannels.some(
        (allowed) => allowed.toLowerCase() === name.toLowerCase()
      );
    } catch (err) {
      console.warn(
        `[WhatsApp] ⚠️  Cannot resolve channel name for ${channelId} — ` +
        `message skipped (fail-closed). Reason: ${err.message}`
      );
      return false;
    }
  }

  // ==========================================================================
  // Private — channel metadata cache
  // ==========================================================================

  /**
   * Returns the display name of a channel, using the TTL-aware cache when
   * available, falling back to a getChat() API call when stale or missing.
   *
   * @param {string} channelId
   * @param {import('whatsapp-web.js').Message} msg
   * @returns {Promise<string>}
   */
  async _resolveChannelName(channelId, msg) {
    const cached = this._channelCache.get(channelId);

    if (cached && (Date.now() - cached.cachedAt) < CHANNEL_CACHE_TTL_MS) {
      return cached.name;
    }

    // Cache miss or TTL expired — fetch fresh metadata
    const chat = await msg.getChat();
    const name = chat.name?.trim() ?? '';

    this._channelCache.set(channelId, { name, cachedAt: Date.now() });
    return name;
  }

  // ==========================================================================
  // Private — deduplication ring buffer
  // ==========================================================================

  /**
   * Marks a message ID as processed.
   * Evicts the oldest entry once the cache exceeds MAX_DEDUP_CACHE_SIZE to
   * keep memory use bounded in 24/7 operation.
   * (Set preserves insertion order, so the first element is always oldest.)
   *
   * @param {string|undefined} msgId
   */
  _markProcessed(msgId) {
    if (!msgId) return;

    this._processedIds.add(msgId);

    if (this._processedIds.size > MAX_DEDUP_CACHE_SIZE) {
      const [oldest] = this._processedIds;
      this._processedIds.delete(oldest);
    }
  }

  // ==========================================================================
  // Private — channel cache warm-up
  // ==========================================================================

  /**
   * Fetches all subscribed channels and populates the name cache eagerly.
   * Called once on 'ready' so that the first channel message doesn't pay the
   * cost of a cold getChat() call on an incoming post.
   *
   * Non-fatal: if it fails (e.g. the library version doesn't surface channels
   * via getChats), the cache fills lazily per-message instead.
   */
  async _prefetchChannelMetadata() {
    if (this.sourceMode === SOURCE_MODE.CHATS) {
      return; // Channel metadata is irrelevant when only watching chats
    }

    try {
      const allChats   = await this.client.getChats();
      const now        = Date.now();
      let channelCount = 0;

      for (const chat of allChats) {
        if (chat.id._serialized.endsWith(CHAT_ID_SUFFIX.CHANNEL)) {
          this._channelCache.set(chat.id._serialized, {
            name:     chat.name?.trim() ?? '',
            cachedAt: now,
          });
          channelCount++;
        }
      }

      console.log(`[WhatsApp] 📡  Pre-fetched metadata for ${channelCount} subscribed channel(s).`);

      if (this.allowedChannels.length > 0) {
        console.log(`[WhatsApp] 🔒  Whitelist active — watching: ${this.allowedChannels.join(', ')}`);
      } else {
        console.log('[WhatsApp] 🔓  No whitelist — accepting all subscribed channels.');
      }

    } catch (err) {
      // Non-fatal — lazy resolution handles it message-by-message
      console.warn(
        `[WhatsApp] ⚠️  Channel pre-fetch failed — will resolve lazily. ` +
        `Reason: ${err.message}`
      );
    }
  }

  // ==========================================================================
  // Private — unified message handler
  // ==========================================================================

  /**
   * Single entry point for all incoming messages, regardless of source.
   * Pipeline: dedup → source gate → whitelist → URL extract → validate → emit.
   *
   * ── Emitted payload shape for 'link_extracted' ──────────────────────────
   * {
   *   url:         string,           // Validated URL
   *   source:      'chat'|'channel',
   *   channelId:   string | null,    // Populated for channel messages only
   *   channelName: string | null,    // Populated for channel messages only
   *   messageId:   string | null,
   *   timestamp:   Date,
   * }
   *
   * ── MIGRATION NOTE ──────────────────────────────────────────────────────
   * The payload changed from a bare string URL to a structured object.
   * Update the broker bridge in index.js:
   *
   *   // OLD:  broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, (url) => ...)
   *   // NEW:  broker.on(EVENTS.WHATSAPP.LINK_EXTRACTED, ({ url }) => ...)
   *
   * @param {import('whatsapp-web.js').Message} msg
   */
  async _handleMessage(msg) {
    try {
      // ── Routing + dedup ─────────────────────────────────────────────────
      const shouldProcess = await this._shouldProcess(msg);
      if (!shouldProcess) return;

      const msgId     = msg.id?._serialized;
      const isChannel = this._isChannelMessage(msg);

      // Mark BEFORE any awaits below so a fast duplicate event for the same
      // message ID is blocked immediately, even mid-async.
      this._markProcessed(msgId);

      // ── URL extraction ───────────────────────────────────────────────────
      const body = msg.body;
      if (!body || typeof body !== 'string') return;

      const matches = body.match(URL_REGEX);
      if (!matches) return;

      const rawUrl = matches[0]; // One URL per message — keeps the pipeline atomic

      // ── URL validation ───────────────────────────────────────────────────
      let validatedUrl;
      try {
        validatedUrl = validateUrl(rawUrl);
      } catch (err) {
        console.warn(`[WhatsApp] URL validation failed for "${rawUrl}": ${err.message}`);
        return;
      }

      // ── Resolve channel name for the payload ─────────────────────────────
      // After _isAllowedChannel ran, the name is already warm in the cache.
      // For unrestricted channel mode (no whitelist), the first message for a
      // given channel triggers a single cold lookup; subsequent ones are cached.
      let channelName = null;
      if (isChannel) {
        try {
          channelName = await this._resolveChannelName(msg.from, msg);
        } catch {
          channelName = null; // Non-fatal — the URL is still processed
        }
      }

      // ── Emit enriched payload ────────────────────────────────────────────
      const source = isChannel ? 'channel' : 'chat';
      const label  = channelName ? ` "${channelName}"` : '';

      console.log(`[WhatsApp] 🔗  URL extracted from ${source}${label}: ${validatedUrl}`);

      this._emit('link_extracted', {
        url:         validatedUrl,
        source,
        channelId:   isChannel ? msg.from    : null,
        channelName: isChannel ? channelName : null,
        messageId:   msgId  ?? null,
        timestamp:   new Date(),
      });

    } catch (err) {
      // Catch-all: a handler failure must never propagate and crash the event loop
      console.error(`[WhatsApp] ❌  Unhandled error in message handler: ${err.message}`, err.stack);
      this._emit('error', { source: 'messageHandler', error: err });
    }
  }

  // ==========================================================================
  // Public — lifecycle
  // ==========================================================================

  /**
   * Initialises the WhatsApp client and resolves once the session is ready
   * and channel metadata is pre-fetched.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    return new Promise((resolve, reject) => {

      // ── QR code ────────────────────────────────────────────────────────
      this.client.on('qr', (qr) => {
        console.log('[WhatsApp] 📲  Scan the QR code below to authenticate:');
        qrcode.generate(qr, { small: true });
      });

      // ── Ready ──────────────────────────────────────────────────────────
      this.client.on('ready', async () => {
        console.log('[WhatsApp] ✅  Client ready.');
        console.log(`[WhatsApp] ⚙️   Source mode: ${this.sourceMode.toUpperCase()}`);

        this.connMgr = initConnectionManager(this.client);

        try {
          await this._prefetchChannelMetadata();
        } catch (err) {
          console.warn('[WhatsApp] Channel pre-fetch error (non-fatal):', err.message);
        }

        resolve();
      });

      // ── Auth failure ────────────────────────────────────────────────────
      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] ❌  Authentication failed:', msg);
        reject(new Error(`Auth failure: ${msg}`));
      });

      // ── Disconnected ────────────────────────────────────────────────────
      this.client.on('disconnected', (reason) => {
        console.warn('[WhatsApp] ⚠️   Disconnected — reason:', reason);
        this._emit('disconnected', { reason });
      });

      // ── 'message' — primary event for both chats and channels ────────────
      // This fires for all incoming messages in most whatsapp-web.js versions.
      this.client.on('message', (msg) => {
        this._handleMessage(msg);
      });

      // ── 'message_create' — belt-and-suspenders for channel posts ─────────
      //
      // WhatsApp Channel posts arrive via 'message' in most library versions,
      // but some WhatsApp server builds route them through 'message_create'
      // instead, or fire both.  Listening to both events and deduplicating by
      // message ID guarantees zero missed posts regardless of library version.
      //
      // The `!msg.fromMe` guard drops messages the authenticated user sent
      // (which also fire on 'message_create').
      this.client.on('message_create', (msg) => {
        if (!msg.fromMe) {
          this._handleMessage(msg);
        }
      });

      // ── Start the client ────────────────────────────────────────────────
      this.client.initialize().catch(reject);
    });
  }

  // ==========================================================================
  // Public — channel discovery utility
  // ==========================================================================

  /**
   * Returns all WhatsApp Channels the authenticated account is subscribed to.
   * Run this once after initialize() to discover available channel IDs and
   * names, then copy them into your allowedChannels config.
   *
   * Example:
   *   const channels = await listener.getSubscribedChannels();
   *   console.table(channels);
   *   // ┌─────────┬──────────────────────────────┬──────────────────────────┐
   *   // │ (index) │             id               │          name            │
   *   // ├─────────┼──────────────────────────────┼──────────────────────────┤
   *   // │    0    │ '12345678901234567@newsletter'│ 'Scholarship Alerts'     │
   *   // │    1    │ '98765432109876543@newsletter'│ 'CS Masters Programs'    │
   *   // └─────────┴──────────────────────────────┴──────────────────────────┘
   *
   * @returns {Promise<Array<{ id: string, name: string }>>}
   */
  async getSubscribedChannels() {
    const allChats = await this.client.getChats();
    return allChats
      .filter((chat) => chat.id._serialized.endsWith(CHAT_ID_SUFFIX.CHANNEL))
      .map((chat) => ({
        id:   chat.id._serialized,
        name: chat.name?.trim() || '(unnamed channel)',
      }));
  }

  /**
   * Invalidates one or all entries in the channel name cache.
   * Call this if you detect a channel was renamed and want name-based
   * filtering to stay accurate without waiting for the TTL to expire.
   *
   * @param {string} [channelId] - Specific channel ID, or omit to clear all.
   */
  refreshChannelCache(channelId) {
    if (channelId) {
      this._channelCache.delete(channelId);
      console.log(`[WhatsApp] 🔄  Cache invalidated for channel: ${channelId}`);
    } else {
      this._channelCache.clear();
      console.log('[WhatsApp] 🔄  Full channel name cache cleared.');
    }
  }

  // ==========================================================================
  // Public — outgoing notifications
  // ==========================================================================

  /**
   * Sends a text message to a personal phone number (outgoing notification).
   * Intentionally limited to @c.us targets — WhatsApp Channels are
   * broadcast-only for subscribers and cannot receive messages.
   *
   * @param {string} target  - Recipient phone number (any format).
   * @param {string} message - Message body.
   */
  async send(target, message) {
    try {
      const chatId = `${String(target).replace(/\D/g, '')}@c.us`;

      await withRetry(
        async () => {
          await this.client.sendMessage(chatId, message);
        },
        {
          maxRetries: 2,
          baseDelayMs: 1_000,
          onRetry: ({ attempt, delay }) => {
            console.warn(`[WhatsApp] Send retry ${attempt}/2 after ${delay}ms`);
            metrics.recordWhatsAppRetry?.();
          },
        }
      );

      console.log('[WhatsApp] ✅  Notification delivered.');
    } catch (err) {
      metrics.recordWhatsAppFailure?.();
      throw err;
    }
  }

  // ==========================================================================
  // Public — callback registration
  // ==========================================================================

  on(eventName, callback) {
    this.callbacks.set(eventName, callback);
  }

  _emit(eventName, data) {
    const callback = this.callbacks.get(eventName);
    if (!callback) return;
    try {
      callback(data);
    } catch (err) {
      // Prevent a broken callback from silently killing the event loop
      console.error(`[WhatsApp] Callback threw for event "${eventName}":`, err.message);
    }
  }

  // ==========================================================================
  // Public — teardown
  // ==========================================================================

  async close() {
    if (this.client) {
      await this.client.destroy();
      console.log('[WhatsApp] 🛑  Client closed.');
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { WhatsAppListener, SOURCE_MODE };