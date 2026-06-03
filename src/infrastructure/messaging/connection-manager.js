'use strict';

class ConnectionManager {
  constructor() {
    this.sessions = new Map();
  }

  startHealthCheck(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.interval = setInterval(async () => {
      try {
        const state = await session.client.getState();
        session.isAlive = state === 'CONNECTED';
      } catch (err) {
        session.isAlive = false;
        console.error(
          `[ConnectionManager] Health check failed for session ${sessionId}:`,
          err.message
        );
      }
    }, 60000);
  }

  stopSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.interval) {
        clearInterval(session.interval);
      }
      this.sessions.delete(sessionId);
    }
  }

  stop() {
    for (const sessionId of this.sessions.keys()) {
      this.stopSession(sessionId);
    }
  }

  registerClient(sessionId, client) {
    this.stopSession(sessionId);

    this.sessions.set(sessionId, {
      client,
      isAlive: true,
      interval: null,
    });

    this.startHealthCheck(sessionId);
  }

  getClient(sessionId = 'default') {
    return this.sessions.get(sessionId)?.client || null;
  }

  isAlive(sessionId = 'default') {
    return this.sessions.get(sessionId)?.isAlive || false;
  }
}

const instance = new ConnectionManager();

function initConnectionManager(client, sessionId = 'default') {
  instance.registerClient(sessionId, client);
  return instance;
}

function getConnectionManager() {
  return instance;
}

module.exports = { initConnectionManager, getConnectionManager, ConnectionManager };
