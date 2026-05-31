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


const libwebpF = require('./libwebp/libwebp.js');
const ranges = {
    preset: { n: 0, m: 5 },
    lossless: { n: 0, m: 9 },
    quality: { n: 0, m: 100 },
    method: { n: 0, m: 6 },
    exact: { n: 0, m: 1 }
  }, advranges = {
  imageHint: { n: 0, m: 3 },
  targetSize: undefined,
  targetPSNR: undefined,
  segments: { n: 1, m: 4 },
  snsStrength: { n: 0, m: 100 },
  filterStrength: { n: 0, m: 100 },
  filterSharpness: { n: 0, m: 7 },
  filterType: { n: 0, m: 1 },
  autoFilter: { n: 0, m: 1 },
  alphaCompression: { n: 0, m: 1 },
  alphaFiltering: { n: 0, m: 2 },
  alphaQuality: { n: 0, m: 100 },
  pass: { n: 1, m: 10 },
  showCompressed: { n: 0, m: 1 },
  preprocessing: { n: 0, m: 2 },
  partitions: { n: 0, m: 3 },
  partitionLimit: { n: 0, m: 100 },
  emulateJpegSize: { n: 0, m: 1 },
  threadLevel: { n: 0, m: 5 },
  lowMemory: { n: 0, m: 1 },
  nearLossless: { n: 0, m: 100 },
  useDeltaPalette: { n: 0, m: 1 },
  useSharpYUV: { n: 0, m: 1 },
  qMin: { n: 0, m: 100 },
  qMax: { n: 0, m: 100 }
};
function checkOpts(o) {
  for (let i = 0, keys = Object.keys(o), l = keys.length; i < l; i++) {
    let key = keys[i], r = ranges[key];
    if (!r) { continue; }
    if ((o[key] < r.n) || (o[key] > r.m)) { throw new Error(`${key} out of range ${r.n}..${r.m}`); }
  }
}
function checkAdv(adv) {
  for (let i = 0, keys = Object.keys(adv), l = keys.length; i < l; i++) {
    let key = keys[i], r = ranges[key];
    if (!r) { continue; }
    if ((adv[key] < r.n) || (adv[key] > r.m)) { throw new Error(`advanced.${key} out of range ${r.n}..${r.m}`); }
  }
}
module.exports = class libWebP {
  enc = 0;
  async init() {
    let Module = this.Module = await libwebpF();
    this.api = Module.WebPEnc;
    this.api.getResult = (e) => { return new Uint8Array(new Uint8Array(Module.HEAP8.buffer, e.getResult(), e.getResultSize())); };
    this.api.decodeRGBA = Module.cwrap('decodeRGBA', 'number', [ 'number', 'number' ]);
    this.api.decodeFree = Module.cwrap('decodeFree', '', [ 'number' ]);
    this.api.allocBuffer = Module.cwrap('allocBuffer', 'number', [ 'number' ]);
    this.api.destroyBuffer = Module.cwrap('destroyBuffer', '', [ 'number' ]);
  }
  initEnc() { if (!this.enc) { this.enc = new this.Module.WebPEnc(); } }
  destroyEnc() { if (this.enc) { this.enc.delete(); delete this.enc; } }
  encodeImage(data, width, height, { preset, lossless, quality, method, exact, advanced } = {}) {
    let { api, Module } = this, p, ret = {}, enc;
    this.initEnc();
    enc = this.enc;
    enc.init();
    checkOpts({ preset, lossless, quality, method, exact });
    if (preset != undefined) { enc.setPreset(preset); }
    if (lossless != undefined) { enc.setLosslessPreset(lossless); }
    if (quality != undefined) { enc.setQuality(quality); }
    if (method != undefined) { enc.setMethod(method); }
    if (exact != undefined) { enc.setExact(!!exact); }
    if (advanced != undefined) {
      checkAdv(advanced);
      if (advanced.imageHint != undefined) { enc.advImageHint(advanced.imageHint); }
      if (advanced.targetSize != undefined) { enc.advTargetSize(advanced.targetSize); }
      if (advanced.targetPSNR != undefined) { enc.advTargetPSNR(advanced.targetPSNR); }
      if (advanced.segments != undefined) { enc.advSegments(advanced.segments); }
      if (advanced.snsStrength != undefined) { enc.advSnsStrength(advanced.snsStrength); }
      if (advanced.filterStrength != undefined) { enc.advFilterStrength(advanced.filterStrength); }
      if (advanced.filterSharpness != undefined) { enc.advFilterSharpness(advanced.filterSharpness); }
      if (advanced.filterType != undefined) { enc.advFilterType(advanced.filterType); }
      if (advanced.autoFilter != undefined) { enc.advAutoFilter(advanced.autoFilter); }
      if (advanced.alphaCompression != undefined) { enc.advAlphaCompression(advanced.alphaCompression); }
      if (advanced.alphaFiltering != undefined) { enc.advAlphaFiltering(advanced.alphaFiltering); }
      if (advanced.alphaQuality != undefined) { enc.advAlphaQuality(advanced.alphaQuality); }
      if (advanced.pass != undefined) { enc.advPass(advanced.pass); }
      if (advanced.showCompressed != undefined) { enc.advShowCompressed(advanced.showCompressed); }
      if (advanced.preprocessing != undefined) { enc.advPreprocessing(advanced.preprocessing); }
      if (advanced.partitions != undefined) { enc.advPartitions(advanced.partitions); }
      if (advanced.partitionLimit != undefined) { enc.advPartitionLimit(advanced.partitionLimit); }
      if (advanced.emulateJpegSize != undefined) { enc.advEmulateJpegSize(advanced.emulateJpegSize); }
      if (advanced.threadLevel != undefined) { enc.advThreadLevel(advanced.threadLevel); }
      if (advanced.lowMemory != undefined) { enc.advLowMemory(advanced.lowMemory); }
      if (advanced.nearLossless != undefined) { enc.advNearLossless(advanced.nearLossless); }
      if (advanced.useDeltaPalette != undefined) { enc.advUseDeltaPalette(advanced.useDeltaPalette); }
      if (advanced.useSharpYUV != undefined) { enc.advUseSharpYUV(advanced.useSharpYUV); }
      if (advanced.qMin != undefined) { enc.advQMin(advanced.qMin); }
      if (advanced.qMax != undefined) { enc.advQMax(advanced.qMax); }
    }
    p = api.allocBuffer(data.length);
    Module.HEAP8.set(data, p);
    enc.loadRGBA(p, width, height);
    api.destroyBuffer(p);
    ret.res = enc.encode();
    if (ret.res == 0) { ret.buf = api.getResult(enc); }
    this.destroyEnc();
    return ret;
  }
  decodeImage(data, width, height) {
    let { api, Module } = this, p, ret;
    let np = api.allocBuffer(data.length);
    Module.HEAP8.set(data, np);
    let bp = api.decodeRGBA(np, data.length);
    ret = new Uint8Array(new Uint8Array(Module.HEAP8.buffer, bp, width * height * 4));
    api.decodeFree(bp);
    api.destroyBuffer(np);
    return ret;
  }
};
