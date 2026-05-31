/*
    node-webpmux - NodeJS module for interacting with WebP images
    Copyright (C) 2023  ApeironTsuka

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.
*/


const IO = require('./io.js');
const nullByte = Buffer.alloc(1);
nullByte[0] = 0;
const intfTypes = {
  NONE: 0,
  FILE: 1,
  BUFFER: 2
};
const constants = {
  TYPE_LOSSY: 0,
  TYPE_LOSSLESS: 1,
  TYPE_EXTENDED: 2
};
function VP8Width(data) { return ((data[7] << 8) | data[6]) & 0b0011111111111111; }
function VP8Height(data) { return ((data[9] << 8) | data[8]) & 0b0011111111111111; }
function VP8LWidth(data) { return (((data[2] << 8) | data[1]) & 0b0011111111111111) + 1; }
function VP8LHeight(data) { return ((((data[4] << 16) | (data[3] << 8) | data[2]) >> 6) & 0b0011111111111111) + 1; }
function doesVP8LHaveAlpha(data) { return !!(data[4] & 0b00010000); }
function createBasicChunk(name, data) {
  let header = Buffer.alloc(8), size = data.length;
  header.write(name, 0);
  header.writeUInt32LE(size, 4);
  if (size&1) { return { size: size + 9, chunks: [ header, data, nullByte ] }; }
  else { return { size: size + 8, chunks: [ header, data ] }; }
}
class WebPReader {
  constructor() { this.type = intfTypes.NONE; }
  readFile(path) { this.type = intfTypes.FILE; this.path = path; }
  readBuffer(buf) { this.type = intfTypes.BUFFER; this.buf = buf; this.cursor = 0; }
  async readBytes(n, mod) {
    let { type } = this;
    if (type == intfTypes.FILE) {
      let b = Buffer.alloc(n), br;
      br = (await IO.read(this.fp, b, 0, n, undefined)).bytesRead;
      return mod ? b : br == n ? b : undefined;
    } else if (type == intfTypes.BUFFER) { let b = this.buf.slice(this.cursor, this.cursor + n); this.cursor += n; return b; }
    else { throw new Error('Reader not initialized'); }
  }
  async readFileHeader() {
    let buf = await this.readBytes(12);
    if (buf === undefined) { throw new Error('Reached end while reading header'); }
    if (buf.toString('utf8', 0, 4) != 'RIFF') { throw new Error('Bad header (not RIFF)'); }
    if (buf.toString('utf8', 8, 12) != 'WEBP') { throw new Error('Bad header (not WEBP)'); }
    return { fileSize: buf.readUInt32LE(4) };
  }
  async readChunkHeader() {
    let buf = await this.readBytes(8, true);
    if (buf.length == 0) { return { fourCC: '\x00\x00\x00\x00', size: 0 }; }
    else if (buf.length < 8) { throw new Error('Reached end while reading chunk header'); }
    return { fourCC: buf.toString('utf8', 0, 4), size: buf.readUInt32LE(4) };
  }
  async readChunkContents(size) {
    let buf = await this.readBytes(size);
    if (size & 1) { await this.readBytes(1); }
    return buf;
  }
  async readChunk_raw(n, size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error(`Reached end while reading ${n} chunk`); }
    return { raw: buf };
  }
  async readChunk_VP8(size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error('Reached end while reading VP8 chunk'); }
    return { raw: buf, width: VP8Width(buf), height: VP8Height(buf) };
  }
  async readChunk_VP8L(size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error('Reached end while reading VP8L chunk'); }
    return { raw: buf, alpha: doesVP8LHaveAlpha(buf), width: VP8LWidth(buf), height: VP8LHeight(buf) };
  }
  async readChunk_VP8X(size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error('Reached end while reading VP8X chunk'); }
    return {
      raw: buf,
      hasICCP:  !!(buf[0] & 0b00100000),
      hasAlpha: !!(buf[0] & 0b00010000),
      hasEXIF:  !!(buf[0] & 0b00001000),
      hasXMP:   !!(buf[0] & 0b00000100),
      hasAnim:  !!(buf[0] & 0b00000010),
      width: buf.readUIntLE(4, 3) + 1,
      height: buf.readUIntLE(7, 3) + 1
    };
  }
  async readChunk_ANIM(size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error('Reached end while reading ANIM chunk'); }
    return { raw: buf, bgColor: buf.slice(0, 4), loops: buf.readUInt16LE(4) };
  }
  async readChunk_ANMF(size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error('Reached end while reading ANMF chunk'); }
    let out = {
      raw: buf,
      x: buf.readUIntLE(0, 3),
      y: buf.readUIntLE(3, 3),
      width: buf.readUIntLE(6, 3) + 1,
      height: buf.readUIntLE(9, 3) + 1,
      delay: buf.readUIntLE(12, 3),
      blend: !(buf[15] & 0b00000010),
      dispose: !!(buf[15] & 0b00000001)
    }, keepLooping = true, anmfReader = new WebPReader();
    anmfReader.readBuffer(buf);
    anmfReader.cursor = 16;
    while (keepLooping) {
      let header = await anmfReader.readChunkHeader();
      switch (header.fourCC) {
        case 'VP8 ':
          if (!out.vp8) {
            out.type = constants.TYPE_LOSSY;
            out.vp8 = await anmfReader.readChunk_VP8(header.size);
            if (out.alph) { out.vp8.alpha = true; }
          }
          break;
        case 'VP8L':
          if (!out.vp8l) {
            out.type = constants.TYPE_LOSSLESS;
            out.vp8l = await anmfReader.readChunk_VP8L(header.size);
          }
          break;
        case 'ALPH':
          if (!out.alph) {
            out.alph = await anmfReader.readChunk_ALPH(header.size);
            if (out.vp8) { out.vp8.alpha = true; }
          }
          break;
        case '\x00\x00\x00\x00':
        default:
          keepLooping = false;
          break;
      }
      if (anmfReader.cursor >= buf.length) { break; }
    }
    return out;
  }
  async readChunk_ALPH(size) { return this.readChunk_raw('ALPH', size); }
  async readChunk_ICCP(size) { return this.readChunk_raw('ICCP', size); }
  async readChunk_EXIF(size) { return this.readChunk_raw('EXIF', size); }
  async readChunk_XMP(size) { return this.readChunk_raw('XMP ', size); }
  async readChunk_skip(size) {
    let buf = await this.readChunkContents(size);
    if (buf === undefined) { throw new Error('Reached end while skipping chunk'); }
  }
  async read() {
    if (this.type == intfTypes.FILE) { this.fp = await IO.open(this.path, 'r'); }
    let keepLooping = true, first = true, { fileSize } = await this.readFileHeader(), out = {};
    while (keepLooping) {
      let { fourCC, size } = await this.readChunkHeader();
      switch (fourCC) {
        case 'VP8 ':
          if (!out.vp8) {
            out.vp8 = await this.readChunk_VP8(size);
            if (out.alph) { out.vp8.alpha = true; }
            if (first) { out.type = constants.TYPE_LOSSY; keepLooping = false; }
          } else { await this.readChunk_skip(size); }
          break;
        case 'VP8L':
          if (!out.vp8l) {
            out.vp8l = await this.readChunk_VP8L(size);
            if (first) { out.type = constants.TYPE_LOSSLESS; keepLooping = false; }
          } else { await this.readChunk_skip(size); }
          break;
        case 'VP8X':
          if (!out.extended) {
            out.type = constants.TYPE_EXTENDED;
            out.extended = await this.readChunk_VP8X(size);
          } else { await this.readChunk_skip(size); }
          break;
        case 'ANIM':
          if (!out.anim) {
            let { raw, bgColor, loops } = await this.readChunk_ANIM(size);
            out.anim = {
              bgColor: [ bgColor[2], bgColor[1], bgColor[0], bgColor[3] ],
              loops,
              frames: [],
              raw
            };
          } else { await this.readChunk_skip(size); }
          break;
        case 'ANMF': out.anim.frames.push(await this.readChunk_ANMF(size)); break;
        case 'ALPH':
          if (!out.alph) {
            out.alph = await this.readChunk_ALPH(size);
            if (out.vp8) { out.vp8.alpha = true; }
          } else { await this.readChunk_skip(size); }
          break;
        case 'ICCP':
          if (!out.iccp) { out.iccp = await this.readChunk_ICCP(size); }
          else { await this.readChunk_skip(size); }
          break;
        case 'EXIF':
          if (!out.exif) { out.exif = await this.readChunk_EXIF(size); }
          else { await this.readChunk_skip(size); }
          break;
        case 'XMP ':
          if (!out.xmp) { out.xmp = await this.readChunk_XMP(size); }
          else { await this.readChunk_skip(size); }
          break;
        case '\x00\x00\x00\x00': keepLooping = false; break;
        default: await this.readChunk_skip(size); break;
      }
      first = false;
    }
    if (this.type == intfTypes.FILE) { await IO.close(this.fp); }
    return out;
  }
}
class WebPWriter {
  constructor() { this.type = intfTypes.NONE; this.chunks = []; this.width = this.height = 0; }
  reset() { this.chunks.length = 0; width = 0; height = 0; }
  writeFile(path) { this.type = intfTypes.FILE; this.path = path; }
  writeBuffer() { this.type = intfTypes.BUFFER; }
  async commit() {
    let { chunks } = this, size = 4, fp;
    if (this.type == intfTypes.NONE) { throw new Error('Writer not initialized'); }
    if (chunks.length == 0) { throw new Error('Nothing to write'); }
    for (let i = 1, l = chunks.length; i < l; i++) { size += chunks[i].length; }
    chunks[0].writeUInt32LE(size, 4);
    if (this.type == intfTypes.FILE) {
      fp = await IO.open(this.path, 'w');
      for (let i = 0, l = chunks.length; i < l; i++) { await IO.write(fp, chunks[i], 0, undefined, undefined); }
      await IO.close(fp);
    } else { return Buffer.concat(chunks); }
  }
  writeBytes(...chunks) {
    if (this.type == intfTypes.NONE) { throw new Error('Writer not initialized'); }
    this.chunks.push(...chunks);
  }
  writeFileHeader() {
    let buf = Buffer.alloc(12);
    buf.write('RIFF', 0);
    buf.write('WEBP', 8);
    this.writeBytes(buf);
  }
  writeChunk_VP8(vp8) { this.writeBytes(...((createBasicChunk('VP8 ', vp8.raw)).chunks)); }
  writeChunk_VP8L(vp8l) { this.writeBytes(...((createBasicChunk('VP8L', vp8l.raw)).chunks)); }
  writeChunk_VP8X(vp8x) {
    let buf = Buffer.alloc(18);
    buf.write('VP8X', 0);
    buf.writeUInt32LE(10, 4);
    buf.writeUIntLE(vp8x.width - 1, 12, 3);
    buf.writeUIntLE(vp8x.height - 1, 15, 3);
    if (vp8x.hasICCP)  { buf[8] |= 0b00100000; }
    if (vp8x.hasAlpha) { buf[8] |= 0b00010000; }
    if (vp8x.hasEXIF)  { buf[8] |= 0b00001000; }
    if (vp8x.hasXMP)   { buf[8] |= 0b00000100; }
    if (vp8x.hasAnim)  { buf[8] |= 0b00000010; }
    this.vp8x = buf;
    this.writeBytes(buf);
  }
  updateChunk_VP8X_size(width, height) {
    this.vp8x.writeUIntLE(width, 12, 3);
    this.vp8x.writeUIntLE(height, 15, 3);
  }
  writeChunk_ANIM(anim) {
    let buf = Buffer.alloc(14);
    buf.write('ANIM', 0);
    buf.writeUInt32LE(6, 4);
    buf.writeUInt8(anim.bgColor[2], 8);
    buf.writeUInt8(anim.bgColor[1], 9);
    buf.writeUInt8(anim.bgColor[0], 10);
    buf.writeUInt8(anim.bgColor[3], 11);
    buf.writeUInt16LE(anim.loops, 12);
    this.writeBytes(buf);
  }
  writeChunk_ANMF(anmf) {
    let buf = Buffer.alloc(24), { img } = anmf, size = 16, alpha = false;
    buf.write('ANMF', 0);
    buf.writeUIntLE(anmf.x, 8, 3);
    buf.writeUIntLE(anmf.y, 11, 3);
    buf.writeUIntLE(anmf.delay, 20, 3);
    if (!anmf.blend) { buf[23] |= 0b00000010; }
    if (anmf.dispose) { buf[23] |= 0b00000001; }
    switch (img.type) {
      case constants.TYPE_LOSSY:
        {
          let b;
          this.width = Math.max(this.width, img.vp8.width);
          this.height = Math.max(this.height, img.vp8.height);
          buf.writeUIntLE(img.vp8.width - 1, 14, 3);
          buf.writeUIntLE(img.vp8.height - 1, 17, 3);
          this.writeBytes(buf);
          if (img.vp8.alpha) {
            b = createBasicChunk('ALPH', img.alph.raw);
            this.writeBytes(...b.chunks);
            size += b.size;
          }
          b = createBasicChunk('VP8 ', img.vp8.raw);
          this.writeBytes(...b.chunks);
          size += b.size;
        }
        break;
      case constants.TYPE_LOSSLESS:
        {
          let b = createBasicChunk('VP8L', img.vp8l.raw);
          this.width = Math.max(this.width, img.vp8l.width);
          this.height = Math.max(this.height, img.vp8l.height);
          buf.writeUIntLE(img.vp8l.width - 1, 14, 3);
          buf.writeUIntLE(img.vp8l.height - 1, 17, 3);
          if (img.vp8l.alpha) { alpha = true; }
          this.writeBytes(buf, ...b.chunks);
          size += b.size;
        }
        break;
      case constants.TYPE_EXTENDED:
        if (img.extended.hasAnim) {
          let fr = img.anim.frames;
          if (img.extended.hasAlpha) { alpha = true; }
          for (let i = 0, l = fr.length; i < l; i++) {
            let b = Buffer.alloc(8), c = fr[i].raw;
            this.width = Math.max(this.width, fr[i].width + anmf.x);
            this.height = Math.max(this.height, fr[i].height + anmf.y);
            b.write('ANMF', 0);
            b.writeUInt32LE(c.length, 4);
            c.writeUIntLE(anmf.x, 0, 3);
            c.writeUIntLE(anmf.y, 3, 3);
            c.writeUIntLE(anmf.delay, 12, 3);
            if (!anmf.blend) { c[15] |= 0b00000010; } else { c[15] &= 0b11111101; }
            if (anmf.dispose) { c[15] |= 0b00000001; } else { c[15] &= 0b11111110; }
            this.writeBytes(b, c);
            if (c.length & 1) { this.writeBytes(nullByte); }
          }
        } else {
          let b;
          this.width = Math.max(this.width, img.extended.width);
          this.height = Math.max(this.height, img.extended.height);
          if (img.vp8) {
            buf.writeUIntLE(img.vp8.width - 1, 14, 3);
            buf.writeUIntLE(img.vp8.height - 1, 17, 3);
            this.writeBytes(buf);
            if (img.alph) {
              b = createBasicChunk('ALPH', img.alph.raw);
              alpha = true;
              this.writeBytes(...b.chunks);
              size += b.size;
            }
            b = createBasicChunk('VP8 ', img.vp8.raw);
            this.writeBytes(...b.chunks);
            size += b.size;
          } else if (img.vp8l) {
            buf.writeUIntLE(img.vp8l.width - 1, 14, 3);
            buf.writeUIntLE(img.vp8l.height - 1, 17, 3);
            if (img.vp8l.alpha) { alpha = true; }
            b = createBasicChunk('VP8L', img.vp8l.raw);
            this.writeBytes(buf, ...b.chunks);
            size += b.size;
          }
        }
        break;
      default: throw new Error('Unknown image type');
    }
    buf.writeUInt32LE(size, 4);
    if (alpha) { this.vp8x[8] |= 0b00010000; }
  }
  writeChunk_ALPH(alph) { this.writeBytes(...((createBasicChunk('ALPH', alph.raw)).chunks)); }
  writeChunk_ICCP(iccp) { this.writeBytes(...((createBasicChunk('ICCP', iccp.raw)).chunks)); }
  writeChunk_EXIF(exif) { this.writeBytes(...((createBasicChunk('EXIF', exif.raw)).chunks)); }
  writeChunk_XMP(xmp) { this.writeBytes(...((createBasicChunk('XMP ', xmp.raw)).chunks)); }
}
module.exports = { WebPReader, WebPWriter };
