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


// For more information on the WebP format, see https://developers.google.com/speed/webp/docs/riff_container
const { WebPReader, WebPWriter } = require('./parser.js');
const IO = require('./io.js');
const emptyImageBuffer = Buffer.from([
  0x52, 0x49, 0x46, 0x46,   0x24, 0x00, 0x00, 0x00,   0x57, 0x45, 0x42, 0x50,   0x56, 0x50, 0x38, 0x20,
  0x18, 0x00, 0x00, 0x00,   0x30, 0x01, 0x00, 0x9d,   0x01, 0x2a, 0x01, 0x00,   0x01, 0x00, 0x02, 0x00,
  0x34, 0x25, 0xa4, 0x00,   0x03, 0x70, 0x00, 0xfe,   0xfb, 0xfd, 0x50, 0x00
]);
const constants = {
  TYPE_LOSSY: 0,
  TYPE_LOSSLESS: 1,
  TYPE_EXTENDED: 2
};
const encodeResults = {
  // These are errors from binding.cpp
  LIB_NOT_READY: -1,                         // <interface>.initEnc() was not called. This happens internally during <interface>.encodeImage() and thus should never happen.
  LIB_INVALID_CONFIG: -2,                    // invalid options passed in via set[Image/Frame]Data. This should never happen.
  SUCCESS: 0,
  // These errors are from native code and can be found in upstream libwebp/src/encode.h, WebPEncodingError enum
  VP8_ENC_ERROR_OUT_OF_MEMORY: 1,            // memory error allocating objects
  VP8_ENC_ERROR_BITSTREAM_OUT_OF_MEMORY: 2,  // memory error while flushing bits
  VP8_ENC_ERROR_NULL_PARAMETER: 3,           // a pointer parameter is NULL
  VP8_ENC_ERROR_INVALID_CONFIGURATION: 4,    // configuration is invalid
  VP8_ENC_ERROR_BAD_DIMENSION: 5,            // picture has invalid width/height
  VP8_ENC_ERROR_PARTITION0_OVERFLOW: 6,      // partition is bigger than 512k
  VP8_ENC_ERROR_PARTITION_OVERFLOW: 7,       // partition is bigger than 16M
  VP8_ENC_ERROR_BAD_WRITE: 8,                // error while flushing bytes
  VP8_ENC_ERROR_FILE_TOO_BIG: 9,             // file is bigger than 4G
  VP8_ENC_ERROR_USER_ABORT: 10,              // abort request by user
  VP8_ENC_ERROR_LAST: 11                     // list terminator. always last.
};
const imageHints = {
  DEFAULT: 0,
  PICTURE: 1, // digital picture, such as a portrait. Indoors shot
  PHOTO: 2, // outdoor photograph with natural lighting
  GRAPH: 3 // discrete tone image (graph, map-tile, etc)
};
const imagePresets = {
  DEFAULT: 0,
  PICTURE: 1, // digital picture, such as a portrait. Indoors shot
  PHOTO: 2, // outdoor photograph with natural lighting
  DRAWING: 3, // hand or line drawing, with high-contrast details
  ICON: 4, // small-sized, colorful images
  TEXT: 5 // text-like
};

