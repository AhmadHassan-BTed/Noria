'use strict';

const EventEmitter = require('events');

// =============================================================================
// ChannelFetcher — WhatsApp Newsletter / Channel Discovery
// =============================================================================
//
// ROOT CAUSE OF THE FETCHING FAILURE:
//   client.getChats() internally calls window.WWebJS.getChats(), which
//   deliberately filters OUT newsletter/channel subscriptions. Retrying
//   getChats() with longer waits will NEVER fix this — the function simply
//   does not include @newsletter chats in its return value regardless of
//   how long the session has been connected.
//
// THE FIX:
//   Access window.Store.Newsletter directly via client.pupPage.evaluate().
//   This is the same JavaScript object that WhatsApp Web's own UI reads from
//   when it renders the Channels tab. It always contains your subscriptions.
//
// ARCHITECTURE:
//   This class is fully decoupled from WhatsAppListener. It takes the
//   whatsapp-web.js `client` as its only dependency and emits events that
//   WhatsAppListener subscribes to. Neither file imports the other.
//
// STRATEGY WATERFALL (tried in order until one yields results):
//   1. Newsletter Store  — window.Store.Newsletter / .NewsletterCollection
//   2. Chat Store Filter — window.Store.Chat, filtered by @newsletter suffix
//   3. WAPI Bridge      — window.WAPI.getNewsletterSubscriptions (if present)
//   4. getChats() shim  — client.getChats() with @newsletter filter (last resort)
//
// REAL-TIME BRIDGE:
//   Beyond one-shot fetching, this class also installs a Backbone 'add' /
//   'change' listener inside the page via pupPage.exposeFunction(). This
//   catches channels that WhatsApp Web lazy-loads AFTER the 'ready' event
//   fires (common when a session has many subscriptions or a slow connection).
// =============================================================================

const NEWSLETTER_SUFFIX    = '@newsletter';
const BRIDGE_FN_NAME       = '__noriaChannelDetected';
const DEFAULT_POLL_MS      = 45_000;   // Background re-scan interval
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY  = 4_000;    // Between fetch attempts

class ChannelFetcher extends EventEmitter {
  /**
   * @param {import('whatsapp-web.js').Client} client
   *   The initialised whatsapp-web.js client. Must be called AFTER the
   *   'ready' event has fired (i.e., pupPage is guaranteed to exist).
   *
   * @param {object} [options]
   * @param {number} [options.maxAttempts=5]     Retry attempts for fetchWithRetry().
   * @param {number} [options.retryDelayMs=4000] Delay between retry attempts.
   * @param {number} [options.pollIntervalMs=45000] Background poll interval.
   * @param {Function} [options.log]             Optional logging function.
   */
  constructor(client, options = {}) {
    super();
    this.client      = client;
    this.maxAttempts = options.maxAttempts   ?? DEFAULT_MAX_ATTEMPTS;
    this.retryDelay  = options.retryDelayMs  ?? DEFAULT_RETRY_DELAY;
    this.pollMs      = options.pollIntervalMs ?? DEFAULT_POLL_MS;
    this._log        = options.log ?? console.log;

    /**
     * Master map of discovered channels.
     * Key: channelId (e.g. '12345678901234567@newsletter')
     * Value: ChannelInfo object
     */
    this._channels    = new Map();
    this._pollTimer   = null;
    this._bridgeReady = false;
  }

  // ==========================================================================
  // Public — data access
  // ==========================================================================

