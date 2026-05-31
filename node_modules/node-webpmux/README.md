# node-webpmux

A mostly-complete pure Javascript re-implementation of webpmux.<br />
Can load "simple" lossy/lossless images as well as animations.

### Install
```npm install node-webpmux```

### Basic usage
```javascript
const WebP = require('node-webpmux');
let img = new WebP.Image();
// Load an animation
await img.load('img.webp');
// Extract the (unprocessed) fourth frame
await img.demux('.', { frame: 3 });
// Replace the fourth frame with a new image from disk
await img.replaceFrame(3, 'different.webp'); // This preserves the existing frame settings
// Alternatively you can do
//   let frame = Image.generateFrame({ path: 'different.webp' });
//   img.frames[3] = frame;
// Which will completely replace the frame
// Save a new copy
await img.save({ path: 'newimg.webp' });
// Or alternatively, img.save() to save over the existing one
```
### Exports
`TYPE_LOSSY`<br />
`TYPE_LOSSLESS`<br />
`TYPE_EXTENDED`<br />
Constants for what type of image is loaded.

`encodeResults`: enum of values that set[Image/Frame]Data returns.

`Image`: The main class.

### Class definition:

#### Class properties

##### `.width` (read-only)
The width of the loaded image.

##### `.height` (read-only)
The height of the loaded image.

##### `.type` (read-only)
The type of image from the TYPE_* constants table.

##### `.hasAnim` (read-only)
A boolean flag for easily checking if the image is an animation.

##### `.hasAlpha` (read-only)
A boolean flag for easily checking if the image has transparency in any way.

##### `.frames` (read-only)
Returns the array of frames, if any, or undefined.<br />
Note that while the frames themselves are read/write, you shouldn't modify them.

##### `.frameCount` (read-only)
The number of frames in the image's animation, or 0 if it's not an animation.

##### `.anim` (read-only)
Direct access to the raw animation data (see below in the _Layout for internal Image data_ section).

##### `.iccp` (read/write)
A Buffer containing the raw ICCP data stored in the image, or undefined if there isn't any.

##### `.exif` (read/write)
A Buffer containing the raw EXIF data stored in the image, or undefined if there isn't any.

##### `.xmp` (read/write)
A Buffer containing the raw XMP data stored in the image, or undefined if there isn't any.

#### Image member functions

##### `async .initLib()`
Calls Image.initLib(). This member function is no longer particularly useful and is kept for convenience.

##### `async .load(source)`
If `source` is a string, it tries to load that as a path to a WebP image.<br />
If `source` is a buffer, it tries to load the contents of the buffer as a WebP image.

##### `.convertToAnim()`
Sets the image up for being an animation.

##### `async .demux({ path = undefined, buffers = false, frame = -1, prefix = '#FNAME#', start = 0, end = 0 })`
Dump the individual, unprocessed WebP frames to a directory.
* `path`: The directory to dump the frames to, if desired.
* `buffers`: Return the frames as an array of Buffers instead of dumping to a path.
* `prefix`: What to prefix the frame names with. Default is the file name of the original image (without .webp).
    Format is \<prefix\>_\<frame number\>.webp.
* `frame`: What frame to dump. Defaults to -1, which has it dump all available frames. Overrides `start`/`end`.
* `start`: The first frame to dump. Defaults to the first frame.
* `end`: The last frame to dump. Defaults to the last frame.

##### `async .replaceFrame(frameIndex, source)`
Replaces a frame in the animation with another image from `source`. All other frame settings are preserved.
* `frameIndex`: Which frame to replace. Frame indexes are 0-based.
* `source`: If this is a string, the frame is loaded from disk. If this is a Buffer, the frame is loaded from there.

##### `async .save(path = this.path, options)`
Save the image to `path`. Options are described below in the _Options for saving_ section.<br />
If `path` is `null`, this will save the image to a Buffer and return it.

##### `async .getImageData()`
Get the raw RGBA pixel data for the image.<br />
Returns a Buffer in the format `[ r, g, b, a, r, g, b, a, ... ]`. Values are range 0 - 255.<br />
Use this for non-animations.<br />
On error, this returns a Buffer full of 0s.

