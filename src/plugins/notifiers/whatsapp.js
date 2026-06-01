'use strict';

const { BaseNotifier } = require('../base');
const { getConnectionManager } = require('../listeners/connection-manager');
const { metrics } = require('../../utils/metrics');
const { withRetry } = require('../../utils/retry');

class WhatsAppNotifier extends BaseNotifier {
  constructor(config = {}) {
    super(config);
    this.phoneNumber = config.phoneNumber;
  }

  async send(target, message) {
    const phoneNumber = target || this.phoneNumber;
    if (!phoneNumber) {
      throw new Error('WhatsAppNotifier: No phone number specified');
    }

    const connMgr = getConnectionManager();
    if (!connMgr) {
      throw new Error('WhatsAppNotifier: WhatsApp connection is not active');
    }

    const client = connMgr.getClient();
    if (!client) {
      throw new Error('WhatsAppNotifier: WhatsApp client is not active');
    }

    try {
      const chatId = `${String(phoneNumber).replace(/\D/g, '')}@c.us`;
      metrics.recordWhatsAppSend();

      await withRetry(
        async () => {
          await client.sendMessage(chatId, message);
        },
        {
          maxRetries: 2,
          baseDelayMs: 1000,
          onRetry: ({ attempt, delay }) => {
            console.warn(`[WhatsAppNotifier] Send retry ${attempt}/2 after ${delay}ms`);
            metrics.recordWhatsAppRetry();
          },
        }
      );

      console.log('[WhatsAppNotifier] Message successfully delivered');
    } catch (err) {
      metrics.recordWhatsAppFailure();
      console.error('[WhatsAppNotifier] Delivery failed:', err.message);
      throw err;
    }
  }
}

module.exports = { WhatsAppNotifier };