  /** @returns {ChannelInfo[]} All known channels, sorted by name. */
  getAll() {
    return [...this._channels.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * @param {string} channelId  Full @newsletter ID.
   * @returns {ChannelInfo|null}
   */
  getById(channelId) {
    return this._channels.get(channelId) ?? null;
  }

  /**
   * Case-insensitive name lookup.
   * @param {string} name
   * @returns {ChannelInfo|null}
   */
  getByName(name) {
    const lower = name.toLowerCase();
    for (const ch of this._channels.values()) {
      if (ch.name.toLowerCase() === lower) return ch;
    }
    return null;
  }

  // ==========================================================================
  // Public — lifecycle
  // ==========================================================================

  /**
   * Full initialization:
   *   1. Installs the real-time page bridge (catches lazy-loaded channels).
   *   2. Runs fetchWithRetry() for immediate population.
   *
   * Call this ONCE inside the WhatsApp 'ready' handler.
   * @returns {Promise<ChannelInfo[]>} Initial set of found channels.
   */
  async setup() {
    await this._installBridge();
    await this.fetchWithRetry();
    return this.getAll();
  }

  /**
   * Tries all fetch strategies in order, retrying the full waterfall
   * up to maxAttempts times with retryDelay between attempts.
   *
   * @returns {Promise<ChannelInfo[]>}
   */
  async fetchWithRetry() {
    const strategies = [
      { label: 'Newsletter Store (window.Store.Newsletter)', fn: this._strategyNewsletterStore.bind(this) },
      { label: 'Chat Store filter (@newsletter suffix)',     fn: this._strategyChatStore.bind(this) },
      { label: 'WAPI bridge (window.WAPI)',                  fn: this._strategyWAPI.bind(this) },
      { label: 'getChats() shim (last resort)',             fn: this._strategyGetChats.bind(this) },
    ];

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      this._log(`[ChannelFetcher] 🔍  Fetch attempt ${attempt}/${this.maxAttempts}...`);

      for (const strategy of strategies) {
        try {
          const results = await strategy.fn();
          if (Array.isArray(results) && results.length > 0) {
            this._mergeChannels(results);
            this._log(
              `[ChannelFetcher] ✅  Found ${results.length} channel(s) ` +
              `via "${strategy.label}" (attempt ${attempt})`
            );
          }
        } catch (err) {
          this._log(`[ChannelFetcher] ⚠️  Strategy "${strategy.label}" error: ${err.message}`);
        }
      }

      // If any strategy found channels, we're done
      if (this._channels.size > 0) {
        this._log(`[ChannelFetcher] ✅  Total channels discovered: ${this._channels.size}`);
        return this.getAll();
      }

      // No results yet — wait before next attempt
      if (attempt < this.maxAttempts) {
        this._log(
          `[ChannelFetcher] ⏳  No channels found yet. ` +
          `WhatsApp may still be syncing. Retrying in ${this.retryDelay / 1000}s...`
        );
        await this._sleep(this.retryDelay);
      }
    }

    this._log(
      `[ChannelFetcher] ⚠️  No channels discovered after ${this.maxAttempts} attempts.\n` +
      `[ChannelFetcher]    Possible reasons:\n` +
      `[ChannelFetcher]    • This WhatsApp account has no channel subscriptions.\n` +
      `[ChannelFetcher]    • Channel sync is still in progress — bridge will catch them.\n` +
      `[ChannelFetcher]    • whatsapp-web.js version does not expose Store.Newsletter.\n` +
      `[ChannelFetcher]    → The real-time bridge remains active and will catch late syncs.`
    );
    return [];
  }

  /**
   * Starts a periodic background re-scan.  Useful for very long-running
   * sessions where the user subscribes to new channels mid-session.
   *
   * @param {number} [intervalMs] - Override pollIntervalMs option.
   */
  startPolling(intervalMs) {
    this.stopPolling();
    const ms = intervalMs ?? this.pollMs;
    this._pollTimer = setInterval(async () => {
      this._log(`[ChannelFetcher] 🔄  Background poll...`);
      await this.fetchWithRetry().catch((err) =>
        this._log(`[ChannelFetcher] Poll error: ${err.message}`)
      );
    }, ms);
    this._log(`[ChannelFetcher] 🔁  Background polling started (every ${ms / 1000}s).`);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
      this._log(`[ChannelFetcher] ⏹️  Background polling stopped.`);
    }
  }

  // ==========================================================================
  // Private — page bridge (real-time, event-driven)
  // ==========================================================================

