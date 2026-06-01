'use strict';

const EventEmitter = require('events');
const EVENTS = require('../config/constants/events');

class NoriaBroker extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(30);
    this._bindSystemHandlers();
  }

  _bindSystemHandlers() {
    this.on(EVENTS.SYSTEM.ERROR, (payload) => {
      if (payload instanceof Error) {
        payload = {
          source: 'uncaught',
          message: payload.message,
          stack: payload.stack,
        };
      }

      const { source = 'unknown', url, message = 'No message provided.', stack } = payload ?? {};

      const bar = '═'.repeat(52);

      console.error(`\n╔${bar}╗`);
      console.error('║  SYSTEM ERROR                                   ║');
      console.error(`╠${bar}╣`);
      console.error(`║  Source  : ${source.padEnd(40)} ║`);

      if (url) {
        const truncated = url.length > 40 ? `${url.slice(0, 37)}...` : url;
        console.error(`║  URL     : ${truncated.padEnd(40)} ║`);
      }

      const words = message.split(' ');
      let line = '';
      const messageLines = [];
      for (const word of words) {
        if ((line + word).length > 40) {
          messageLines.push(line.trimEnd());
          line = '';
        }
        line += `${word} `;
      }
      if (line.trim()) {
        messageLines.push(line.trimEnd());
      }

      messageLines.forEach((ml, i) => {
        const label = i === 0 ? 'Message' : '       ';
        console.error(`║  ${label} : ${ml.padEnd(40)} ║`);
      });

      if (stack && process.env.NODE_ENV !== 'production') {
        console.error(`╠${bar}╣`);
        console.error('║  Stack (dev only):                                  ║');
        stack
          .split('\n')
          .slice(0, 6)
          .forEach((sl) => {
            const trimmed = sl.trim().slice(0, 50);
            console.error(`║    ${trimmed.padEnd(48)} ║`);
          });
      }

      console.error(`╚${bar}╝\n`);
    });

    this.on(EVENTS.SYSTEM.BOOTED, () => {
      const bar = '═'.repeat(52);
      console.log(`\n╔${bar}╗`);
      console.log('║                                                    ║');
      console.log('║   NORIA — Telemetry Pipeline                      ║');
      console.log('║        All services nominal.  Pipeline live.       ║');
      console.log('║                                                    ║');
      console.log(`╚${bar}╝\n`);
    });
  }
}

const broker = new NoriaBroker();
module.exports = broker;
