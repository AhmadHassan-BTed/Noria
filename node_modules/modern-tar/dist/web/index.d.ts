import { i as UnpackOptions, n as TarEntryData, r as TarHeader, t as DecoderOptions } from "../types-D19dF2SE.js";

//#region src/web/compression.d.ts
/**
 * Creates a gzip compression stream that is compatible with Uint8Array streams.
 *
 * @returns A {@link ReadableWritablePair} configured for gzip compression.
 * @example
 * ```typescript
 * import { createGzipEncoder, createTarPacker } from 'modern-tar';
 *
 * // Create and compress a tar archive
 * const { readable, controller } = createTarPacker();
 * const compressedStream = readable.pipeThrough(createGzipEncoder());
 *
 * // Add entries...
 * const fileStream = controller.add({ name: "file.txt", size: 5, type: "file" });
 * const writer = fileStream.getWriter();
 * await writer.write(new TextEncoder().encode("hello"));
 * await writer.close();
 * controller.finalize();
 *
 * // Upload compressed .tar.gz
 * await fetch('/api/upload', {
 *   method: 'POST',
 *   body: compressedStream,
 *   headers: { 'Content-Type': 'application/gzip' }
 * });
 * ```
 */
declare function createGzipEncoder(): ReadableWritablePair<Uint8Array, Uint8Array>;
/**
 * Creates a gzip decompression stream that is compatible with Uint8Array streams.
 *
 * @returns A {@link ReadableWritablePair} configured for gzip decompression.
 * @example
 * ```typescript
 * import { createGzipDecoder, createTarDecoder } from 'modern-tar';
 *
 * // Download and process a .tar.gz file
 * const response = await fetch('https://api.example.com/archive.tar.gz');
 * if (!response.body) throw new Error('No response body');
 *
 * // Buffer entire archive
 * const entries = await unpackTar(response.body.pipeThrough(createGzipDecoder()));
 *
 * for (const entry of entries) {
 *   console.log(`Extracted: ${entry.header.name}`);
 *   const content = new TextDecoder().decode(entry.data);
 *   console.log(`Content: ${content}`);
 * }
 * ```
 * @example
 * ```typescript
 * import { createGzipDecoder, createTarDecoder } from 'modern-tar';
 *
 * // Download and process a .tar.gz file
 * const response = await fetch('https://api.example.com/archive.tar.gz');
 * if (!response.body) throw new Error('No response body');
 *
 * // Chain decompression and tar parsing using streams
 * const entries = response.body
 *   .pipeThrough(createGzipDecoder())
 *   .pipeThrough(createTarDecoder());
 *
 * for await (const entry of entries) {
 * console.log(`Extracted: ${entry.header.name}`);
 *   // Process entry.body ReadableStream as needed
 * }
 * ```
 */
declare function createGzipDecoder(): ReadableWritablePair<Uint8Array, Uint8Array>;
//#endregion
//#region src/web/types.d.ts
/**
 * Represents a complete entry to be packed into a tar archive.
 *
 * Combines header metadata with optional body data. Used as input to {@link packTar}
 * and the controller returned by {@link createTarPacker}.
 */
interface TarEntry {
  header: TarHeader;
  body?: TarEntryData | ReadableStream<Uint8Array>;
}
/**
 * Represents an entry parsed from a tar archive stream.
 */
interface ParsedTarEntry {
  header: TarHeader;
  body: ReadableStream<Uint8Array>;
}
/**
 * Represents an extracted entry with fully buffered content.
 *
 * For bodyless entries (directories, symlinks, hardlinks), `data` will be `undefined`.
 * For files (including empty files), `data` will be a `Uint8Array`.
 */
interface ParsedTarEntryWithData {
  header: TarHeader;
  data?: Uint8Array;
}
//#endregion
//#region src/web/helpers.d.ts
/**
 * Packs an array of tar entries into a single `Uint8Array` buffer.
 *
 * For streaming scenarios or large archives, use {@link createTarPacker} instead.
 *
 * @param entries - Array of tar entries with headers and optional bodies
 * @returns A `Promise` that resolves to the complete tar archive as a Uint8Array
 * @example
 * ```typescript
 * import { packTar } from 'modern-tar';
 *
 * const entries = [
 *   {
 *     header: { name: "hello.txt", size: 5, type: "file" },
 *     body: "hello"
 *   },
 *   {
 *     header: { name: "data.json", size: 13, type: "file" },
 *     body: new Uint8Array([123, 34, 116, 101, 115, 116, 34, 58, 116, 114, 117, 101, 125]) // {"test":true}
 *   },
 *   {
 *     header: { name: "folder/", type: "directory", size: 0 }
 *   }
 * ];
 *
 * const tarBuffer = await packTar(entries);
 *
 * // Save to file or upload
 * await fetch('/api/upload', {
 *   method: 'POST',
 *   body: tarBuffer,
 *   headers: { 'Content-Type': 'application/x-tar' }
 * });
 * ```
 */