##### `async .setImageData(buffer, { width = 0, height = 0, preset = 0, quality = 75, exact = false, lossless = 0, method = 4, advanced = undefined })`
Encode `buf` as a new WebP using the provided settings and replace the image pixel data with it.<br />
This preserves EXIF/ICCP/XMP if present.<br />
Use this for non-animations.<br />
* `buffer`: A Buffer object with the raw pixels in RGBA order.<br />
Options:
* `width`/`height`<br />
    If either are > 0, override the existing width and/or height with this value.<br />
    Use this if the pixel data in `buf` has different dimensions than the original image.
* `preset`: What image preset to use, if any.<br />
    Range is 0 - 5<br />
    Default is 0 (DEFAULT).<br />
    An enum of constants can be found under WebP.presets
* `quality`: What quality to set.<br />
    Range is 0 - 100.<br />
    Default is 75.
* `exact`: Preserve data in transparent pixels.<br />
    Defaults to `false`, which means transparent pixels may be modified to help with compression.
* `lossless`: Save the data as a lossy/lossless image.<br />
    Range is 0 - 9.<br />
    Default is 0 (lossy).<br />
    Higher values will result in smaller files, but requires more processing time.
* `method`: Compression method to use.<br />
    Range is 0 - 6.<br />
    Default is 4.<br />
    Higher values will result in smaller files, but requires more processing time.
* `advanced`: Access to more advanced encoding settings offered by libwebp<br />
* * `imageHint`: Hint for what type of image it is (only used for lossless encoding for now, according to libwebp spec).<br />
      Range is 0 - 3.<br />
      Default is 0 (DEFAULT).<br />
      An enum of constants can be found under WebP.hints
* * `targetSize`: Specifies the desired target size in bytes.<br />
      Default is 0 (no target).<br />
      Takes precedence over the `method` parameter.
* * `targetPSNR`: Specifies the minimum distortion to try to achieve.<br />
      Default is 0 (no target).<br />
      Takes precedence over the `targetSize` parameter.
* * `segments`: Maximum number of segments to use.<br />
      Range is 1 - 4.<br />
      Default is 4.
* * `snsStrength`: Spacial Noise Shaping.<br />
      Range is 0 - 100.<br />
      Default is 50.
* * `filterStrength`<br />
      Range is 0 - 100.<br />
      Default is 0 (off).
* * `filterSharpness`<br />
      Range is 0 - 7, with 7 being the least sharp.<br />
      Default is 0 (off).
* * `filterType`<br />
      Range is 0 - 1.<br />
      Default is 1.<br />
      0 is simple; 1 is strong.<br />
      Only used if `filterStrength` > 0 or `autoFilter` > 0.
* * `autoFilter`: Auto-adjust the filter's strength.<br />
      Range is 0 - 1.<br />
      Default is 0 (off).
* * `alphaCompression`: Algorithm for encoding the alpha plane.<br />
      Range is 0 - 1.<br />
      Default is 1 (Lossless).<br />
      0 is off; 1 is lossless.
* * `alphaFiltering`: Predictive filtering method for alpha place.<br />
      Range is 0 - 2.<br />
      Default is 1 (Fast).<br />
      0 is none; 1 is fast; 2 is best
* * `alphaQuality`<br />
      Range is 0 - 100.<br />
      Default is 100.
* * `pass`: Number of entropy-analysis passes.<br />
      Range is 1 - 10.<br />
      Default is 1.
