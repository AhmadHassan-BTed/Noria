'use strict';

class ConnectionManager {
  constructor(client) {
    this.client = client;
    this.isAlive = true;
    this.startHealthCheck();
  }

  startHealthCheck() {
    this.interval = setInterval(async () => {
      try {
        const state = await this.client.getState();
        this.isAlive = state === 'CONNECTED';
      } catch (err) {
        this.isAlive = false;
        console.error('[ConnectionManager] Health check failed:', err.message);
      }
    }, 60000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  getClient() {
    return this.client;
  }
}

let instance = null;

function initConnectionManager(client) {
  instance = new ConnectionManager(client);
  return instance;
}

function getConnectionManager() {
  return instance;
}

module.exports = { initConnectionManager, getConnectionManager };
