"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringWriter = void 0;
const stream_1 = require("stream");
class StringWriter extends stream_1.Writable {
    constructor(maxByteLength = 1 * 1024 * 1024) {
        super();
        this.maxByteLength = maxByteLength;
        this.byteLength = 0;
        this.bufs = [];
    }
    _write(chunk, _, callback) {
        if (!(chunk instanceof Buffer)) {
            callback(new Error("StringWriter: expects chunks of type 'Buffer'."));
            return;
        }
        if (this.byteLength + chunk.byteLength > this.maxByteLength) {
            callback(new Error(`StringWriter: Maximum bytes exceeded, maxByteLength=${this.maxByteLength}.`));
            return;
        }
        this.byteLength += chunk.byteLength;
        this.bufs.push(chunk);
        callback(null);
    }
    getText(encoding) {
        return Buffer.concat(this.bufs).toString(encoding);
    }
}
exports.StringWriter = StringWriter;