  /**
   * Exposes a Node.js callback function into the WhatsApp Web page context
   * via Puppeteer's exposeFunction().  Then evaluates a script inside the
   * page that:
   *   a) Iterates channels ALREADY loaded in the Newsletter Backbone store.
   *   b) Attaches 'add' and 'change' listeners for channels loaded LATER.
   *
   * This is the most important part of the fix — without it, channels that
   * WhatsApp lazy-loads after the 'ready' event would be invisible.
   */
  async _installBridge() {
    if (this._bridgeReady) return;

    const pupPage = this.client.pupPage;
    if (!pupPage) {
      this._log('[ChannelFetcher] ⚠️  pupPage not available — bridge skipped.');
      return;
    }

    // ── Step 1: Expose the Node.js handler into the browser page ──────────
    try {
      await pupPage.exposeFunction(BRIDGE_FN_NAME, (rawData) => {
        this._handleRawChannelData(rawData);
      });
      this._bridgeReady = true;
      this._log(`[ChannelFetcher] 🌉  Page bridge "${BRIDGE_FN_NAME}" exposed.`);
    } catch (err) {
      // exposeFunction throws 'already exists' on reconnect — that's fine
      if (err.message?.toLowerCase().includes('already')) {
        this._bridgeReady = true;
        this._log(`[ChannelFetcher] 🌉  Page bridge already active (reconnect).`);
      } else {
        this._log(`[ChannelFetcher] ⚠️  Could not expose bridge: ${err.message}`);
        return;
      }
    }

    // ── Step 2: Inject the Backbone listener script into the page ─────────
    try {
      await pupPage.evaluate((bridgeFnName) => {

        // Helper: extracts a plain serializable object from a Newsletter model
        function extractData(n) {
          const id = n.id?._serialized ||
                     (typeof n.id === 'string' ? n.id : null);
          if (!id || !id.endsWith('@newsletter')) return null;

          return {
            id,
            name:            n.name               ||
                             n.metadata?.name      ||
                             n.formattedName       ||
                             n.displayName         || '',
            description:     n.metadata?.description || n.description || '',
            subscriberCount: n.metadata?.subscriberCount ||
                             n.subscriberCount     || 0,
            state:           n.state              || 'SUBSCRIBED',
          };
        }

        const bridge = window[bridgeFnName];
        if (!bridge) return;

        // ── Locate the Newsletter Backbone collection ──────────────────────
        // WhatsApp Web uses different internal names across versions.
        // We try all known variants.
        const candidateStores = [
          window.Store?.Newsletter,
          window.Store?.NewsletterCollection,
          window.Store?.Newsletters,
        ].filter(Boolean);

        let attachedTo = null;

        for (const store of candidateStores) {
          // Backbone collections have a `models` array and an `on` method
          if (typeof store.on !== 'function') continue;

          // ── Report channels already in the store ───────────────────────
          if (typeof store.forEach === 'function') {
            store.forEach(n => {
              const data = extractData(n);
              if (data) bridge(data);
            });
          } else if (Array.isArray(store.models)) {
            store.models.forEach(n => {
              const data = extractData(n);
              if (data) bridge(data);
            });
          }

          // ── Attach listeners for future additions ──────────────────────
          store.on('add', n => {
            const data = extractData(n);
            if (data) bridge({ ...data, _event: 'add' });
          });

          // 'change:name' and 'change:metadata' fire when a channel is renamed
          store.on('change', n => {
            const data = extractData(n);
            if (data) bridge({ ...data, _event: 'change' });
          });

          attachedTo = store.constructor?.name || 'Newsletter store';
          break;
        }

        // ── Also scan Chat store as a supplementary source ─────────────────
        // Some WA builds store newsletters in the Chat collection.
        const chatStore = window.Store?.Chat || window.Store?.ChatCollection;
        if (chatStore && typeof chatStore.forEach === 'function') {
          chatStore.forEach(chat => {
            const id = chat.id?._serialized;
            if (id && id.endsWith('@newsletter')) {
              bridge({
                id,
                name:            chat.name || chat.formattedName || '',
                description:     '',
                subscriberCount: 0,
                state:           'SUBSCRIBED',
                _source:         'ChatStore',
              });
            }
          });

          // Listen for newsletters added to the Chat store later
          if (typeof chatStore.on === 'function') {
            chatStore.on('add', chat => {
              const id = chat.id?._serialized;
              if (id && id.endsWith('@newsletter')) {
                bridge({
                  id,
                  name:    chat.name || '',
                  _event:  'add',
                  _source: 'ChatStore',
                });
              }
            });
          }
        }

        console.log(
          `[ChannelFetcher] Bridge active. Newsletter store: ${attachedTo || 'not found'}. ` +
          `Chat store fallback: ${chatStore ? 'attached' : 'not found'}.`
        );

      }, BRIDGE_FN_NAME);

      this._log('[ChannelFetcher] ✅  Backbone listeners installed inside WA page.');
    } catch (err) {
      this._log(`[ChannelFetcher] ⚠️  Could not install page listeners: ${err.message}`);
    }
  }

  // ==========================================================================
  // Private — fetch strategies
  // ==========================================================================

  /**
   * Strategy 1: Access window.Store.Newsletter directly.
   * This is the canonical path — it's the same object WA Web UI reads from.
   */
  async _strategyNewsletterStore() {
    return this.client.pupPage.evaluate(() => {
      const results = [];

      function extract(n) {
        const id = n.id?._serialized || (typeof n.id === 'string' ? n.id : null);
        if (!id || !id.endsWith('@newsletter')) return null;
        return {
          id,
          name:            n.name || n.metadata?.name || n.formattedName || '',
          description:     n.metadata?.description || '',
          subscriberCount: n.metadata?.subscriberCount || n.subscriberCount || 0,
          state:           n.state || 'SUBSCRIBED',
        };
      }

      const stores = [
        window.Store?.Newsletter,
        window.Store?.NewsletterCollection,
        window.Store?.Newsletters,
      ].filter(Boolean);

      for (const store of stores) {
        const iterate =
          typeof store.forEach === 'function' ? (fn) => store.forEach(fn)         :
          Array.isArray(store.models)          ? (fn) => store.models.forEach(fn)  :
          typeof store.getAll === 'function'   ? (fn) => store.getAll().forEach(fn) :
          null;

        if (!iterate) continue;

        iterate(n => {
          const d = extract(n);
          if (d) results.push(d);
        });

        if (results.length > 0) break;
      }

      return results;
    });
  }

