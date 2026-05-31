//#region src/tar/constants.d.ts
/** Type flag constants for file types. */
declare const TYPEFLAG: {
  readonly file: "0";
  readonly link: "1";
  readonly symlink: "2";
  readonly "character-device": "3";
  readonly "block-device": "4";
  readonly directory: "5";
  readonly fifo: "6";
  readonly "pax-header": "x";
  readonly "pax-global-header": "g";
  readonly "gnu-long-name": "L";
  readonly "gnu-long-link-name": "K";
};
//#endregion
//#region src/tar/types.d.ts
/**
 * Header information for a tar entry in USTAR format.
 */
interface TarHeader {
  /** Entry name/path. Can be up to 255 characters with USTAR prefix extension. */
  name: string;
  /** Size of the entry data in bytes. Should be 0 for directories, symlinks, and hardlinks. */
  size: number;
  /** Modification time as a `Date` object. Defaults to current time if not specified. */
  mtime?: Date;
  /** Unix file permissions as an octal number (e.g., 0o644 for rw-r--r--). Defaults to 0o644 for files and 0o755 for directories. */
  mode?: number;
  /** Entry type. Defaults to "file" if not specified. */
  type?: keyof typeof TYPEFLAG;
  /** User ID of the entry owner. */
  uid?: number;
  /** Group ID of the entry owner. */
  gid?: number;
  /** User name of the entry owner. */
  uname?: string;
  /** Group name of the entry owner. */
  gname?: string;
  /** Target path for symlinks and hard links. */
  linkname?: string;
  /** PAX extended attributes as key-value pairs. */
  pax?: Record<string, string>;
}
/**
 * Union type for entry body data that can be packed into a tar archive.
 */
type TarEntryData = string | Uint8Array | ArrayBuffer | Blob | null | undefined;
/**
 * Configuration options for creating a tar decoder stream.
 */
interface DecoderOptions {
  /**
   * Enable strict validation of the tar archive.
   * When true, the decoder will throw errors for data corruption issues:
   * - Invalid checksums (indicates header corruption)
   * - Invalid USTAR magic string (format violation)
   * @default false
   */
  strict?: boolean;
}
/**
 * Platform-neutral configuration options for extracting tar archives.
 *
 * These options work with any tar extraction implementation and are not tied
 * to specific platforms like Node.js filesystem APIs.
 */
interface UnpackOptions extends DecoderOptions {
  /** Number of leading path components to strip from entry names (e.g., strip: 1 removes first directory) */
  strip?: number;
  /** Filter function to include/exclude entries (return false to skip) */
  filter?: (header: TarHeader) => boolean;
  /** Transform function to modify tar headers before extraction */
  map?: (header: TarHeader) => TarHeader;
}
//#endregion
export { UnpackOptions as i, TarEntryData as n, TarHeader as r, DecoderOptions as t };