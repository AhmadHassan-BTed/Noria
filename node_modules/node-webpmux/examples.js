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


/*
  This file contains examples for how to do some common/basic things.
  It will *not* execute. This is on purpose.
  Most lesser-used features, such as frame offsets, animation background color, loop count, etc., aren't described here.
  You can find the full descriptions of function arguments in the README.
*/
process.exit(); // To make certain it cannot be executed
const WebP = require('node-webpmux');

// Creating an empty (1x1, black) image
img = await WebP.Image.getEmptyImage();

// Loading from disk
await img.load('image.webp');

// Or a Buffer
await img.load(buffer);

// Save to a new image on disk
await img.save('path/to/wherever.webp');

// Or a Buffer
buffer = await img.save(null);

// Or overwrite the original on disk
await img.save();

// Get a Buffer of size img.width * img.height * 4 containing the image's pixel data in RGBA order
pixels = await img.getImageData();

// Set the image's pixel data, lossless preset 9, while perfectly preserving alpha pixels
await img.setImageData(pixels, { lossless: 9, exact: true });
// These two are useful for modifying images, or converting to/from other formats
// An example of this, using PNGjs's sync API for brevity
png = PNG.sync.read(fs.readFileSync('example.png'));
await img.setImageData(png.data, { width: png.width, height: png.height });
// ^ from PNG, or to PNG v
pixels = await img.getImageData();
fs.writeFileSync('example.png', PNG.sync.write({ data: pixels, width: img.width, height: img.height }, { deflateLevel: 9 }));

// For animations..
pixels = await img.getFrameData(5);
frame = img.frames[5]; // in case you need frame.width and frame.height, as you would for converting to/from other formats
await img.setFrameData(5, pixels, { lossless: 9, exact: true });

// Replacing a frame from disk
await img.replaceFrame(4, 'different frame.webp');

// Or from a Buffer
await img.replaceFrame(4, buffer);

// Or, you can generate a new frame completely from scratch
width = 20; height = 50;
pixels = Buffer.alloc(width * height * 4);
/* ... populate `pixels` ... omitting it here ... */
img = await WebP.Image.getEmptyImage();
await img.setImageData(pixels, { width, height });

// To add the new frame
frame = await WebP.Image.generateFrame({ img });
anim.frames.push(frame);
// You can also pass `path` or `buffer` instead of `img` to generate a frame using one of those sources

// Or to use it to replace an existing one while preserving the original frame's settings
await anim.replaceFrame(4, await img.save(null));

// Or if you want to replace the whole frame, settings and all
anim.frames.splice(4, 1, frame);

// To create an entire animation from scratch and save it to disk in one go
frames = [];
/* ... populate `frames` using generateFrame ... omitting it here ... */
await WebP.Image.save('anim.webp', { frames });

// Or to a Buffer
buffer = await WebP.Image.save(null, { frames });

// If you instead want to create an animation to do more things to
anim = await WebP.Image.getEmptyImage();
anim.convertToAnim();
anim.frames = frames;

// To export a frame to disk
await anim.demux('directory/to/place/it', { frame: 4 });

// For a range of frames to disk
await anim.demux('directory/to/place/them', { start: 2, end: 5 });

// Or for all the frames to disk
await anim.demux('directory/to/place/them');

// To export to a Buffer instead. Supports the three variants described for .demux() above
await anim.demux({ buffers: true, start: 1, end: 3 });

// To add metadata (here EXIF is shown, but XMP and ICCP are also supported)
// Note that *no* validation is done on metadata. Make sure your source data is valid before adding it.
img.exif = fs.readFileSync('metadata.exif');

// For a quick-and-dirty way to set frame data via a Worker for a moderate speed-up from threaded saving. This example is using NodeJS Workers, but should also work via Web Workers in a browser.

// saver.js
const { Worker } = require('worker_threads');
const WebP = require('node-webpmux');
function spawnWorker(data) {
  return new Promise((res, rej) => {
    let worker = new Worker('saver.worker.js', { workerData: data });
    worker.on('message', res);
    worker.on('error', rej);
    worker.on('exit', (code) => { if (code != 0) { rej(new Error(`Worker stopped with exit code ${code}`)); } });
  });
}
async function go() {
  let img = await WebP.Image.load('anim.webp'), newFrames = [], promises = [];
  /* populate newFrames via getFrameData and make changes as desired */
  for (let i = 0, { frames } = img.data, l = frames.length; i < l; i++) {
    promises.push(spawnWorker({ webp: img, frame: i, data: newFrames[i] }).then((newdata) => { img.data.frames[i] = newdata; }));
  }
  await Promise.all(promises);
  await img.save('newanim.webp');
}
go().then(/* ... */)'

// saver.worker.js
const { parentPort, workerData } = require('worker_threads');
const WebP = require('node-webpmux');

async function saveFrame(d) {
  let { data, frame, webp } = d;
  let img = WebP.Image.from(webp);
  await WebP.Image.initLib();
  await img.setFrameData(frame, data, { lossless: 9 });
  return img.data.frames[frame];
}

parentPort.postMessage(await saveFrame(workerData));
