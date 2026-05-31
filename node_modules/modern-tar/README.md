# 🗄️ modern-tar

Zero-dependency, cross-platform, streaming tar archive library for every JavaScript runtime. Built with the browser-native Web Streams API for performance and memory efficiency.

## Features

- 🚀 **Streaming Architecture** - Supports large archives without loading everything into memory.
- 📋 **Standards Compliant** - Full USTAR format support with PAX extensions. Compatible with GNU tar, BSD tar, and other standard implementations.
- 🗜️ **Compression** - Includes helpers for gzip compression/decompression.
- 📝 **TypeScript First** - Full type safety with detailed TypeDoc documentation.
- ⚡ **Zero Dependencies** - No external dependencies, minimal bundle size.
- 🌐 **Cross-Platform** - Works in browsers, Node.js, Cloudflare Workers, and other JavaScript runtimes.
- 📁 **Node.js Integration** - Additional high-level APIs for directory packing and extraction.

## Installation

```sh
npm install modern-tar
```

## Usage

This package provides two entry points:

- `modern-tar`: The core, cross-platform streaming API (works everywhere).
- `modern-tar/fs`: High-level filesystem utilities for Node.js.

### Core Usage

These APIs use the Web Streams API and can be used in any modern JavaScript environment.

#### Simple

```typescript
import { packTar, unpackTar } from 'modern-tar';

// Pack entries into a tar buffer
const entries = [
	{ header: { name: "file.txt", size: 5 }, body: "hello" },
	{ header: { name: "dir/", type: "directory", size: 0 } },
	{ header: { name: "dir/nested.txt", size: 3 }, body: new Uint8Array([97, 98, 99]) } // "abc"
];

// Accepts string, Uint8Array, Blob, ReadableStream<Uint8Array> and more...
const tarBuffer = await packTar(entries);

// Unpack tar buffer into entries
const entries = await unpackTar(tarBuffer);
for (const entry of entries) {
	console.log(`File: ${entry.header.name}`);
	const content = new TextDecoder().decode(entry.data);
	console.log(`Content: ${content}`);
}
```

#### Streaming

```typescript
import { createTarPacker, createTarDecoder } from 'modern-tar';

// Create a tar packer
const { readable, controller } = createTarPacker();

// Add entries dynamically
const fileStream = controller.add({
	name: "dynamic.txt",
	size: 5,
	type: "file"
});

// Write content to the stream
const writer = fileStream.getWriter();
await writer.write(new TextEncoder().encode("hello"));
await writer.close();

// When done adding entries, finalize the archive
controller.finalize();

// Pipe the archive right into a decoder
const decodedStream = readable.pipeThrough(createTarDecoder());
for await (const entry of decodedStream) {
	console.log(`Decoded: ${entry.header.name}`);

	const shouldSkip = entry.header.name.endsWith(".md");
	if (shouldSkip) {
		// You MUST drain the body with cancel() to proceed to the next entry or read it fully,
		// otherwise the stream will stall.
		await entry.body.cancel();
		continue;
	}

	const reader = entry.body.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		processChunk(value);
	}
}
```

#### Compression/Decompression (gzip)

```typescript
import { createGzipEncoder, createTarPacker } from 'modern-tar';

// Create and compress a tar archive
const { readable, controller } = createTarPacker();
const compressedStream = readable.pipeThrough(createGzipEncoder());

// Add entries...
const fileStream = controller.add({ name: "file.txt", size: 5, type: "file" });
const writer = fileStream.getWriter();
await writer.write(new TextEncoder().encode("hello"));
await writer.close();
controller.finalize();

// Upload compressed .tar.gz
await fetch('/api/upload', {
  method: 'POST',
  body: compressedStream,
  headers: { 'Content-Type': 'application/gzip' }
});
```

```typescript
import { createGzipDecoder, createTarDecoder, unpackTar } from 'modern-tar';

// Download and process a .tar.gz file
const response = await fetch('https://api.example.com/archive.tar.gz');
if (!response.body) throw new Error('No response body');

// Buffer entire archive
const entries = await unpackTar(response.body.pipeThrough(createGzipDecoder()));

for (const entry of entries) {
	console.log(`Extracted: ${entry.header.name}`);
	const content = new TextDecoder().decode(entry.data);
	console.log(`Content: ${content}`);
}

// Or chain decompression and tar parsing using streams
const entries = response.body
  .pipeThrough(createGzipDecoder())
  .pipeThrough(createTarDecoder());

for await (const entry of entries) {
  console.log(`Extracted: ${entry.header.name}`);
  // Process entry.body ReadableStream as needed
}
```

