'use strict';

const EVENTS = require('../../config/constants/events');
const { metrics } = require('../../utils/metrics');

function initConnectionManager(broker, client) {
  let connectionState = 'initializing';
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  let healthCheckInterval = null;

  const setConnectionState = (state) => {
    connectionState = state;
    console.log(`[ConnectionMgr] State → ${state}`);
  };

  const attemptReconnect = async () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error('[ConnectionMgr] Max reconnection attempts reached. Manual intervention needed.');
      broker.emit(EVENTS.SYSTEM.ERROR, {
        source: 'ConnectionManager:maxAttemptsExceeded',
        message: `Failed to reconnect after ${maxReconnectAttempts} attempts. Session may be expired.`,
      });
      return;
    }

    reconnectAttempts++;
    const backoff = 1000 * Math.pow(2, reconnectAttempts - 1);

    console.log(`[ConnectionMgr] Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${backoff}ms...`);
    setConnectionState('reconnecting');

    await new Promise(r => setTimeout(r, backoff));

    try {
      await client.initialize();
      reconnectAttempts = 0;
      metrics.recordWhatsAppReconnect();
    } catch (err) {
      console.error(`[ConnectionMgr] Reconnection attempt ${reconnectAttempts} failed:`, err.message);
      attemptReconnect();
    }
  };

  const startHealthCheck = () => {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000');

    healthCheckInterval = setInterval(() => {
      if (connectionState === 'ready' && client) {
        try {
          if (!client.pupPage) {
            console.warn('[ConnectionMgr] Health check failed: stale connection detected');
            metrics.recordWhatsAppDisconnect();
            setConnectionState('disconnected');
            attemptReconnect();
          }
        } catch (err) {
          console.warn('[ConnectionMgr] Health check error:', err.message);
        }
      }
    }, interval);

    console.log(`[ConnectionMgr] Health check started (interval: ${interval}ms)`);
  };

  broker.on(EVENTS.WHATSAPP.READY, () => {
    setConnectionState('ready');
    reconnectAttempts = 0;

    if (!healthCheckInterval) {
      startHealthCheck();
    }
  });

  client.on('disconnected', (reason) => {
    setConnectionState('disconnected');
    metrics.recordWhatsAppDisconnect();

    console.warn(`[ConnectionMgr] Client disconnected: ${reason}`);
    attemptReconnect();
  });

  client.on('auth_failure', (msg) => {
    setConnectionState('auth_failure');
    console.error(`[ConnectionMgr] Auth failure: ${msg}. Session may be expired. Remove .wwebjs_auth/ and restart.`);
  });

  const cleanup = () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return { setConnectionState, getConnectionState: () => connectionState };
}

module.exports = { initConnectionManager };