class Image {
  constructor() { this.data = null; this.loaded = false; this.path = ''; }
  async initLib() { return Image.initLib(); }
  clear() { this.data = null; this.path = ''; this.loaded = false; }
  // Convenience getters/setters
  get width() { let d = this.data; return !this.loaded ? undefined : d.extended ? d.extended.width : d.vp8l ? d.vp8l.width : d.vp8 ? d.vp8.width : undefined; }
  get height() { let d = this.data; return !this.loaded ? undefined : d.extended ? d.extended.height : d.vp8l ? d.vp8l.height : d.vp8 ? d.vp8.height : undefined; }
  get type() { return this.loaded ? this.data.type : undefined; }
  get hasAnim() { return this.loaded ? this.data.extended ? this.data.extended.hasAnim : false : false; }
  get hasAlpha() { return this.loaded ? this.data.extended ? this.data.extended.hasAlpha : this.data.vp8 ? this.data.vp8.alpha : this.data.vp8l ? this.data.vp8l.alpha : false : false; }
  get anim() { return this.hasAnim ? this.data.anim : undefined; }
  get frames() { return this.anim ? this.anim.frames : undefined; }
  get iccp() { return this.data.extended ? this.data.extended.hasICCP ? this.data.iccp.raw : undefined : undefined; }
  set iccp(raw) {
    if (!this.data.extended) { this._convertToExtended(); }
    if (raw === undefined) { this.data.extended.hasICCP = false; delete this.data.iccp; }
    else { this.data.iccp = { raw }; this.data.extended.hasICCP = true; }
  }
  get exif() { return this.data.extended ? this.data.extended.hasEXIF ? this.data.exif.raw : undefined : undefined; }
  set exif(raw) {
    if (!this.data.extended) { this._convertToExtended(); }
    if (raw === undefined) { this.data.extended.hasEXIF = false; delete this.data.exif; }
    else { this.data.exif = { raw }; this.data.extended.hasEXIF = true; }
  }
  get xmp() { return this.data.extended ? this.data.extended.hasXMP ? this.data.xmp.raw : undefined : undefined; }
  set xmp(raw) {
    if (!this.data.extended) { this._convertToExtended(); }
    if (raw === undefined) { this.data.extended.hasXMP = false; delete this.data.xmp; }
    else { this.data.xmp = { raw }; this.data.extended.hasXMP = true; }
  }
  // Private member functions
  _convertToExtended() {
    if (!this.loaded) { throw new Error('No image loaded'); }
    this.data.type = constants.TYPE_EXTENDED;
    this.data.extended = {
      hasICCP: false,
      hasAlpha: false,
      hasEXIF: false,
      hasXMP: false,
      width: this.data.vp8 ? this.data.vp8.width : this.data.vp8l ? this.data.vp8l.width : 1,
      height: this.data.vp8 ? this.data.vp8.height : this.data.vp8l ? this.data.vp8l.height : 1
    };
  }
  async _demuxFrame(d, frame) {
    let { hasICCP, hasEXIF, hasXMP } = this.data.extended ? this.data.extended : { hasICCP: false, hasEXIF: false, hasXMP: false }, hasAlpha = ((frame.vp8) && (frame.vp8.alpha)), writer = new WebPWriter();
    if (typeof d === 'string') { writer.writeFile(d); }
    else { writer.writeBuffer(); }
    writer.writeFileHeader();
    if ((hasICCP) || (hasEXIF) || (hasXMP) || (hasAlpha)) {
      writer.writeChunk_VP8X({
        hasICCP,
        hasEXIF,
        hasXMP,
        hasAlpha: ((frame.vp8l) && (frame.vp8l.alpha)) || hasAlpha,
        width: frame.width,
        height: frame.height
      });
    }
    if (frame.vp8l) { writer.writeChunk_VP8L(frame.vp8l); }
    else if (frame.vp8) {
      if (frame.vp8.alpha) { writer.writeChunk_ALPH(frame.alph); }
      writer.writeChunk_VP8(frame.vp8);
    } else { throw new Error('Frame has no VP8/VP8L?'); }
    if ((hasICCP) || (hasEXIF) || (hasXMP) || (hasAlpha)) {
      if (this.data.extended.hasICCP) { writer.writeChunk_ICCP(this.data.iccp); }
      if (this.data.extended.hasEXIF) { writer.writeChunk_EXIF(this.data.exif); }
      if (this.data.extended.hasXMP) { writer.writeChunk_XMP(this.data.xmp); }
    }
    return writer.commit();
  }
  async _save(writer, { width = undefined, height = undefined, frames = undefined, bgColor = [ 255, 255, 255, 255 ], loops = 0, delay = 100, x = 0, y = 0, blend = true, dispose = false, exif = false, iccp = false, xmp = false } = {}) {
    let _width = width !== undefined ? width : this.width - 1, _height = height !== undefined ? height : this.height - 1, isAnim = this.hasAnim || frames !== undefined;
    if ((_width < 0) || (_width > (1 << 24))) { throw new Error('Width out of range'); }
    else if ((_height < 0) || (_height > (1 << 24))) { throw new Error('Height out of range'); }
    else if ((_height * _width) > (Math.pow(2, 32) - 1)) { throw new Error(`Width * height too large (${_width}, ${_height})`); }
    if (isAnim) {
      if ((loops < 0) || (loops >= (1 << 24))) { throw new Error('Loops out of range'); }
      else if ((delay < 0) || (delay >= (1 << 24))) { throw new Error('Delay out of range'); }
      else if ((x < 0) || (x >= (1 << 24))) { throw new Error('X out of range'); }
      else if ((y < 0) || (y >= (1 << 24))) { throw new Error('Y out of range'); }
    } else { if ((_width == 0) || (_height == 0)) { throw new Error('Width/height cannot be 0'); } }
    writer.writeFileHeader();
    switch (this.type) {
      case constants.TYPE_LOSSY: writer.writeChunk_VP8(this.data.vp8); break;
      case constants.TYPE_LOSSLESS: writer.writeChunk_VP8L(this.data.vp8l); break;
      case constants.TYPE_EXTENDED:
        {
          let hasICCP = iccp === true ? !!this.iccp : iccp,
              hasEXIF = exif === true ? !!this.exif : exif,
              hasXMP = xmp === true ? !!this.xmp : xmp;
          writer.writeChunk_VP8X({
            hasICCP, hasEXIF, hasXMP,
            hasAlpha: ((this.data.alph) || ((this.data.vp8l) && (this.data.vp8l.alpha))),
            hasAnim: isAnim,
            width: _width,
            height: _height
          });
          if (hasICCP) { writer.writeChunk_ICCP(iccp !== true ? iccp : this.data.iccp); }
          if (isAnim) {
            let _frames = frames || this.frames;
            writer.writeChunk_ANIM({ bgColor, loops });
            for (let i = 0, l = _frames.length; i < l; i++) {
              let fr = _frames[i],
                  _delay = fr.delay == undefined ? delay : fr.delay,
                  _x = fr.x == undefined ? x :fr.x,
                  _y = fr.y == undefined ? y : fr.y,
                  _blend = fr.blend == undefined ? blend : fr.blend,
                  _dispose = fr.dispose == undefined ? dispose : fr.dispose, img;
              if ((_delay < 0) || (_delay >= (1 << 24))) { throw new Error(`Delay out of range on frame ${i}`); }
              else if ((_x < 0) || (_x >= (1 << 24))) { throw new Error(`X out of range on frame ${i}`); }
              else if ((_y < 0) || (_y >= (1 << 24))) { throw new Error(`Y out of range on frame ${i}`); }
              if (fr.path) { img = new Image(); await img.load(fr.path); img = img.data; }
              else if (fr.buffer) { img = new Image(); await img.load(fr.buffer); img = img.data; }
              else if (fr.img) { img = fr.img.data; }
              else { img = fr; }
              writer.writeChunk_ANMF({
                x: _x,
                y: _y,
                delay: _delay,
                blend: _blend,
                dispose: _dispose,
                img
              });
            }
            if ((_width == 0) || (_height == 0)) { writer.updateChunk_VP8X_size(_width == 0 ? writer.width : _width, _height == 0 ? writer.height : _height); }
          } else {
            if (this.data.vp8) {
              if (this.data.alph) { writer.writeChunk_ALPH(this.data.alph); }
              writer.writeChunk_VP8(this.data.vp8);
            } else if (this.data.vp8l) { writer.writeChunk_VP8L(this.data.vp8l); }
          }
          if (hasEXIF) { writer.writeChunk_EXIF(exif !== true ? exif : this.data.exif); }
          if (hasXMP) { writer.writeChunk_XMP(xmp !== true ? xmp : this.data.xmp); }
        }
        break;
      default: throw new Error('Unknown image type');
    }
    return writer.commit();
  }
  // Public member functions
  async load(d) {
    let reader = new WebPReader();
    if (typeof d === 'string') { if (!IO.avail) { await IO.err(); } reader.readFile(d); this.path = d; }
    else { reader.readBuffer(d); }
    this.data = await reader.read();
    this.loaded = true;
  }
  convertToAnim() {
    if (!this.data.extended) { this._convertToExtended(); }
    if (this.hasAnim) { return; }
    if (this.data.vp8) { delete this.data.vp8; }
    if (this.data.vp8l) { delete this.data.vp8l; }
    if (this.data.alph) { delete this.data.alph; }
    this.data.extended.hasAnim = true;
    this.data.anim = {
      bgColor: [ 255, 255, 255, 255],
      loops: 0,
      frames: []
    };
  }
  async demux({ path = undefined, buffers = false, frame = -1, prefix = '#FNAME#', start = 0, end = 0 } = {}) {
    if (!this.hasAnim) { throw new Error("This image isn't an animation"); }
    let _end = end == 0 ? this.frames.length : end, bufs = [];
    if (start < 0) { start = 0; }
    if (_end >= this.frames.length) { _end = this.frames.length - 1; }
    if (start > _end) { let n = start; start = _end; _end = n; }
    if (frame != -1) { start = _end = frame; }
    for (let i = start; i <= _end; i++) {
      let t = await this._demuxFrame(path ? (`${path}/${prefix}_${i}.webp`).replace(/#FNAME#/g, IO.basename(this.path, '.webp')) : undefined, this.anim.frames[i]);
      if (buffers) { bufs.push(t); }
    }
    if (buffers) { return bufs; }
  }
  async replaceFrame(frameIndex, d) {
    if (!this.hasAnim) { throw new Error("WebP isn't animated"); }
    if (typeof frameIndex !== 'number') { throw new Error('Frame index expects a number'); }
    if ((frameIndex < 0) || (frameIndex >= this.frames.length)) { throw new Error(`Frame index out of bounds (0 <= index < ${this.frames.length})`); }
    let r = new Image(), fr = this.frames[frameIndex];
    await r.load(d);
    switch (r.type) {
      case constants.TYPE_LOSSY:
      case constants.TYPE_LOSSLESS:
        break;
      case constants.TYPE_EXTENDED:
        if (r.hasAnim) { throw new Error('Merging animations not currently supported'); }
        break;
      default: throw new Error('Unknown WebP type');
    }
    switch (fr.type) {
      case constants.TYPE_LOSSY:
        if (fr.vp8.alpha) { delete fr.alph; }
        delete fr.vp8;
        break;
      case constants.TYPE_LOSSLESS:
        delete fr.vp8l;
        break;
      default: throw new Error('Unknown frame type');
    }
    switch (r.type) {
      case constants.TYPE_LOSSY:
        fr.vp8 = r.data.vp8;
        fr.type = constants.TYPE_LOSSY;
        break;
      case constants.TYPE_LOSSLESS:
        fr.vp8l = r.data.vp8l;
        fr.type = constants.TYPE_LOSSLESS;
        break;
      case constants.TYPE_EXTENDED:
        if (r.data.vp8) {
          fr.vp8 = r.data.vp8;
          if (r.data.vp8.alpha) { fr.alph = r.data.alph; }
          fr.type = constants.TYPE_LOSSY;
        } else if (r.data.vp8l) { fr.vp8l = r.data.vp8l; fr.type = constants.TYPE_LOSSLESS; }
        break;
    }
    fr.width = r.width;
    fr.height = r.height;
  }
  async save(path = this.path, { width = this.width, height = this.height, frames = this.frames, bgColor = this.hasAnim ? this.anim.bgColor : [ 255, 255, 255, 255 ], loops = this.hasAnim ? this.anim.loops : 0, delay = 100, x = 0, y = 0, blend = true, dispose = false, exif = !!this.exif, iccp = !!this.iccp, xmp = !!this.xmp } = {}) {
    let writer = new WebPWriter();
    if (path !== null) { if (!IO.avail) { await IO.err(); } writer.writeFile(path); }
    else { writer.writeBuffer(); }
    return this._save(writer, { width, height, frames, bgColor, loops, delay, x, y, blend, dispose, exif, iccp, xmp });
  }
  async getImageData() {
    if (!Image.libwebp) { throw new Error('Must call Image.initLib() before using getImageData'); }
    if (this.hasAnim) { throw new Error('Calling getImageData on animations is not supported'); }
    let buf = await this.save(null);
    return Image.libwebp.decodeImage(buf, this.width, this.height);
  }
  async setImageData(buf, { width = 0, height = 0, preset = undefined, quality = undefined, exact = undefined, lossless = undefined, method = undefined, advanced = undefined } = {}) {
    if (!Image.libwebp) { throw new Error('Must call Image.initLib() before using setImageData'); }
    if (this.hasAnim) { throw new Error('Calling setImageData on animations is not supported'); }
    if ((quality !== undefined) && ((quality < 0) || (quality > 100))) { throw new Error('Quality out of range'); }
    if ((lossless !== undefined) && ((lossless < 0) || (lossless > 9))) { throw new Error('Lossless preset out of range'); }
    if ((method !== undefined) && ((method < 0) || (method > 6))) { throw new Error('Method out of range'); }
    let ret = Image.libwebp.encodeImage(buf, width > 0 ? width : this.width, height > 0 ? height : this.height, { preset, quality, exact, lossless, method, advanced }), img = new Image(), keepEx = false, ex;
    if (ret.res !== encodeResults.SUCCESS) { return ret.res; }
    await img.load(Buffer.from(ret.buf));
    switch (this.type) {
      case constants.TYPE_LOSSY: delete this.data.vp8; break;
      case constants.TYPE_LOSSLESS: delete this.data.vp8l; break;
      case constants.TYPE_EXTENDED:
        ex = this.data.extended;
        delete this.data.extended;
        if ((ex.hasICCP) || (ex.hasEXIF) || (ex.hasXMP)) { keepEx = true; }
        if (this.data.vp8) { delete this.data.vp8; }
        if (this.data.vp8l) { delete this.data.vp8l; }
        if (this.data.alph) { delete this.data.alph; }
        break;
    }
    switch (img.type) {
      case constants.TYPE_LOSSY:
        if (keepEx) { this.data.type = constants.TYPE_EXTENDED; ex.hasAlpha = false; ex.width = img.width; ex.height = img.height; this.data.extended = ex; }
        else { this.data.type = constants.TYPE_LOSSY; }
        this.data.vp8 = img.data.vp8;
        break;
      case constants.TYPE_LOSSLESS:
        if (keepEx) { this.data.type = constants.TYPE_EXTENDED; ex.hasAlpha = img.data.vp8l.alpha; ex.width = img.width; ex.height = img.height; this.data.extended = ex; }
        else { this.data.type = constants.TYPE_LOSSLESS; }
        this.data.vp8l = img.data.vp8l;
        break;
      case constants.TYPE_EXTENDED:
        this.data.type = constants.TYPE_EXTENDED;
        if (keepEx) { ex.hasAlpha = img.data.alph || ((img.data.vp8l) && (img.data.vp8l.alpha)); ex.width = img.width; ex.height = img.height; this.data.extended = ex; }
        else { this.data.extended = img.data.extended; }
        if (img.data.vp8) { this.data.vp8 = img.data.vp8; }
        if (img.data.vp8l) { this.data.vp8l = img.data.vp8l; }
        if (img.data.alph) { this.data.alph = img.data.alph; }
        break;
    }
    return encodeResults.SUCCESS;
  }
  async getFrameData(frameIndex) {
    if (!Image.libwebp) { throw new Error('Must call Image.initLib() before using getFrameData'); }
    if (!this.hasAnim) { throw new Error('Calling getFrameData on non-animations is not supported'); }
    if (typeof frameIndex !== 'number') { throw new Error('Frame index expects a number'); }
    if ((frameIndex < 0) || (frameIndex >= this.frames.length)) { throw new Error('Frame index out of range'); }
    let fr = this.frames[frameIndex], buf = await this._demuxFrame(null, fr);
    return Image.libwebp.decodeImage(buf, fr.width, fr.height);
  }
  async setFrameData(frameIndex, buf, { width = 0, height = 0, preset = undefined, quality = undefined, exact = undefined, lossless = undefined, method = undefined, advanced = undefined } = {}) {
    if (!Image.libwebp) { throw new Error('Must call Image.initLib() before using setFrameData'); }
    if (!this.hasAnim) { throw new Error('Calling setFrameData on non-animations is not supported'); }
    if (typeof frameIndex !== 'number') { throw new Error('Frame index expects a number'); }
    if ((frameIndex < 0) || (frameIndex >= this.frames.length)) { throw new Error('Frame index out of range'); }
    if ((quality !== undefined) && ((quality < 0) || (quality > 100))) { throw new Error('Quality out of range'); }
    if ((lossless !== undefined) && ((lossless < 0) || (lossless > 9))) { throw new Error('Lossless preset out of range'); }
    if ((method !== undefined) && ((method < 0) || (method > 6))) { throw new Error('Method out of range'); }
    let fr = this.frames[frameIndex], ret = Image.libwebp.encodeImage(buf, width > 0 ? width : fr.width, height > 0 ? height : fr.height, { preset, quality, exact, lossless, method, advanced }), img = new Image();
    if (ret.res !== encodeResults.SUCCESS) { return ret.res; }
    await img.load(Buffer.from(ret.buf));
    switch (fr.type) {
      case constants.TYPE_LOSSY: delete fr.vp8; if (fr.alph) { delete fr.alph; } break;
      case constants.TYPE_LOSSLESS: delete fr.vp8l; break;
    }
    fr.width = img.width;
    fr.height = img.height;
    switch (img.type) {
      case constants.TYPE_LOSSY: fr.type = img.type; fr.vp8 = img.data.vp8; break;
      case constants.TYPE_LOSSLESS: fr.type = img.type; fr.vp8l = img.data.vp8l; break;
      case constants.TYPE_EXTENDED:
        if (img.data.vp8) {
          fr.type = constants.TYPE_LOSSY;
          fr.vp8 = img.data.vp8;
          if (img.data.vp8.alpha) { fr.alph = img.data.alph; }
        } else if (img.data.vp8l) {
          fr.type = constants.TYPE_LOSSLESS;
          fr.vp8l = img.data.vp8l;
        }
        break;
    }
    return encodeResults.SUCCESS;
  }
  // Public static functions
  static async initLib() {
    if (!Image.libwebp) {
      const libWebP = require('./libwebp.js');
      Image.libwebp = new libWebP();
      await Image.libwebp.init();
    }
  }
  static async save(d, opts) {
    if ((opts.frames) && ((opts.width === undefined) || (opts.height === undefined))) { throw new Error('Must provide both width and height when passing frames'); }
    return (await Image.getEmptyImage(!!opts.frames)).save(d, opts);
  }
  static async getEmptyImage(ext) {
    let img = new Image();
    await img.load(emptyImageBuffer);
    if (ext) { img.exif = undefined; }
    return img;
  }
  static async generateFrame({ path = undefined, buffer = undefined, img = undefined, x = undefined, y = undefined, delay = undefined, blend = undefined, dispose = undefined } = {}) {
    let _img = img;
    if (((!path) && (!buffer) && (!img)) ||
        ((path) && (buffer) && (img))) { throw new Error('Must provide either `path`, `buffer`, or `img`'); }
    if (!img) {
      _img = new Image();
      if (path) { await _img.load(path); }
      else { await _img.load(buffer); }
    }
    if (_img.hasAnim) { throw new Error('Merging animations is not currently supported'); }
    return {
      img: _img,
      x,
      y,
      delay,
      blend,
      dispose
    };
  }
  static from(webp) {
    let img = new Image();
    img.data = webp.data;
    img.loaded = webp.loaded;
    img.path = webp.path;
    return img;
  }
}
module.exports = {
  TYPE_LOSSY: constants.TYPE_LOSSY,
  TYPE_LOSSLESS: constants.TYPE_LOSSLESS,
  TYPE_EXTENDED: constants.TYPE_EXTENDED,
  encodeResults,
  hints: imageHints,
  presets: imagePresets,
  Image
};