### Node.js Filesystem Usage

These APIs use Node.js streams when interacting with the local filesystem.

#### Simple

```typescript
import { packTar, unpackTar } from 'modern-tar/fs';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

// Pack a directory into a tar file
const tarStream = packTar('./my/project');
const fileStream = createWriteStream('./project.tar');
await pipeline(tarStream, fileStream);

// Extract a tar file to a directory
const tarReadStream = createReadStream('./project.tar', {
	highWaterMark: 256 * 1024 // 256 KB for optimal performance
});
const extractStream = unpackTar('./output/directory');
await pipeline(tarReadStream, extractStream);
```

#### Filtering and Transformation

```typescript
import { packTar, unpackTar } from 'modern-tar/fs';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

// Pack with filtering
const packStream = packTar('./my/project', {
	filter: (filePath, stats) => !filePath.includes('node_modules'),
	map: (header) => ({ ...header, mode: 0o644 }), // Set all files to 644
	dereference: true // Follow symlinks instead of archiving them
});

// Unpack with advanced options
const sourceStream = createReadStream('./archive.tar', {
	highWaterMark: 256 * 1024 // 256 KB for optimal performance
});
const extractStream = unpackTar('./output', {
	// Core options
	strip: 1, // Remove first directory level
	filter: (header) => header.name.endsWith('.js'), // Only extract JS files
	map: (header) => ({ ...header, name: header.name.toLowerCase() }), // Transform names

	// Filesystem-specific options
	fmode: 0o644, // Override file permissions
	dmode: 0o755, // Override directory permissions
	maxDepth: 50,  // Limit extraction depth for security (default: 1024)
	concurrency: 8 // Limit concurrent filesystem operations (default: CPU cores)
});

await pipeline(sourceStream, extractStream);
```

#### Archive Creation

```typescript
import { packTar, type TarSource } from 'modern-tar/fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

// Pack multiple sources
const sources: TarSource[] = [
  { type: 'file', source: './package.json', target: 'project/package.json' },
  { type: 'directory', source: './src', target: 'project/src' },
  { type: 'content', content: 'Hello World!', target: 'project/hello.txt' },
  { type: 'content', content: '#!/bin/bash\necho "Executable"', target: 'bin/script.sh', mode: 0o755 },
  { type: 'stream', content: createReadStream('./large-file.bin'), target: 'project/data.bin', size: 1048576 },
  { type: 'stream', content: fetch('/api/data').then(r => r.body!), target: 'project/remote.json', size: 2048 }
];

const archiveStream = packTar(sources);
await pipeline(archiveStream, createWriteStream('project.tar'));
```

#### Compression/Decompression (gzip)

```typescript
import { packTar, unpackTar } from 'modern-tar/fs';
import { createWriteStream, createReadStream } from 'node:fs';
import { createGzip, createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

// Pack directory and compress to .tar.gz
const tarStream = packTar('./my/project');
await pipeline(tarStream, createGzip(), createWriteStream('./project.tar.gz'));

// Decompress and extract .tar.gz
const gzipStream = createReadStream('./project.tar.gz', {
	highWaterMark: 256 * 1024 // 256 KB for optimal performance
});
await pipeline(gzipStream, createGunzip(), unpackTar('./output'));
```

## API Reference

See the [API Reference](./REFERENCE.md).

# Benchmarks

Current benchmarks indicate we're much faster than other popular tar libraries for small file archives (packing and unpacking). On the other hand, larger files hit an I/O bottleneck resulting in similar performance between libraries.

See the [Results](./benchmarks/README.md).

## Compatibility

The core library uses the [Web Streams API](https://caniuse.com/streams) and requires:

- **Node.js**: 18.0+
- **Browsers**: Modern browsers with Web Streams support
  - Chrome 71+
  - Firefox 102+
  - Safari 14.1+
  - Edge 79+

## Acknowledgements

- [`tar-stream`](https://github.com/mafintosh/tar-stream) and [`tar-fs`](https://github.com/mafintosh/tar-fs) - For the inspiration and test fixtures.

## License

MIT