  /**
   * Strategy 2: Filter window.Store.Chat for IDs ending in @newsletter.
   * Covers WA builds where newsletters live in the unified Chat collection.
   */
  async _strategyChatStore() {
    return this.client.pupPage.evaluate(() => {
      const results = [];
      const store = window.Store?.Chat || window.Store?.ChatCollection;
      if (!store) return results;

      const iterate =
        typeof store.forEach === 'function' ? (fn) => store.forEach(fn) :
        Array.isArray(store.models)          ? (fn) => store.models.forEach(fn) :
        null;

      if (!iterate) return results;

      iterate(chat => {
        const id = chat.id?._serialized;
        if (id && id.endsWith('@newsletter')) {
          results.push({
            id,
            name:            chat.name || chat.formattedName || '',
            description:     '',
            subscriberCount: 0,
            state:           'SUBSCRIBED',
          });
        }
      });

      return results;
    });
  }

  /**
   * Strategy 3: window.WAPI.getNewsletterSubscriptions — present in some
   * unofficial WA Web bridges.  No-ops gracefully if the method is absent.
   */
  async _strategyWAPI() {
    return this.client.pupPage.evaluate(() => {
      if (!window.WAPI?.getNewsletterSubscriptions) return [];
      try {
        const raw = window.WAPI.getNewsletterSubscriptions();
        if (!Array.isArray(raw)) return [];
        return raw
          .filter(n => n?.id?.endsWith('@newsletter'))
          .map(n => ({
            id:              n.id,
            name:            n.name || '',
            description:     n.description || '',
            subscriberCount: n.subscriberCount || 0,
            state:           'SUBSCRIBED',
          }));
      } catch {
        return [];
      }
    });
  }

  /**
   * Strategy 4: client.getChats() with @newsletter filter.
   *
   * This is the LAST RESORT because getChats() almost never returns
   * newsletters — but we include it as a safety net for edge cases.
   */
  async _strategyGetChats() {
    const chats = await this.client.getChats();
    return chats
      .filter(c => c.id?._serialized?.endsWith(NEWSLETTER_SUFFIX))
      .map(c => ({
        id:              c.id._serialized,
        name:            c.name?.trim() || '',
        description:     '',
        subscriberCount: 0,
        state:           'SUBSCRIBED',
      }));
  }

  // ==========================================================================
  // Private — channel bookkeeping
  // ==========================================================================

  /**
   * Handles raw channel data arriving from the page bridge.
   * Normalises and upserts into the master map, then emits events.
   *
   * @param {object} rawData
   */
  _handleRawChannelData(rawData) {
    if (!rawData?.id || typeof rawData.id !== 'string') return;
    if (!rawData.id.endsWith(NEWSLETTER_SUFFIX))         return;

    const existing   = this._channels.get(rawData.id);
    const isNew      = !existing;
    const nameChanged = existing && existing.name !== rawData.name;

    /** @type {ChannelInfo} */
    const info = {
      id:              rawData.id,
      name:            rawData.name            || '',
      description:     rawData.description     || '',
      subscriberCount: rawData.subscriberCount || 0,
      state:           rawData.state           || 'SUBSCRIBED',
      discoveredAt:    existing?.discoveredAt  || new Date(),
      updatedAt:       new Date(),
    };

    this._channels.set(info.id, info);

    if (isNew) {
      this._log(`[ChannelFetcher] 📡  Channel discovered: "${info.name}" (${info.id})`);
      this.emit('channel:discovered', info);
    } else if (nameChanged) {
      this._log(`[ChannelFetcher] 🔄  Channel renamed: "${info.name}" (${info.id})`);
      this.emit('channel:updated', info);
    }
  }

  /**
   * Merges a batch of raw channel objects into the master map.
   * @param {object[]} channels
   */
  _mergeChannels(channels) {
    for (const ch of channels) {
      this._handleRawChannelData(ch);
    }
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// JSDoc typedef
// =============================================================================

/**
 * @typedef {object} ChannelInfo
 * @property {string} id              - Full @newsletter chatId
 * @property {string} name            - Display name
 * @property {string} description     - Channel description
 * @property {number} subscriberCount - Subscriber count (0 if unknown)
 * @property {string} state           - 'SUBSCRIBED' | 'PREVIEW' | 'UNSUBSCRIBED'
 * @property {Date}   discoveredAt    - When this channel was first seen
 * @property {Date}   updatedAt       - Last time this record was written
 */

module.exports = { ChannelFetcher };