* * `showCompressed`: Export the compressed picture back.<br />
      Range is 0 - 1.<br />
      Default is 0 (don't).<br />
      In-loop filtering is not applied.
* * `preprocessing`: Preprocessing filter.<br />
      Range is 0 - 2.<br />
      Default is 0 (None).<br />
      0 is none; 1 is segment-smooth; 2 is pseudo-random dithering.
* * `partitions`: log2(number of token partitions).<br />
      Range is 0 - 3.<br />
      Default is 0.<br />
      Higher values result in harder progressive decoding.
* * `partitionLimit`: Quality degredation allowed to fit the 512k limit on prediction modes coding.<br />
      Range is 0 - 100.<br />
      Default is 0.
* * `emulateJpegSize`: Compression parameters are remapped to better mat the expected output size from JPEG compression.<br />
      Range is 0 - 1.<br />
      Default is 0 (Off).<br />
      Generally, the output size will be smaller but the degredation will be lower.
* * `threadLevel`: Try to use multi-threaded encoding.<br />
      Default is 0 (Off).<br />
      NOTE: Currently the WebAssembly is NOT compiled with support for threads, so this option does nothing.<br />
      NodeJS doesn't support threads in WebAssembly without an experimental flag, and my testing with it didn't appear to use threads regardless.
* * `lowMemory`: Reduce memory usage but increase CPU use.<br />
      Range is 0 - 1.<br />
      Default is 0 (Off).
* * `nearLossless`: Near lossless encoding.<br />
      Range is 0 - 100.<br />
      Default is 100 (off).<br />
      0 is max loss, 100 is off.
* * `useDeltaPalette`: Reserved for future lossless feature.<br />
      Range is 0 - 0.<br />
      Default is 0 (Off).<br />
      Setting this will do nothing, as it's forced back to 0.
* * `useSharpYUV`: Use sharp (and slow) RGB->YUV conversion.<br />
      Range is 0 - 1.<br />
      Default is 0 (Off).
* * `qMin`: Minimum permissible quality factor.<br />
      Range is 0 - 100.<br />
      Default is 0.
* * `qMax`: Maximum permissible quality factor.<br />
      Range is 0 - 100.<br />
      Default is 100.

If `lossless` is set above 0, then setting `quality` or `method` is discouraged as they will override settings in the lossless preset.<br />
Return value can be checked against the values in `WebP.encodeResults`.

##### `async .getFrameData(frameIndex)`
Get the raw RGBA pixel data for a specific frame.<br />
Use this for animations.<br />
* `frameIndex`: Which frame to get. Frame indexes are 0-based.<br />
Otherwise identical to `.getImageData()`

##### `async .setFrameData(frameIndex, buffer, { width = 0, height = 0, preset = 0, quality = 75, exact = false, lossless = 0, method = 4, advanced = undefined })`
Encode `buffer` as a new WebP using the provided settings and replace an existing frame's pixel data with it.<br />
Use this for animations.<br />
* `frameIndex`: Which frame to get. Frame indexes are 0-based.<br />
Otherwise identical to `.setImageData()`.

#### Static functions

##### `async Image.initLib()`
Initialize the internal library used for [get/set]ImageData and [get/set]FrameData described above.<br />
There is no need to call this unless you plan to use one of those 4 functions.

##### `Image.from(webp)`
Use the contents of `webp` and return a new Image using them.<br />
Mainly useful for passing Image into a Web Worker or NodeJS Worker and converting the passed object back into an Image instance.<br />
Such an approach can be used to greatly speed up saving of animations or multiple images as libwebp is *not* multi-threaded beyond saving the alpha layer of lossy images.

##### `async Image.save(path, options)`
Save the `options` using `Image.getEmptyImage()`.<br />
Works the same as `.save()` otherwise.<br />
Can be used to create an animation from scratch by passing `frames` in `options`.<br />
&ensp; Example: `Image.save('animation.webp', { frames: ... })` for saving to file
&ensp; OR
&ensp; Example: `Image.save(null, { frames: ... })` for saving to Buffer

##### `async Image.getEmptyImage(ext)`
Returns a basic, lossy 1x1 black image with no alpha or metadata.<br />
Useful if you need to create a WebP from scratch, such as when converting from PNG.<br />
`.setImageData()` would be used to change the canvas size/contents.<br />
Set `ext` to `true` to force the image to be an extended type, if desired. This is mainly for use internally.

##### `async Image.generateFrame({ path = undefined, buffer = undefined, img = undefined, x = undefined, y = undefined, delay = undefined, blend = undefined, dispose = undefined })`
Generates enough of an `anmf` structure to be placed in `.frames`.<br />
Note that, at the moment, only *static* images are supported in this function.
* `path`/`buffer`/`img`
    Only one of these can be present.
    `path` will load image data from file.
    `buffer` will load from the buffer.
    `img` will use an existing Image instance.
* `x`/`y`/`delay`/`blend`/`dispose`
    Explicitly set these properties. See the _Options for saving_ section for what these do.

### Options for saving
#### These options affect both static images and animations
*   `exif`/`iccp`/`xmp`<br />
      Save or override EXIF/ICCP/XMP chunks.<br />
      Pass `true` to save the existing ones, or pass a Buffer to replace them.<br />
      Note that there is no verification whatsoever that the data passed is valid.

####  The options below are only used when saving an animation:
*   `width`/`height`: Width/height of the image.<br />
      Range 0 - 16777216.<br />
      The product of width*height must NOT exceed (2 ** 32) - 1.<br />
      Passing 0 to either flags it for being set automatically.
*   `bgColor`: The background color of the animation.<br />
      Format is [ r, g, b, a ].<br />
      Defaults to [ 255, 255, 255, 255 ].
*   `loops`: Number of times the animation loops.<br />
      Range is 0 - 65535, with 0 being an infinite loop.<br />
      Default is 0.
*   `x`/`y`/`delay`/`blend`/`dispose`: Changes the default frame x/y position where a frame omits it (see below).
* *   `x`/`y` defaults to 0.
* *   `delay` defaults to 100.
* *   `blend` defaults to `true`.
* *   `dispose` defaults to `false`.
* *   `frames`: An array of objects defining each frame of the animation with the following properties.
* * *  `x`/`y`: x, y offset to place the frame within the animation.<br />
        Range 0 - 16777215.<br />
        Default is 0,0 (defined above).
* * *  `delay`: Length of this frame in miliseconds.<br />
        Range 0 - 16777215.<br />
        Default is 100 (defined above).<br />
        According to the documentation, delays <= 10ms are WebP implementation defined, and many tools/browsers/etc assign their own minimum-allowed delay.
* * *  `blend`: Boolean flag for whether or not to use alpha blending when drawing the frame.<br />
        Default is `true` (defined above).
* * *  `dispose`: Boolean flag to control frame disposal method.<br />
        `true` causes the background color to be drawn under the frame.<br />
        `false` draws the new frame directly.<br />
        Default is `false` (defined above).

### Information about the internal library

[get/set]ImageData and [get/set]FrameData are powered by Google's official libwebp library obtained from the [GitHub mirror](https://github.com/webmproject/libwebp).<br />
Commit 613be8f was the latest at the time of compilation.<br />
This library was compiled with Emscripten with the command `emcc -O3 -s WASM=1 -s MODULARIZE -s EXPORTED_RUNTIME_METHODS='[cwrap]' -s ALLOW_MEMORY_GROWTH=1 -s EXPORT_NAME=LibWebP -DHAVE_CONFIG_H -I libwebp binding.cpp libwebp/src/{dec,dsp,demux,enc,mux,utils}/*.c libwebp/sharpyuv/*.c --bind -o libwebp.js`.<br />
binding.cpp is a shim I wrote to bridge the needed parts together and can be found in the libwebp/ directory.
libwebp.js, found in the root, is the Javascript interface to it.

At present, the only options for encoding are setting the lossless preset, quality, method, and exact flag.<br />
If access to other options is desired (see upstream libwebp/src/webp/encode.h, struct WebPConfig for settings), leave a feature request and I'll add it.<br />
The upstream command line tool `cwebp` can be used to play with the features and see what you find useful.

### Layout for internal Image data
```javascript
{
  path, // The path loaded.
  loaded, // Boolean flag for if this object has an image loaded.
  data: { // The loaded data.
    type, // The type of image from the constants table.
    vp8: { // The lossy format image. Only if .type is TYPE_LOSSY or TYPE_EXTENDED.
      raw, // The raw, compressed image data from the VP8 chunk.
      width, height // The width/height, extracted from the VP8 image data.
    },
    vp8l: { // The lossless format image. Only if .type is TYPE_LOSSLESS or TYPE_EXTENDED.
      raw, // The raw, compressed image data from the VP8L chunk.
      alpha, // A flag for if this image has alpha data, extracted from the VP8L image data.
      width, height // The width/height, extracted from the VP8L image data.
    },
    extended: { // Only if .type is TYPE_EXTENDED.
      raw, // The raw data for the VP8X chunk.
      hasICCP, // Flag for if there's an ICC profile chunk defined.
      hasAlpha, // Flag for if any image/frame defined has alpha data.
      hasEXIF, // Flag for if there's an EXIF chunk defined.
      hasXMP, // Flag for if there's an XMP chunk defined.
      hasAnim, // Flag for if this image has an animation defined.
      width, height // Width/height of the image.
    },
    anim: {
      raw, // A Buffer containing the raw data for the ANIM chunk. Mainly for internal use.
      bgColor, // The background color in [ r, g, b, a ] format.
      loops, // The loop count.
      frames: [ // Array of frames
        { // The frame object definition
          raw, // The raw data for the ANMF chunk. Mainly for internal use.
          type, // The type of image this frame is, from the constants table.
          x, y, // The frame's x, y position.
          width, height, // The frame's width and height.
          delay, // The duration of the frame.
          blend, dispose, // The frame's blend/dispose flags.
          // Additionally, one or more of the following.
          vp8, // The raw, compressed WebP data for a lossy image. If present, there will be no `vp8l`.
          vp8l, // The raw, compressed WebP data for a lossless image. If present, there will be no `vp8` or `alph`.
          alph // The raw, compressed WebP data for an alpha map. Might be present if the image is lossy.
        },
        ...
      ]
    },
    alph: {
      raw // The raw alpha map chunk. Only likely to be here if .vp8 is also defined and .type is TYPE_EXTENDED.
    },
    iccp: {
      raw // The raw ICCP chunk, if defined.
    },
    exif: {
      raw // The raw EXIF chunk, if defined.
    },
    xmp: {
      raw // The raw XMP chunk, if defined.
    }
  }
}
```
### Breaking changes from 1.x
Image.muxAnim and .muxAnim were merged into Image.save and .save respectively.
* Replace `Image.muxAnim({ path, frames, width, height, bgColor, loops, delay, x, y, blend, dispose, exif, iccp, xmp })`
* With `Image.save(path, undefined, { frames, width, height, bgColor, loops, delay, x, y, blend, dispose, exif, iccp, xmp })`
<br /><br />
* Replace `.muxAnim({ path, width, height, bgColor, loops, delay, x, y, blend, dispose, exif, iccp, xmp })`
* With `.save(path, { width, height, bgColor, loops, delay, x, y, blend, dispose, exif, iccp, xmp })`

`.anim.backgroundColor` renamed to `.anim.bgColor` for brevity and consisteny.<br />
`.anim.loopCount` renamed to `.anim.loop` for consistency.<br />
`.anim.frameCount` and `.frameCount` were removed. Should use `.anim.frames.length` and `.frames.length` respectively instead.<br />
`.demuxAnim()` was renamed to `.demux()`

## Breaking changes from 2.0.0 to 2.0.1
Image.generateFrame()'s `duration` input renamed to `delay`<br />

## Breaking changes from 2.x to 3.0.0
File and buffer codepaths have been merged.
* Replace `.loadBuffer(buffer)`
* With `.load(buffer)`
* Replace `Image.loadBuffer(buffer)`
* With `Image.load(buffer)`
<br /><br />
* Replace `.saveBuffer(settings)`
* With `.save(null, settings)`
* Replace `Image.saveBuffer(settings)`
* With `Image.save(null, settings)`
* Note that it's specifically `null` here. This is because the default behavior of .save() is still saving to the path it was loaded from.
<br /><br />
* Replace `.demuxToBuffers({ setting, setting, ... })`
* With `.demux({ buffers: true, setting, setting, ... })`
* Replace `.demux(path, settings)`
* With `.demux({ path, setting, setting, ... })`
<br /><br />
* Replace `.replaceFrameBuffer(frame, buffer)`
* With `.replaceFrame(frame, buffer)`
