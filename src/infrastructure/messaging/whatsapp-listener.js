'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const { validateUrl } = require('../../utils/validators');
const { metrics } = require('../../utils/metrics');
const { withRetry } = require('../../utils/retry');
const { initConnectionManager } = require('./connection-manager');
const { ChannelFetcher } = require('./channel-fetcher');

// Decoupled source-mode & classifier modules
const { CHAT_ID_SUFFIX, SOURCE_MODE, normalizeSourceMode } = require('./source-mode');

const {
  getMsgChatId,
  isChannelMessage,
  classifyOrigin,
  isSourceAllowed,
} = require('./source-classifier');

// =============================================================================
// File Logger (unchanged from original)
// =============================================================================

class SessionLogger {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.logDir = 'data';
    this.logFile = path.join(this.logDir, `logs-${sessionId}.log`);
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
          if (fs.existsSync(backup)) {
            fs.unlinkSync(backup);
          }
          fs.renameSync(this.logFile, backup);
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  log(level, category, message, metadata = null) {
    try {
      this._rotateIfNeeded();
      const ts = new Date().toISOString();
      let entry = `[${ts}] [${level}] [${category}] ${message}`;
      if (metadata) {
        entry += ` | ${JSON.stringify(metadata)}`;
      }
      fs.appendFileSync(this.logFile, entry + '\n');
    } catch (err) {
      console.error(`[SessionLogger] Write failed: ${err.message}`);
    }
  }

  info(cat, msg, meta) {
    this.log('INFO', cat, msg, meta);
  }
  warn(cat, msg, meta) {
    this.log('WARN', cat, msg, meta);
  }
  error(cat, msg, meta) {
    this.log('ERROR', cat, msg, meta);
  }
  debug(cat, msg, meta) {
    this.log('DEBUG', cat, msg, meta);
  }

  clear() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
      }
    } catch {
      /* non-fatal */
    }
  }
}

// =============================================================================
// Constants
// =============================================================================

const URL_REGEX =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const CHANNEL_CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour (re-fetch from fetcher)
const MAX_DEDUP_CACHE_SIZE = 2_000;

// =============================================================================
// WhatsAppListener
// =============================================================================