declare function packTar(entries: (TarEntry | ParsedTarEntryWithData)[]): Promise<Uint8Array>;
/**
 * Extracts all entries and their data from a complete tar archive buffer.
 *
 * For streaming scenarios or large archives, use {@link createTarDecoder} instead.
 *
 * @param archive - The complete tar archive as `ArrayBuffer` or `Uint8Array`
 * @param options - Optional extraction configuration
 * @returns A `Promise` that resolves to an array of entries with buffered data
 * @example
 * ```typescript
 * import { unpackTar } from 'modern-tar';
 *
 * // From a file upload or fetch
 * const response = await fetch('/api/archive.tar');
 * const tarBuffer = await response.arrayBuffer();
 *
 * const entries = await unpackTar(tarBuffer);
 * for (const entry of entries) {
 *   if (entry.data) {
 *     console.log(`File: ${entry.header.name}, Size: ${entry.data.length} bytes`);
 *     const content = new TextDecoder().decode(entry.data);
 *     console.log(`Content: ${content}`);
 *   } else {
 *     console.log(`${entry.header.type}: ${entry.header.name}`);
 *   }
 * }
 * ```
 * @example
 * ```typescript
 * // From a Uint8Array with options
 * const tarData = new Uint8Array([...]); // your tar data
 * const entries = await unpackTar(tarData, {
 *   strip: 1,
 *   filter: (header) => header.name.endsWith('.txt'),
 *   map: (header) => ({ ...header, name: header.name.toLowerCase() })
 * });
 *
 * // Process filtered files
 * for (const file of entries) {
 *   if (file.data) {
 *     console.log(new TextDecoder().decode(file.data));
 *   }
 * }
 * ```
 */
declare function unpackTar(archive: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>, options?: UnpackOptions): Promise<ParsedTarEntryWithData[]>;
//#endregion
//#region src/web/pack.d.ts
/**
 * Controls a streaming tar packing process.
 *
 * Provides methods to add entries to a tar archive and finalize the stream.
 * This is the advanced API for streaming tar creation, allowing you to dynamically
 * add entries and write their content as a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream).
 */
interface TarPackController {
  /**
   * Add an entry to the tar archive.
   *
   * After adding the entry, you must write exactly `header.size` bytes of data
   * to the returned [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream)
   * and then close it. For entries that do not have a body (e.g., directories),
   * the size property should be set to 0 and the stream should be closed immediately.
   *
   * @param header - The tar header for the entry. The `size` property must be accurate
   * @returns A [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream) for writing the entry's body data
   *
   * @example
   * ```typescript
   * // Add a text file
   * const fileStream = controller.add({
   *   name: "file.txt",
   *   size: 11,
   *   type: "file"
   * });
   *
   * const writer = fileStream.getWriter();
   * await writer.write(new TextEncoder().encode("hello world"));
   * await writer.close();
   *
   * // Add a directory
   * const dirStream = controller.add({
   *   name: "folder/",
   *   type: "directory",
   *   size: 0
   * });
   * await dirStream.close(); // Directories have no content
   * ```
   */
  add(header: TarHeader): WritableStream<Uint8Array>;
  /**
   * Finalize the archive.
   *
   * Must be called after all entries have been added.
   * This writes the end-of-archive marker and closes the readable stream.
   */
  finalize(): void;
  /**
   * Abort the packing process with an error.
   *
   * @param err - The error that caused the abort
   */
  error(err: unknown): void;
}
/**
 * Create a streaming tar packer.
 *
 * Provides a controller-based API for creating tar archives, suitable for scenarios where entries are
 * generated dynamically. The returned [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
 * outputs tar archive bytes as entries are added.
 *
 * @returns Object containing the readable stream and controller
 * @returns readable - [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) that outputs the tar archive bytes
 * @returns controller - {@link TarPackController} for adding entries and finalizing
 *
 * @example
 * ```typescript
 * import { createTarPacker } from 'modern-tar';
 *
 * const { readable, controller } = createTarPacker();
 *
 * // Add entries dynamically
 * const fileStream = controller.add({
 *   name: "dynamic.txt",
 *   size: 5,
 *   type: "file"
 * });
 *
 * const writer = fileStream.getWriter();
 * await writer.write(new TextEncoder().encode("hello"));
 * await writer.close();
 *
 * // Add multiple entries
 * const jsonStream = controller.add({
 *   name: "data.json",
 *   size: 13,
 *   type: "file"
 * });
 * const jsonWriter = jsonStream.getWriter();
 * await jsonWriter.write(new TextEncoder().encode('{"test":true}'));
 * await jsonWriter.close();
 *
 * // Finalize the archive
 * controller.finalize();
 *
 * // Use the readable stream
 * const response = new Response(readable);
 * const buffer = await response.arrayBuffer();
 * ```
 */
declare function createTarPacker(): {
  readable: ReadableStream<Uint8Array>;
  controller: TarPackController;
};
//#endregion
//#region src/web/unpack.d.ts
/**
 * Create a transform stream that parses tar bytes into entries.
 *
 * @param options - Optional configuration for the decoder using {@link DecoderOptions}.
 * @returns `TransformStream` that converts tar archive bytes to {@link ParsedTarEntry} objects.
 * @example
 * ```typescript
 * import { createTarDecoder } from 'modern-tar';
 *
 * const decoder = createTarDecoder({ strict: true });
 * const entriesStream = tarStream.pipeThrough(decoder);
 *
 * for await (const entry of entriesStream) {
 *  console.log(`Entry: ${entry.header.name}`);
 *
 *  const shouldSkip = entry.header.name.endsWith('.md');
 *  if (shouldSkip) {
 *   // You MUST drain the body with cancel() to proceed to the next entry or read it fully,
 * 	 // otherwise the stream will stall.
 *   await entry.body.cancel();
 *   continue;
 *  }
 *
 *  const reader = entry.body.getReader();
 *  while (true) {
 * 	 const { done, value } = await reader.read();
 * 	 if (done) break;
 * 	 processChunk(value);
 *  }
 * }
 */
declare function createTarDecoder(options?: DecoderOptions): TransformStream<Uint8Array, ParsedTarEntry>;
//#endregion
export { type DecoderOptions, type ParsedTarEntry, type ParsedTarEntryWithData, type TarEntry, type TarEntryData, type TarHeader, type TarPackController, type UnpackOptions, createGzipDecoder, createGzipEncoder, createTarDecoder, createTarPacker, packTar, unpackTar };