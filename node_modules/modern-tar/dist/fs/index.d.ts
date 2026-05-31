import { i as UnpackOptions, n as TarEntryData, r as TarHeader } from "../types-D19dF2SE.js";
import { Readable, Writable } from "node:stream";
import { Stats } from "node:fs";

//#region src/fs/types.d.ts
/**
 * Filesystem-specific configuration options for packing directories into tar archives.
 *
 * These options are specific to Node.js filesystem operations and use Node.js-specific
 * types like `Stats` for file system metadata.
 */
interface PackOptionsFS {
  /** Follow symlinks instead of storing them as symlinks (default: false) */
  dereference?: boolean;
  /** Filter function to include/exclude files (return false to exclude) */
  filter?: (path: string, stat: Stats) => boolean;
  /** Transform function to modify tar headers before packing */
  map?: (header: TarHeader) => TarHeader;
  /** Base directory for symlink security validation, when `dereference` is set to true. */
  baseDir?: string;
  /**
   * Maximum number of concurrent filesystem operations during packing.
   * @default os.cpus().length || 8
   */
  concurrency?: number;
}
/**
 * Filesystem-specific configuration options for extracting tar archives to the filesystem.
 *
 * Extends the core {@link UnpackOptions} with Node.js filesystem-specific settings
 * for controlling file permissions and other filesystem behaviors.
 */
interface UnpackOptionsFS extends UnpackOptions {
  /** Default mode for created directories (e.g., 0o755). If not specified, uses mode from tar header or system default */
  dmode?: number;
  /** Default mode for created files (e.g., 0o644). If not specified, uses mode from tar header or system default */
  fmode?: number;
  /**
   * The maximum depth of paths to extract. Prevents Denial of Service (DoS) attacks
   * from malicious archives with deeply nested directories.
   *
   * Set to `Infinity` to disable depth checking (not recommended for untrusted archives).
   * @default 1024
   */
  maxDepth?: number;
  /**
   * Maximum number of concurrent filesystem operations during extraction.
   * @default os.cpus().length || 8
   */
  concurrency?: number;
}
/** Base interface containing common metadata properties for all source types. */
interface BaseSource {
  /** Destination path for the entry inside the tar archive. */
  target: string;
  /** Optional modification time. Overrides filesystem values or defaults to current time. */
  mtime?: Date;
  /** Optional user ID. Overrides filesystem values or defaults to 0. */
  uid?: number;
  /** Optional group ID. Overrides filesystem values or defaults to 0. */
  gid?: number;
  /** Optional user name. */
  uname?: string;
  /** Optional group name. */
  gname?: string;
  /** Optional Unix file permissions for the entry (e.g., 0o644, 0o755). */
  mode?: number;
}
/** Describes a file on the local filesystem to be added to the archive. */
interface FileSource extends BaseSource {
  type: "file";
  /** Path to the source file on the local filesystem. */
  source: string;
}
/** Describes a directory on the local filesystem to be added to the archive. */
interface DirectorySource extends BaseSource {
  type: "directory";
  /** Path to the source directory on the local filesystem. */
  source: string;
}
/** Describes raw, buffered content to be added to the archive. */
interface ContentSource extends BaseSource {
  type: "content";
  /** Raw content to add. Supports string, Uint8Array, ArrayBuffer, Blob, or null. */
  content: TarEntryData;
}
/** Describes a stream of content to be added to the archive. */
interface StreamSource extends BaseSource {
  type: "stream";
  /** A Readable or ReadableStream. */
  content: Readable | ReadableStream;
  /** The total size of the stream's content in bytes. This is required for streams. */
  size: number;
}
/** A union of all possible source types for creating a tar archive. */
type TarSource = FileSource | DirectorySource | ContentSource | StreamSource;
//#endregion
//#region src/fs/pack.d.ts
/**
 * @deprecated Use `packTar` instead. This function is now an alias for `packTar`.
 */
declare const packTarSources: typeof packTar;
/**
 * Pack a directory or multiple sources into a Node.js `Readable` stream containing
 * tar archive bytes. Can pack either a single directory or an array of sources
 * (files, directories, or raw content).
 *
 * @param sources - Either a directory path string or an array of {@link TarSource} objects.
 * @param options - Optional packing configuration using {@link PackOptionsFS}.
 * @returns Node.js [`Readable`](https://nodejs.org/api/stream.html#class-streamreadable) stream of tar archive bytes
 *
 * @example
 * ```typescript
 * import { packTar } from 'modern-tar/fs';
 * import { createWriteStream } from 'node:fs';
 * import { pipeline } from 'node:stream/promises';
 *
 * // Basic directory packing
 * const tarStream = packTar('/home/user/project');
 * await pipeline(tarStream, createWriteStream('project.tar'));
 *
 * // Pack multiple sources
 * const sources = [
 *   { type: 'file', source: './package.json', target: 'project/package.json' },
 *   { type: 'directory', source: './src', target: 'project/src' },
 *   { type: 'content', content: 'hello world', target: 'project/hello.txt' }
 * ];
 * const archiveStream = packTar(sources);
 * await pipeline(archiveStream, createWriteStream('project.tar'));
 *
 * // With filtering and transformation
 * const filteredStream = packTar('/my/project', {
 *   filter: (path, stats) => !path.includes('node_modules'),
 *   map: (header) => ({ ...header, uname: 'builder' }),
 *   dereference: true  // Follow symlinks
 * });
 * ```
 */
declare function packTar(sources: TarSource[] | string, options?: PackOptionsFS): Readable;
//#endregion
//#region src/fs/unpack.d.ts
/**
 * Extract a tar archive to a directory.
 *
 * Returns a Node.js [`Writable`](https://nodejs.org/api/stream.html#class-streamwritable)
 * stream to pipe tar archive bytes into. Files, directories, symlinks, and hardlinks
 * are written to the filesystem with correct permissions and timestamps.
 *
 * @param directoryPath - Path to directory where files will be extracted
 * @param options - Optional extraction configuration
 * @returns Node.js [`Writable`](https://nodejs.org/api/stream.html#class-streamwritable) stream to pipe tar archive bytes into
 *
 * @example
 * ```typescript
 * import { unpackTar } from 'modern-tar/fs';
 * import { createReadStream } from 'node:fs';
 * import { pipeline } from 'node:stream/promises';
 *
 * // Basic extraction
 * const tarStream = createReadStream('project.tar');
 * const extractStream = unpackTar('/output/directory');
 * await pipeline(tarStream, extractStream);
 *
 * // Extract with path manipulation and filtering
 * const advancedStream = unpackTar('/output', {
 *   strip: 1,  // Remove first path component
 *   filter: (header) => header.type === 'file' && header.name.endsWith('.js'),
 *   map: (header) => ({ ...header, mode: 0o644 })
 * });
 * await pipeline(createReadStream('archive.tar'), advancedStream);
 * ```
 */
declare function unpackTar(directoryPath: string, options?: UnpackOptionsFS): Writable;
//#endregion
export { type ContentSource, type DirectorySource, type FileSource, type PackOptionsFS, type TarSource, type UnpackOptionsFS, packTar, packTarSources, unpackTar };