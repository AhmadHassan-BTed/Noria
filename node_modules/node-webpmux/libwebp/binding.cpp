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

#include <stdlib.h>
#include <stdio.h>
#include <emscripten.h>
#include <emscripten/bind.h>
#include "libwebp/src/webp/encode.h"
#include "libwebp/src/webp/decode.h"

using namespace emscripten;

class WebPEnc {
  public:
    WebPEnc() { this->ready = false; this->picAlloc = false; }
    ~WebPEnc() { this->reset(); }
    bool init() {
      if (this->ready) { return false; }
      WebPPictureInit(&(this->pic));
      WebPMemoryWriterInit(&(this->writer));
      this->pic.writer = WebPMemoryWrite;
      this->pic.custom_ptr = &(this->writer);
      WebPConfigInit(&(this->config));
      this->ready = true;
      return true;
    }
    void reset() {
      if (!this->ready) { return; }
      if (this->picAlloc) { WebPPictureFree(&(this->pic)); }
      WebPMemoryWriterClear(&(this->writer));
      this->ready = false;
      this->picAlloc = false;
    }
    // Clunky workaround for Embind not supporting pointers to primitives (first argument should be a const uint8_t *)
    bool loadRGBA(const int input, int width, int height) {
      if (!this->ready) { return false; }
      this->pic.width = width;
      this->pic.height = height;
      WebPPictureImportRGBA(&(this->pic), reinterpret_cast<const uint8_t *>(input), width * 4);
      this->picAlloc = true;
      return true;
    }
    bool setPreset(int en) {
      if (!this->ready) { return false; }
      if (en > 0) { WebPConfigPreset(&(this->config), (WebPPreset)en, 100.0f); }
      else { WebPConfigInit(&(this->config)); }
      return true;
    }
    bool setLosslessPreset(int en) {
      if (!this->ready) { return false; }
      if (en > 0) { WebPConfigLosslessPreset(&(this->config), en); this->pic.use_argb = 1; }
      else { WebPConfigInit(&(this->config)); this->pic.use_argb = 0; }
      return true;
    }
    bool setQuality(float q) { if (!this->ready) { return false; } this->config.quality = q; return true; }
    bool setMethod(int m) { if (!this->ready) { return false; } this->config.method = m; return true; }
    bool setExact(bool ex) { if (!this->ready) { return false; } this->config.exact = ex ? 1 : 0; return true; }
    int encode() {
      if (!this->ready) { return -1; }
      if (!WebPValidateConfig(&(this->config))) { return -2; }
      if (!WebPEncode(&(this->config), &(this->pic))) { return this->pic.error_code; }
      return 0;
    }
    // Clunky workaround for Embind not supporting pointers to primitives (this should return uint8_t*)
    int getResult() { return (int)this->writer.mem; }
    size_t getResultSize() { return this->writer.size; }
    bool advImageHint(int en) { if (!this->ready) { return false; } this->config.image_hint = (WebPImageHint)en; return true; }
    bool advTargetSize(int s) { if (!this->ready) { return false; } this->config.target_size = s; return true; }
    bool advTargetPSNR(float psnr) { if (!this->ready) { return false; } this->config.target_PSNR = psnr; return true; }
    bool advSegments(int seg) { if (!this->ready) { return false; } this->config.segments = seg; return true; }
    bool advSnsStrength(int str) { if (!this->ready) { return false; } this->config.sns_strength = str; return true; }
    bool advFilterStrength(int str) { if (!this->ready) { return false; } this->config.filter_strength = str; return true; }
    bool advFilterSharpness(int shr) { if (!this->ready) { return false; } this->config.filter_sharpness = shr ? 1 : 0; return true; }
    bool advFilterType(int type) { if (!this->ready) { return false; } this->config.filter_type = type ? 1 : 0; return true; }
    bool advAutoFilter(int filter) { if (!this->ready) { return false; } this->config.autofilter = filter ? 1 : 0; return true; }
    bool advAlphaCompression(int comp) { if (!this->ready) { return false; } this->config.alpha_compression = comp; return true; }
    bool advAlphaFiltering(int filter) { if (!this->ready) { return false; } this->config.alpha_filtering = filter; return true; }
    bool advAlphaQuality(int qual) { if (!this->ready) { return false; } this->config.alpha_quality = qual; return true; }
    bool advPass(int pass) { if (!this->ready) { return false; } this->config.pass = pass; return true; }
    bool advShowCompressed(int comp) { if (!this->ready) { return false; } this->config.show_compressed = comp ? 1 : 0; return true; }
    bool advPreprocessing(int prepro) { if (!this->ready) { return false; } this->config.preprocessing = prepro; return true; }
    bool advPartitions(int parts) { if (!this->ready) { return false; } this->config.partitions = parts; return true; }
    bool advPartitionLimit(int limit) { if (!this->ready) { return false; } this->config.partition_limit = limit; return true; }
    bool advEmulateJpegSize(int emulate) { if (!this->ready) { return false; } this->config.emulate_jpeg_size = emulate ? 1 : 0; return true; }
    bool advThreadLevel(int threads) { if (!this->ready) { return false; } this->config.thread_level = threads; return true; }
    bool advLowMemory(int low) { if (!this->ready) { return false; } this->config.low_memory = low ? 1 : 0; return true; }
    bool advNearLossless(int near) { if (!this->ready) { return false; } this->config.near_lossless = near; return true; }
    bool advUseDeltaPalette(int delta) { if (!this->ready) { return false; } this->config.use_delta_palette = 0 /*delta*/; return true; }
    bool advUseSharpYUV(int sharp) { if (!this->ready) { return false; } this->config.use_sharp_yuv = sharp ? 1 : 0; return true; }
    bool advQMin(int min) { if (!this->ready) { return false; } this->config.qmin = min; return true; }
    bool advQMax(int max) { if (!this->ready) { return false; } this->config.qmax = max; return true; }
  private:
    bool ready;
    bool picAlloc;
    WebPConfig config;
    WebPPicture pic;
    WebPMemoryWriter writer;
};
// Encoder hooks
EMSCRIPTEN_BINDINGS(WebPBinding) {
  class_<WebPEnc>("WebPEnc")
  .constructor<>()
  .function("init", &WebPEnc::init)
  .function("reset", &WebPEnc::reset)
  .function("loadRGBA", &WebPEnc::loadRGBA)
  .function("setPreset", &WebPEnc::setPreset)
  .function("setLosslessPreset", &WebPEnc::setLosslessPreset)
  .function("setQuality", &WebPEnc::setQuality)
  .function("setMethod", &WebPEnc::setMethod)
  .function("setExact", &WebPEnc::setExact)
  .function("encode", &WebPEnc::encode)
  .function("getResult", &WebPEnc::getResult)
  .function("getResultSize", &WebPEnc::getResultSize)
  .function("advImageHint", &WebPEnc::advImageHint)
  .function("advTargetSize", &WebPEnc::advTargetSize)
  .function("advTargetPSNR", &WebPEnc::advTargetPSNR)
  .function("advSegments", &WebPEnc::advSegments)
  .function("advSnsStrength", &WebPEnc::advSnsStrength)
  .function("advFilterStrength", &WebPEnc::advFilterStrength)
  .function("advFilterSharpness", &WebPEnc::advFilterSharpness)
  .function("advFilterType", &WebPEnc::advFilterType)
  .function("advAutoFilter", &WebPEnc::advAutoFilter)
  .function("advAlphaCompression", &WebPEnc::advAlphaCompression)
  .function("advAlphaFiltering", &WebPEnc::advAlphaFiltering)
  .function("advAlphaQuality", &WebPEnc::advAlphaQuality)
  .function("advPass", &WebPEnc::advPass)
  .function("advShowCompressed", &WebPEnc::advShowCompressed)
  .function("advPreprocessing", &WebPEnc::advPreprocessing)
  .function("advPartitions", &WebPEnc::advPartitions)
  .function("advPartitionLimit", &WebPEnc::advPartitionLimit)
  .function("advEmulateJpegSize", &WebPEnc::advEmulateJpegSize)
  .function("advThreadLevel", &WebPEnc::advThreadLevel)
  .function("advLowMemory", &WebPEnc::advLowMemory)
  .function("advNearLossless", &WebPEnc::advNearLossless)
  .function("advUseDeltaPalette", &WebPEnc::advUseDeltaPalette)
  .function("advUseSharpYUV", &WebPEnc::advUseSharpYUV)
  .function("advQMin", &WebPEnc::advQMin)
  .function("advQMax", &WebPEnc::advQMax);
}
extern "C" {
  // Decoder
  EMSCRIPTEN_KEEPALIVE uint8_t *decodeRGBA(const uint8_t *data, size_t dataSize) { return WebPDecodeRGBA(data, dataSize, 0, 0); }
  EMSCRIPTEN_KEEPALIVE void decodeFree(uint8_t *data) { WebPFree(data); }
  // Utility
  EMSCRIPTEN_KEEPALIVE uint8_t *allocBuffer(size_t size) { return (uint8_t*)malloc(size * sizeof(uint8_t)); }
  EMSCRIPTEN_KEEPALIVE void destroyBuffer(uint8_t *p) { free(p); }
}