class WhatsAppListener {
  /**
   * @param {object} config
   * @param {'chats'|'channels'|'both'} [config.sourceMode='chats']
   * @param {string[]} [config.allowedChannels=[]]
   *   Whitelist: full @newsletter IDs or display names (case-insensitive).
   *   Empty = accept all subscribed channels.
   * @param {string} [config.sessionId='default']
   */
  constructor(config = {}) {
    this.config = config;
    this.name = 'WhatsAppListener';

    // ── Source mode ───────────────────────────────────────────────────────
    // Accepts:
    //   - Legacy strings: 'chats', 'channels', 'both', 'all'
    //   - Comma-separated strings: 'individual,groups,channels'
    //   - Arrays: ['individual', 'groups', 'channels']
    //
    // Internally normalised to an array of canonical origin names.
    const rawMode = config.sourceMode ?? SOURCE_MODE.CHATS;
    this.sourceMode = normalizeSourceMode(rawMode);

    // ── Channel whitelist ─────────────────────────────────────────────────
    this.allowedChannels = (config.allowedChannels ?? [])
      .map((c) => String(c).trim())
      .filter(Boolean);

    this.allowedGroups = (config.allowedGroups ?? []).map((g) => String(g).trim()).filter(Boolean);

    this.allowedChats = (config.allowedChats ?? []).map((c) => String(c).trim()).filter(Boolean);

    // ── Session state ─────────────────────────────────────────────────────
    this.sessionId = config.sessionId ?? 'default';
    this.logger = new SessionLogger(this.sessionId);

    /**
     * Channel name cache — local fast-path lookup keyed by channelId.
     * Populated from ChannelFetcher events; entries have a TTL.
     * Structure: Map<channelId, { name: string, cachedAt: number }>
     */
    this._channelCache = new Map();
    this._groupCache = new Map();
    this._chatCache = new Map();
    this._processedIds = new Set(); // Dedup ring buffer
    this._channelFetcher = null; // Initialised inside initialize()

    // ── whatsapp-web.js client ────────────────────────────────────────────
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: `.wwebjs_auth/session-${this.sessionId}`,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
        ],
      },
    });

    this.callbacks = new Map();
    this.connMgr = null;

    // Wrap authStrategy.logout to handle EBUSY / file locks on Windows gracefully
    if (this.client.authStrategy && typeof this.client.authStrategy.logout === 'function') {
      const originalLogout = this.client.authStrategy.logout.bind(this.client.authStrategy);
      this.client.authStrategy.logout = async () => {
        try {
          return await originalLogout();
        } catch (err) {
          console.warn(
            '[WhatsApp WARN] [Logout] Ignored session folder cleanup error (likely due to file lock on Windows):',
            err.message
          );
        }
      };
    }

    this.logger.info('SYSTEM', 'Listener constructed', {
      sessionId: this.sessionId,
      sourceMode: this.sourceMode,
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
      maxAttempts: 5,
      retryDelayMs: 4_000,
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

    // Progress updates to status file
    this._channelFetcher.on('progress', (data) => {
      const channels = this._channelFetcher.getAll().map((c) => c.name || c.id);

      this._updateStatusFile({
        discoveryStatus: data.percent === 100 ? 'COMPLETED' : 'DISCOVERING',
        discoveryProgress: data.percent,
        discoveryMessage: data.message,
        channels: channels,
      });
    });

    // Full setup: bridge + initial fetch
    const found = await this._channelFetcher.setup();

    // Log the whitelist status
    if (this.sourceMode.includes('channels')) {
      if (found.length === 0) {
        console.log(
          '[WhatsApp]  [WARNING]   No subscribed channels found yet (bridge is active for late arrivals).'
        );
      } else {
        console.log(`[WhatsApp]   Subscribed channels (${found.length}):`);
        found.forEach((ch) => console.log(`[WhatsApp]     • "${ch.name}" — ${ch.id}`));
      }

      if (this.allowedChannels.length > 0) {
        console.log(`[WhatsApp]  [SECURE]   Whitelist: ${this.allowedChannels.join(', ')}`);
      } else {
        console.log('[WhatsApp]   No whitelist — accepting all subscribed channels.');
      }
    }

    return found;
  }

  _updateStatusFile(updates) {
    let currStatus = {};
    try {
      const statusPath = path.join('data', `status-${this.sessionId}.json`);
      if (fs.existsSync(statusPath)) {
        currStatus = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      }
    } catch (err) {
      /* non-fatal */
    }

    const merged = {
      ...currStatus,
      ...updates,
    };

    this._writeData(`status-${this.sessionId}.json`, merged);
  }

  async _discoverGroupsAndChats() {
    this._discoverGroupsAsync().catch((err) => {
      console.warn('[WhatsApp WARN] Background groups fetch error:', err.message);
    });

    this._discoverChatsAsync().catch((err) => {
      console.warn('[WhatsApp WARN] Background chats fetch error:', err.message);
    });
  }

  async _discoverGroupsAsync() {
    this.logger.info('GROUPS_DISCOVERY', 'Starting background group discovery...');
    const chats = await this.client.getChats();
    const groups = chats
      .filter((c) => c.isGroup === true && c.id && c.id._serialized)
      .map((c) => {
        const name = c.name?.trim() || c.id.user || c.id._serialized;
        this._groupCache.set(c.id._serialized, { name, cachedAt: Date.now() });
        return name;
      });

    this._updateStatusFile({ groups });
    this.logger.info(
      'GROUPS_DISCOVERY',
      `Completed group discovery. Found ${groups.length} groups.`
    );
  }

  async _discoverChatsAsync() {
    this.logger.info('CHATS_DISCOVERY', 'Starting background individual chats discovery...');
    const chats = await this.client.getChats();
    const individualChats = chats
      .filter(
        (c) =>
          c.isGroup === false &&
          !c.id._serialized.endsWith(CHAT_ID_SUFFIX.CHANNEL) &&
          c.id &&
          c.id._serialized
      )
      .map((c) => {
        const name = c.name?.trim() || c.id.user || c.id._serialized;
        this._chatCache.set(c.id._serialized, { name, cachedAt: Date.now() });
        return name;
      });

    this._updateStatusFile({ chats: individualChats });
    this.logger.info(
      'CHATS_DISCOVERY',
      `Completed individual chats discovery. Found ${individualChats.length} chats.`
    );
  }

  // ==========================================================================
  // Private — source classification (delegates to decoupled modules)
  // ==========================================================================

  /** @param {import('whatsapp-web.js').Message} msg */
  _isChannelMessage(msg) {
    return isChannelMessage(msg);
  }

  /**
   * @param {import('whatsapp-web.js').Message} msg
   * @returns {'channels'|'groups'|'individual'}
   */
  _classifyOrigin(msg) {
    return classifyOrigin(msg);
  }

  /**
   * @param {import('whatsapp-web.js').Message} msg
   * @returns {boolean}
   */
  _isSourceAllowed(msg) {
    return isSourceAllowed(msg, this.sourceMode);
  }

  /** @returns {Promise<boolean>} */
  async _shouldProcess(msg, skipDedup = false) {
    const msgId = msg.id?._serialized;

    // Dedup (O(1))
    if (!skipDedup && msgId && this._processedIds.has(msgId)) {
      return false;
    }

    // Source gate — uses granular origin classification
    if (!this._isSourceAllowed(msg)) {
      return false;
    }

    // Channel whitelist (only applies to channel messages)
    const isChannel = this._isChannelMessage(msg);
    if (isChannel && this.allowedChannels.length > 0) {
      return this._isAllowedChannel(msg);
    }

    // Group whitelist (only applies to group messages)
    const isGroup = this._classifyOrigin(msg) === 'groups';
    if (isGroup && this.allowedGroups.length > 0) {
      return this._isAllowedGroup(msg);
    }

    // Individual chat whitelist (only applies to individual messages)
    const isIndividual = this._classifyOrigin(msg) === 'individual';
    if (isIndividual && this.allowedChats.length > 0) {
      return this._isAllowedChat(msg);
    }

    return true;
  }

  /** Fails CLOSED: skips message if channel metadata cannot be resolved. */
  async _isAllowedChannel(msg) {
    const channelId = getMsgChatId(msg);

    // Fast path: exact ID match
    if (this.allowedChannels.includes(channelId)) {
      return true;
    }

    // Medium path: check ChannelFetcher's registry by name
    if (this._channelFetcher) {
      for (const allowed of this.allowedChannels) {
        const found =
          this._channelFetcher.getByName(allowed) || this._channelFetcher.getById(allowed);
        if (found && found.id === channelId) {
          return true;
        }
      }
    }

    // Slow path: resolve via cache → msg.getChat()
    try {
      const name = await this._resolveChannelName(channelId, msg);
      return this.allowedChannels.some((a) => a.toLowerCase() === name.toLowerCase());
    } catch (err) {
      console.warn(
        `[WhatsApp]  [WARNING]   Cannot resolve channel name for ${channelId} — skipped. ` +
          `Reason: ${err.message}`
      );
      return false;
    }
  }

  /** Fails CLOSED: skips message if group metadata cannot be resolved. */
  async _isAllowedGroup(msg) {
    const groupId = getMsgChatId(msg);

    // Fast path: exact ID match
    if (this.allowedGroups.includes(groupId)) {
      return true;
    }

    // Slow path: resolve via cache → msg.getChat()
    try {
      const name = await this._resolveGroupName(groupId, msg);
      return this.allowedGroups.some((g) => g.toLowerCase() === name.toLowerCase());
    } catch (err) {
      console.warn(
        `[WhatsApp]  [WARNING]   Cannot resolve group name for ${groupId} — skipped. ` +
          `Reason: ${err.message}`
      );
      return false;
    }
  }

  /** Fails CLOSED: skips message if individual metadata cannot be resolved. */
  async _isAllowedChat(msg) {
    const chatId = getMsgChatId(msg);
    const phone = chatId.split('@')[0];

    // Fast path: exact ID or phone match
    if (this.allowedChats.includes(chatId) || this.allowedChats.includes(phone)) {
      return true;
    }

    // Slow path: resolve via cache → msg.getChat()
    try {
      const name = await this._resolveChatName(chatId, msg);
      return this.allowedChats.some((c) => c.toLowerCase() === name.toLowerCase());
    } catch (err) {
      console.warn(
        `[WhatsApp]  [WARNING]   Cannot resolve chat name for ${chatId} — skipped. ` +
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
    if (cached && Date.now() - cached.cachedAt < CHANNEL_CACHE_TTL_MS) {
      return cached.name;
    }

    // 3. Live fetch
    let chat;
    try {
      chat = await this.client.getChatById(channelId);
    } catch {
      chat = await msg.getChat();
    }
    const name = chat?.name?.trim() ?? '';
    if (name) {
      this._channelCache.set(channelId, { name, cachedAt: Date.now() });
    }
    return name;
  }

  async _resolveGroupName(groupId, msg) {
    const cached = this._groupCache.get(groupId);
    if (cached && Date.now() - cached.cachedAt < CHANNEL_CACHE_TTL_MS) {
      return cached.name;
    }
    let chat;
    try {
      chat = await this.client.getChatById(groupId);
    } catch {
      chat = await msg.getChat();
    }
    const name = chat?.name?.trim() ?? '';
    if (name) {
      this._groupCache.set(groupId, { name, cachedAt: Date.now() });
    }
    return name;
  }

  async _resolveChatName(chatId, msg) {
    const cached = this._chatCache.get(chatId);
    if (cached && Date.now() - cached.cachedAt < CHANNEL_CACHE_TTL_MS) {
      return cached.name;
    }
    let chat;
    try {
      chat = await this.client.getChatById(chatId);
    } catch {
      chat = await msg.getChat();
    }
    const name = chat?.name?.trim() ?? '';
    if (name) {
      this._chatCache.set(chatId, { name, cachedAt: Date.now() });
    }
    return name;
  }

  // ==========================================================================
  // Private — deduplication ring buffer
  // ==========================================================================

  _markProcessed(msgId) {
    if (!msgId) {
      return;
    }
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
      const msgId = msg.id?._serialized;
      const isChannel = this._isChannelMessage(msg);
      const isGroup = this._classifyOrigin(msg) === 'groups';
      const msgSource = isChannel ? 'channel' : isGroup ? 'group' : 'chat';
      const chatId = getMsgChatId(msg);

      this.logger.debug('MESSAGE', 'Received event for message', {
        messageId: msgId,
        from: msg.from,
        to: msg.to,
        fromMe: !!msg.fromMe,
        hasBody: !!msg.body,
        source: msgSource,
      });

      // Ignore all outgoing messages (fromMe) unless it's a manual user message (not bot sent and doesn't look like a notification)
      if (msg && msg.fromMe) {
        const isBotSent = global.botSentMessageIds && global.botSentMessageIds.has(msgId);
        const isNoriaNotify =
          msg.body && msg.body.includes('MATCH |') && msg.body.includes(' [FAST]  Verdict:');
        if (isBotSent || isNoriaNotify) {
          this.logger.debug('MESSAGE', 'Ignored outgoing bot notification', { messageId: msgId });
          return;
        }
        this.logger.debug('MESSAGE', 'Processing manual user outgoing message', {
          messageId: msgId,
        });
      }

      // ── Synchronous deduplication to prevent async race conditions ───────
      if (msgId) {
        if (this._processedIds.has(msgId)) {
          return;
        }
        this._markProcessed(msgId);
      }

      this.logger.debug('MESSAGE', `Incoming ${msgSource} message`, {
        messageId: msgId,
        from: chatId,
        hasBody: !!msg.body,
      });

      // ── Gate ────────────────────────────────────────────────────────────
      const shouldProcess = await this._shouldProcess(msg, true);
      if (!shouldProcess) {
        this.logger.debug('MESSAGE', 'Filtered (mode/whitelist)', { messageId: msgId });
        return;
      }

      // ── URL extraction ───────────────────────────────────────────────────
      const body = msg.body;
      if (!body || typeof body !== 'string') {
        this.logger.debug('MESSAGE', 'Skipped (No text body)', { messageId: msgId });
        return;
      }

      const matches = body.match(URL_REGEX);
      if (!matches) {
        this.logger.debug('MESSAGE', 'Skipped (No URL found)', { messageId: msgId });
        return;
      }

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
          channelName = await this._resolveChannelName(chatId, msg);
        } catch {
          channelName = null; // Non-fatal
        }
      }

      // ── Emit ─────────────────────────────────────────────────────────────
      const source = msgSource;
      const label = channelName ? ` "${channelName}"` : '';
      console.log(`[WhatsApp]   URL from ${source}${label}: ${validatedUrl}`);

      this.logger.info('URL_EXTRACTED', `URL from ${source}${label}`, {
        messageId: msgId,
        url: validatedUrl,
        channelId: isChannel ? chatId : null,
        channelName,
      });

      this._emit('link_extracted', {
        url: validatedUrl,
        source,
        channelId: isChannel ? chatId : null,
        channelName: isChannel ? channelName : null,
        messageId: msgId ?? null,
        timestamp: new Date(),
        messageText: body,
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
        console.log('[WhatsApp]   Scan the QR code below:');
        qrcode.generate(qr, { small: true });
        this.logger.info('CONNECTION', 'QR code generated');
        this._writeData(`qr-${this.sessionId}.txt`, qr);
        this._writeData(`status-${this.sessionId}.json`, { status: 'SCAN_QR' });
      });

      // ── Ready ────────────────────────────────────────────────────────────
      this.client.on('ready', async () => {
        if (this._isReady) {
          console.log(
            '[WhatsApp INFO] [Ready Event]  Client re-connected (ignoring duplicate ready event).'
          );
          this.logger.info('CONNECTION', 'Duplicate ready event ignored');
          return;
        }
        this._isReady = true;

        console.log('[WhatsApp INFO] [Ready Event] ✅ Client ready.');
        console.log(
          `[WhatsApp INFO] [Ready Event]  Source mode: ${this.sourceMode.join(',').toUpperCase()}`
        );
        this.logger.info('CONNECTION', 'Client ready', { sourceMode: this.sourceMode });

        // Remove the QR file — no longer needed
        console.log(`[WhatsApp DEBUG] [Ready Event] Deleting QR file: qr-${this.sessionId}.txt`);
        this._deleteData(`qr-${this.sessionId}.txt`);

        // Check if this is a linker session (device pairing)
        const isLinker = this.sessionId.includes('_linker_');
        console.log(
          `[WhatsApp DEBUG] [Ready Event] Session ID: "${this.sessionId}", IsLinker: ${isLinker}`
        );

        if (isLinker) {
          console.log(
            '[WhatsApp INFO] [Ready Event]  [START]  [LINKER SEQUENCE] Starting instant linker sequence...'
          );

          // 1. Get phone number and WID immediately
          let phone = this.client.info?.wid?.user || '';
          if (!phone && this.client.info?.wid) {
            phone = this.client.info.wid._serialized?.split('@')[0] || '';
          }
          if (!phone && this.client.info) {
            phone = this.client.info.pushname || '';
          }
          const wid = this.client.info?.wid?._serialized || '';

          // Ensure phone is set, use fallback if not found
          let finalPhone = phone;
          if (!finalPhone && wid) {
            finalPhone = wid.split('@')[0];
          }
          if (!finalPhone) {
            finalPhone = `device_${Date.now()}`;
          }
          console.log(
            `[WhatsApp DEBUG] [Ready Event] [LINKER SEQUENCE] Phone: "${finalPhone}", WID: "${wid}"`
          );

          // Extract profile ID from session ID (session_{pId}_linker_{timestamp})
          const parts = this.sessionId.split('_');
          const pId = parts[1] || 'default';

          // 2. Shut down client gracefully to flush state and release all file locks
          console.log(
            '[WhatsApp INFO] [LINKER SEQUENCE] Closing WhatsApp client gracefully to release file locks...'
          );

          this.client
            .destroy()
            .then(() => {
              console.log(
                '[WhatsApp INFO] [LINKER SEQUENCE] WhatsApp client closed. Migrating session directory...'
              );

              const srcDir = path.join('.wwebjs_auth', `session-${this.sessionId}`);
              const dstDir = path.join('.wwebjs_auth', `session-session_${pId}_dev_${finalPhone}`);

              try {
                if (fs.existsSync(srcDir)) {
                  if (fs.existsSync(dstDir)) {
                    fs.rmSync(dstDir, { recursive: true, force: true });
                  }
                  fs.mkdirSync(path.dirname(dstDir), { recursive: true });
                  fs.renameSync(srcDir, dstDir);
                  console.log(
                    `[WhatsApp INFO] [LINKER SEQUENCE] Session directory successfully migrated to: ${dstDir}`
                  );
                } else {
                  console.warn(
                    `[WhatsApp WARN] [LINKER SEQUENCE] Source directory does not exist: ${srcDir}`
                  );
                }
              } catch (err) {
                console.error(
                  `[WhatsApp ERROR] [LINKER SEQUENCE] Failed to migrate session directory: ${err.message}`
                );
                // Fallback copy if rename fails
                try {
                  if (fs.existsSync(srcDir)) {
                    fs.cpSync(srcDir, dstDir, { recursive: true });
                    fs.rmSync(srcDir, { recursive: true, force: true });
                    console.log(
                      `[WhatsApp INFO] [LINKER SEQUENCE] Session directory copied to: ${dstDir}`
                    );
                  }
                } catch (copyErr) {
                  console.error(
                    `[WhatsApp ERROR] [LINKER SEQUENCE] Fallback migration failed: ${copyErr.message}`
                  );
                }
              }

              // 3. Write CONNECTED status file (only after successful migration!)
              console.log('[WhatsApp INFO] [LINKER SEQUENCE] Writing CONNECTED status file...');
              this._writeData(`status-${this.sessionId}.json`, {
                status: 'CONNECTED',
                phone: finalPhone,
                wid,
                channels: [],
                discoveryStatus: 'COMPLETED',
                discoveryProgress: 100,
                discoveryMessage: 'Scan confirmed. Device paired successfully.',
              });

              console.log(
                '[WhatsApp INFO] [LINKER SEQUENCE] Registered successfully. Exiting process.'
              );
              resolve();
              process.exit(0);
            })
            .catch((err) => {
              console.error(
                '[WhatsApp ERROR] [LINKER SEQUENCE] Error closing client:',
                err.message
              );
              process.exit(1);
            });

          return;
        }

        // ── Normal scanning daemon flow (non-linker) ───────────────────────
        console.log('[WhatsApp DEBUG] [Ready Event] Initializing Connection Manager...');
        this.connMgr = initConnectionManager(this.client, this.sessionId);

        // Get phone number with fallbacks
        let phone = '';
        try {
          phone = this.client.info?.wid?.user || '';
          if (!phone && this.client.info) {
            phone = this.client.info.pushname || '';
          }
          if (!phone && this.client.info?.wid) {
            phone = this.client.info.wid._serialized?.split('@')[0] || '';
          }
          if (!phone) {
            const meID = this.client.info?.wid?._serialized || '';
            const me = await this.client.getContactById(meID);
            if (me && me.id && me.id.user) {
              phone = me.id.user;
            }
          }
        } catch (err) {
          console.warn(
            '[WhatsApp WARN] [Ready Event]  [WARNING]  Could not retrieve phone number:',
            err.message
          );
        }

        const wid = this.client.info?.wid?._serialized || '';
        this._writeData(`status-${this.sessionId}.json`, {
          status: 'CONNECTED',
          phone,
          wid,
          channels: [],
          groups: [],
          chats: [],
          discoveryStatus: 'DISCOVERING',
          discoveryProgress: 0,
          discoveryMessage: 'Spawning background channel fetcher...',
        });

        console.log(
          `[WhatsApp INFO] [Ready Event] Connected with phone: ${phone || '(empty)'}, wid: ${wid || '(empty)'}. Resolving initialize and running channel fetcher in background...`
        );

        // Discover channels in the background asynchronously (non-blocking!)
        this._initChannelFetcher()
          .then((channels) => {
            console.log(
              `[WhatsApp INFO] [Background Fetch] Background discovery completed. Discovered ${channels.length} channels.`
            );
          })
          .catch((err) => {
            console.warn(
              '[WhatsApp WARN] [Background Fetch]  [WARNING]  Background channel fetch error:',
              err.message
            );
          });

        // Discover groups and chats asynchronously in parallel (non-blocking!)
        this._discoverGroupsAndChats().catch((err) => {
          console.warn('[WhatsApp WARN] Background groups/chats fetch error:', err.message);
        });

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
        console.warn('[WhatsApp]  [WARNING]    Disconnected:', reason);
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
        const isBotSent =
          msg.fromMe &&
          global.botSentMessageIds &&
          global.botSentMessageIds.has(msg.id?._serialized);
        if (!isBotSent) {
          this._handleMessage(msg);
        }
      });

      // ── Start initialization with comprehensive error handling ─────────
      this.logger.info('CONNECTION', 'Starting WhatsApp client initialization...');

      this.client
        .initialize()
        .then(() => {
          this.logger.info('CONNECTION', 'Client initialization promise resolved');
        })
        .catch((err) => {
          const errorMsg = err?.message || String(err);
          const errorStack = err?.stack || '';

          console.error('[WhatsApp] ❌  Client initialization failed:', errorMsg);
          this.logger.error('CONNECTION', 'Client initialization failed', {
            error: errorMsg,
            stack: errorStack,
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
    const client = connMgr ? connMgr.getClient() : this.client;

    if (!client) {
      throw new Error('[WhatsApp] Cannot send: client not available.');
    }

    const chatId = `${String(target).replace(/\D/g, '')}@c.us`;

    await withRetry(
      async () => {
        await client.sendMessage(chatId, message);
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
    if (!cb) {
      return;
    }
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
      console.log('[WhatsApp]  [STOP]   Client closed.');
    }
  }

  // ==========================================================================
  // Private — file helpers
  // =============================================d.m============================

  _writeData(filename, content) {
    try {
      if (!fs.existsSync('data')) {
        fs.mkdirSync('data', { recursive: true });
      }
      const str = typeof content === 'string' ? content : JSON.stringify(content);
      fs.writeFileSync(path.join('data', filename), str);
    } catch (err) {
      console.error(`[WhatsApp] Failed to write ${filename}: ${err.message}`);
    }
  }

  _deleteData(filename) {
    try {
      const p = path.join('data', filename);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch {
      /* non-fatal */
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = { WhatsAppListener, SOURCE_MODE };
