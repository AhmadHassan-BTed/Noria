const FILE = "file";
const LINK = "link";
const SYMLINK = "symlink";
const DIRECTORY = "directory";
const TYPEFLAG = {
	file: "0",
	link: "1",
	symlink: "2",
	"character-device": "3",
	"block-device": "4",
	directory: "5",
	fifo: "6",
	"pax-header": "x",
	"pax-global-header": "g",
	"gnu-long-name": "L",
	"gnu-long-link-name": "K"
};
const FLAGTYPE = {
	"0": FILE,
	"1": LINK,
	"2": SYMLINK,
	"3": "character-device",
	"4": "block-device",
	"5": DIRECTORY,
	"6": "fifo",
	x: "pax-header",
	g: "pax-global-header",
	L: "gnu-long-name",
	K: "gnu-long-link-name"
};
const ZERO_BLOCK = new Uint8Array(512);
const EMPTY = new Uint8Array(0);
//#endregion
//#region src/tar/encoding.ts
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function writeString(view, offset, size, value) {
	if (value) encoder.encodeInto(value, view.subarray(offset, offset + size));
}
function writeOctal(view, offset, size, value) {
	if (value === void 0) return;
	const octalString = value.toString(8).padStart(size - 1, "0");
	encoder.encodeInto(octalString, view.subarray(offset, offset + size - 1));
}
function readString(view, offset, size) {
	const end = view.indexOf(0, offset);
	const sliceEnd = end === -1 || end > offset + size ? offset + size : end;
	return decoder.decode(view.subarray(offset, sliceEnd));
}
function readOctal(view, offset, size) {
	let value = 0;
	const end = offset + size;
	for (let i = offset; i < end; i++) {
		const charCode = view[i];
		if (charCode === 0) break;
		if (charCode === 32) continue;
		value = value * 8 + (charCode - 48);
	}
	return value;
}
function readNumeric(view, offset, size) {
	if (view[offset] & 128) {
		let result = 0;
		result = view[offset] & 127;
		for (let i = 1; i < size; i++) result = result * 256 + view[offset + i];
		if (!Number.isSafeInteger(result)) throw new Error("TAR number too large");
		return result;
	}
	return readOctal(view, offset, size);
}
//#endregion
//#region src/tar/body.ts
const isBodyless = (header) => header.type === "directory" || header.type === "symlink" || header.type === "link" || header.type === "character-device" || header.type === "block-device" || header.type === "fifo";
async function normalizeBody(body) {
	if (body === null || body === void 0) return EMPTY;
	if (body instanceof Uint8Array) return body;
	if (typeof body === "string") return encoder.encode(body);
	if (body instanceof ArrayBuffer) return new Uint8Array(body);
	if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
	throw new TypeError("Unsupported content type for entry body.");
}
//#endregion
//#region src/tar/options.ts
const stripPath = (p, n) => {
	const parts = p.split("/").filter(Boolean);
	return n >= parts.length ? "" : parts.slice(n).join("/");
};
function transformHeader(header, options) {
	const { strip, filter, map } = options;
	if (!strip && !filter && !map) return header;
	const h = { ...header };
	if (strip && strip > 0) {
		const newName = stripPath(h.name, strip);
		if (!newName) return null;
		h.name = h.type === "directory" && !newName.endsWith("/") ? `${newName}/` : newName;
		if (h.linkname) {
			const isAbsolute = h.linkname.startsWith("/");
			if (isAbsolute || h.type === "link") {
				const stripped = stripPath(h.linkname, strip);
				h.linkname = isAbsolute ? `/${stripped}` || "/" : stripped;
			}
		}
	}
	if (filter?.(h) === false) return null;
	const result = map ? map(h) : h;
	if (result && (!result.name || !result.name.trim() || result.name === "." || result.name === "/")) return null;
	return result;
}
//#endregion
//#region src/tar/checksum.ts
const CHECKSUM_SPACE = 32;
const ASCII_ZERO = 48;
function validateChecksum(block) {
	const stored = readOctal(block, 148, 8);
	let sum = 0;
	for (let i = 0; i < block.length; i++) if (i >= 148 && i < 156) sum += CHECKSUM_SPACE;
	else sum += block[i];
	return stored === sum;
}
function writeChecksum(block) {
	block.fill(CHECKSUM_SPACE, 148, 156);
	let checksum = 0;
	for (const byte of block) checksum += byte;
	for (let i = 153; i >= 148; i--) {
		block[i] = (checksum & 7) + ASCII_ZERO;
		checksum >>= 3;
	}
	block[154] = 0;
	block[155] = CHECKSUM_SPACE;
}
//#endregion
//#region src/tar/pax.ts
const USTAR_SPLIT_MAX_SIZE = 256;
function generatePax(header) {
	const paxRecords = {};
	if (encoder.encode(header.name).length > 100) {
		if (findUstarSplit(header.name) === null) paxRecords.path = header.name;
	}
	if (header.linkname && encoder.encode(header.linkname).length > 100) paxRecords.linkpath = header.linkname;
	if (header.uname && encoder.encode(header.uname).length > 32) paxRecords.uname = header.uname;
	if (header.gname && encoder.encode(header.gname).length > 32) paxRecords.gname = header.gname;
	if (header.uid != null && header.uid > 2097151) paxRecords.uid = String(header.uid);
	if (header.gid != null && header.gid > 2097151) paxRecords.gid = String(header.gid);
	if (header.size != null && header.size > 8589934591) paxRecords.size = String(header.size);
	if (header.pax) Object.assign(paxRecords, header.pax);
	const paxEntries = Object.entries(paxRecords);
	if (paxEntries.length === 0) return null;
	const paxBody = encoder.encode(paxEntries.map(([key, value]) => {
		const record = `${key}=${value}\n`;
		const partLength = encoder.encode(record).length + 1;
		let totalLength = partLength + String(partLength).length;
		totalLength = partLength + String(totalLength).length;
		return `${totalLength} ${record}`;
	}).join(""));
	return {
		paxHeader: createTarHeader({
			name: decoder.decode(encoder.encode(`PaxHeader/${header.name}`).slice(0, 100)),
			size: paxBody.length,
			type: "pax-header",
			mode: 420,
			mtime: header.mtime,
			uname: header.uname,
			gname: header.gname,
			uid: header.uid,
			gid: header.gid
		}),
		paxBody
	};
}
function findUstarSplit(path) {
	const totalPathBytes = encoder.encode(path).length;
	if (totalPathBytes <= 100 || totalPathBytes > USTAR_SPLIT_MAX_SIZE) return null;
	for (let i = path.length - 1; i > 0; i--) {
		if (path[i] !== "/") continue;
		const prefix = path.slice(0, i);
		const name = path.slice(i + 1);
		if (encoder.encode(prefix).length <= 155 && encoder.encode(name).length <= 100) return {
			prefix,
			name
		};
	}
	return null;
}
//#endregion
//#region src/tar/header.ts
function createTarHeader(header) {
	const view = new Uint8Array(512);
	const size = isBodyless(header) ? 0 : header.size ?? 0;
	let name = header.name;
	let prefix = "";
	if (!header.pax?.path) {
		const split = findUstarSplit(name);
		if (split) {
			name = split.name;
			prefix = split.prefix;
		}
	}
	writeString(view, 0, 100, name);
	writeOctal(view, 100, 8, header.mode ?? (header.type === "directory" ? 493 : 420));
	writeOctal(view, 108, 8, header.uid ?? 0);
	writeOctal(view, 116, 8, header.gid ?? 0);
	writeOctal(view, 124, 12, size);
	writeOctal(view, 136, 12, Math.floor((header.mtime?.getTime() ?? Date.now()) / 1e3));
	writeString(view, 156, 1, TYPEFLAG[header.type ?? "file"]);
	writeString(view, 157, 100, header.linkname);
	writeString(view, 257, 6, "ustar\0");
	writeString(view, 263, 2, "00");
	writeString(view, 265, 32, header.uname);
	writeString(view, 297, 32, header.gname);
	writeString(view, 345, 155, prefix);
	writeChecksum(view);
	return view;
}
function parseUstarHeader(block, strict) {
	if (strict && !validateChecksum(block)) throw new Error("Invalid tar header checksum.");
	const typeflag = readString(block, 156, 1);
	const header = {
		name: readString(block, 0, 100),
		mode: readOctal(block, 100, 8),
		uid: readNumeric(block, 108, 8),
		gid: readNumeric(block, 116, 8),
		size: readNumeric(block, 124, 12),
		mtime: /* @__PURE__ */ new Date(readNumeric(block, 136, 12) * 1e3),
		type: FLAGTYPE[typeflag] || "file",
		linkname: readString(block, 157, 100)
	};
	const magic = readString(block, 257, 6);
	if (isBodyless(header)) header.size = 0;
	if (magic.trim() === "ustar") {
		header.uname = readString(block, 265, 32);
		header.gname = readString(block, 297, 32);
	}
	if (magic === "ustar") header.prefix = readString(block, 345, 155);
	return header;
}
const PAX_MAPPING = {
	path: ["name", (v) => v],
	linkpath: ["linkname", (v) => v],
	size: ["size", (v) => parseInt(v, 10)],
	mtime: ["mtime", parseFloat],
	uid: ["uid", (v) => parseInt(v, 10)],
	gid: ["gid", (v) => parseInt(v, 10)],
	uname: ["uname", (v) => v],
	gname: ["gname", (v) => v]
};
function parsePax(buffer) {
	const decoder = new TextDecoder("utf-8");
	const overrides = Object.create(null);
	const pax = Object.create(null);
	let offset = 0;
	while (offset < buffer.length) {
		const spaceIndex = buffer.indexOf(32, offset);
		if (spaceIndex === -1) break;
		const length = parseInt(decoder.decode(buffer.subarray(offset, spaceIndex)), 10);
		if (Number.isNaN(length) || length === 0) break;
		const recordEnd = offset + length;
		const [key, value] = decoder.decode(buffer.subarray(spaceIndex + 1, recordEnd - 1)).split("=", 2);
		if (key && value !== void 0) {
			pax[key] = value;
			if (Object.hasOwn(PAX_MAPPING, key)) {
				const [targetKey, parser] = PAX_MAPPING[key];
				const parsedValue = parser(value);
				if (typeof parsedValue === "string" || !Number.isNaN(parsedValue)) overrides[targetKey] = parsedValue;
			}
		}
		offset = recordEnd;
	}
	if (Object.keys(pax).length > 0) overrides.pax = pax;
	return overrides;
}
function applyOverrides(header, overrides) {
	if (overrides.name !== void 0) header.name = overrides.name;
	if (overrides.linkname !== void 0) header.linkname = overrides.linkname;
	if (overrides.size !== void 0) header.size = overrides.size;
	if (overrides.mtime !== void 0) header.mtime = /* @__PURE__ */ new Date(overrides.mtime * 1e3);
	if (overrides.uid !== void 0) header.uid = overrides.uid;
	if (overrides.gid !== void 0) header.gid = overrides.gid;
	if (overrides.uname !== void 0) header.uname = overrides.uname;
	if (overrides.gname !== void 0) header.gname = overrides.gname;
	if (overrides.pax) header.pax = Object.assign({}, header.pax ?? {}, overrides.pax);
}
function getMetaParser(type) {
	switch (type) {
		case "pax-global-header":
		case "pax-header": return parsePax;
		case "gnu-long-name": return (data) => ({ name: readString(data, 0, data.length) });
		case "gnu-long-link-name": return (data) => ({ linkname: readString(data, 0, data.length) });
		default: return;
	}
}
function getHeaderBlocks(header) {
	const base = createTarHeader(header);
	const pax = generatePax(header);
	if (!pax) return [base];
	const paxPadding = -pax.paxBody.length & 511;
	const paddingBlocks = paxPadding > 0 ? [ZERO_BLOCK.subarray(0, paxPadding)] : [];
	return [
		pax.paxHeader,
		pax.paxBody,
		...paddingBlocks,
		base
	];
}
//#endregion
//#region src/tar/packer.ts
const EOF_BUFFER = new Uint8Array(512 * 2);
function createTarPacker(onData, onError, onFinalize) {
	let currentHeader = null;
	let bytesWritten = 0;
	let finalized = false;
	const fail = (message) => {
		const error = new Error(message);
		onError(error);
		throw error;
	};
	return {
		add(header) {
			if (finalized) fail("No new tar entries after finalize.");
			if (currentHeader !== null) fail("Previous entry must be completed before adding a new one");
			const size = isBodyless(header) ? 0 : header.size;
			if (!Number.isSafeInteger(size) || size < 0) fail("Invalid tar entry size.");
			try {
				const headerBlocks = getHeaderBlocks({
					...header,
					size
				});
				for (const block of headerBlocks) onData(block);
				currentHeader = {
					...header,
					size
				};
				bytesWritten = 0;
			} catch (error) {
				onError(error);
			}
		},
		write(chunk) {
			if (!currentHeader) fail("No active tar entry.");
			if (finalized) fail("Cannot write data after finalize.");
			const newTotal = bytesWritten + chunk.length;
			if (newTotal > currentHeader.size) fail(`"${currentHeader.name}" exceeds given size of ${currentHeader.size} bytes.`);
			try {
				bytesWritten = newTotal;
				onData(chunk);
			} catch (error) {
				onError(error);
			}
		},
		endEntry() {
			if (!currentHeader) fail("No active entry to end.");
			if (finalized) fail("Cannot end entry after finalize.");
			try {
				if (bytesWritten !== currentHeader.size) fail(`Size mismatch for "${currentHeader.name}".`);
				const paddingSize = -currentHeader.size & 511;
				if (paddingSize > 0) onData(new Uint8Array(paddingSize));
				currentHeader = null;
				bytesWritten = 0;
			} catch (error) {
				onError(error);
				throw error;
			}
		},
		finalize() {
			if (finalized) fail("Archive has already been finalized");
			if (currentHeader !== null) fail("Cannot finalize while an entry is still active");
			try {
				onData(EOF_BUFFER);
				finalized = true;
				if (onFinalize) onFinalize();
			} catch (error) {
				onError(error);
			}
		}
	};
}
//#endregion
//#region src/tar/chunk-queue.ts
const INITIAL_CAPACITY = 256;
function createChunkQueue() {
	let chunks = new Array(INITIAL_CAPACITY);
	let capacityMask = chunks.length - 1;
	let head = 0;
	let tail = 0;
	let totalAvailable = 0;
	const consumeFromHead = (count) => {
		const chunk = chunks[head];
		if (count === chunk.length) {
			chunks[head] = EMPTY;
			head = head + 1 & capacityMask;
		} else chunks[head] = chunk.subarray(count);
		totalAvailable -= count;
		if (totalAvailable === 0 && chunks.length > INITIAL_CAPACITY) {
			chunks = new Array(INITIAL_CAPACITY);
			capacityMask = INITIAL_CAPACITY - 1;
			head = 0;
			tail = 0;
		}
	};
	function pull(bytes, callback) {
		if (callback) {
			let fed = 0;
			let remaining = Math.min(bytes, totalAvailable);
			while (remaining > 0) {
				const chunk = chunks[head];
				const toFeed = Math.min(remaining, chunk.length);
				const segment = toFeed === chunk.length ? chunk : chunk.subarray(0, toFeed);
				consumeFromHead(toFeed);
				remaining -= toFeed;
				fed += toFeed;
				if (!callback(segment)) break;
			}
			return fed;
		}
		if (totalAvailable < bytes) return null;
		if (bytes === 0) return EMPTY;
		const firstChunk = chunks[head];
		if (firstChunk.length >= bytes) {
			const view = firstChunk.length === bytes ? firstChunk : firstChunk.subarray(0, bytes);
			consumeFromHead(bytes);
			return view;
		}
		const result = new Uint8Array(bytes);
		let copied = 0;
		let remaining = bytes;
		while (remaining > 0) {
			const chunk = chunks[head];
			const toCopy = Math.min(remaining, chunk.length);
			result.set(toCopy === chunk.length ? chunk : chunk.subarray(0, toCopy), copied);
			copied += toCopy;
			remaining -= toCopy;
			consumeFromHead(toCopy);
		}
		return result;
	}
	return {
		push: (chunk) => {
			if (chunk.length === 0) return;
			let nextTail = tail + 1 & capacityMask;
			if (nextTail === head) {
				const oldLen = chunks.length;
				const newLen = oldLen * 2;
				const newChunks = new Array(newLen);
				const count = tail - head + oldLen & oldLen - 1;
				if (head < tail) for (let i = 0; i < count; i++) newChunks[i] = chunks[head + i];
				else if (count > 0) {
					const firstPart = oldLen - head;
					for (let i = 0; i < firstPart; i++) newChunks[i] = chunks[head + i];
					for (let i = 0; i < tail; i++) newChunks[firstPart + i] = chunks[i];
				}
				chunks = newChunks;
				capacityMask = newLen - 1;
				head = 0;
				tail = count;
				nextTail = tail + 1 & capacityMask;
			}
			chunks[tail] = chunk;
			tail = nextTail;
			totalAvailable += chunk.length;
		},
		available: () => totalAvailable,
		peek: (bytes) => {
			if (totalAvailable < bytes) return null;
			if (bytes === 0) return EMPTY;
			const firstChunk = chunks[head];
			if (firstChunk.length >= bytes) return firstChunk.length === bytes ? firstChunk : firstChunk.subarray(0, bytes);
			const result = new Uint8Array(bytes);
			let copied = 0;
			let index = head;
			while (copied < bytes) {
				const chunk = chunks[index];
				const toCopy = Math.min(bytes - copied, chunk.length);
				if (toCopy === chunk.length) result.set(chunk, copied);
				else result.set(chunk.subarray(0, toCopy), copied);
				copied += toCopy;
				index = index + 1 & capacityMask;
			}
			return result;
		},
		discard: (bytes) => {
			if (bytes > totalAvailable) throw new Error("Too many bytes consumed");
			if (bytes === 0) return;
			let remaining = bytes;
			while (remaining > 0) {
				const chunk = chunks[head];
				const toConsume = Math.min(remaining, chunk.length);
				consumeFromHead(toConsume);
				remaining -= toConsume;
			}
		},
		pull
	};
}
//#endregion
//#region src/tar/unpacker.ts
const STATE_HEADER = 0;
const STATE_BODY = 1;
const truncateErr = /* @__PURE__ */ new Error("Tar archive is truncated.");
function createUnpacker(options = {}) {
	const strict = options.strict ?? false;
	const { available, peek, push, discard, pull } = createChunkQueue();
	let state = STATE_HEADER;
	let ended = false;
	let done = false;
	let eof = false;
	let currentEntry = null;
	const paxGlobals = {};
	let nextEntryOverrides = {};
	const unpacker = {
		isEntryActive: () => state === STATE_BODY,
		isBodyComplete: () => !currentEntry || currentEntry.remaining === 0,
		canFinish: () => !currentEntry || available() >= currentEntry.remaining + currentEntry.padding,
		write(chunk) {
			if (ended) throw new Error("Archive already ended.");
			push(chunk);
		},
		end() {
			ended = true;
		},
		readHeader() {
			if (state !== STATE_HEADER) throw new Error("Cannot read header while an entry is active");
			if (done) return void 0;
			while (!done) {
				if (available() < 512) {
					if (ended) {
						if (available() > 0 && strict) throw truncateErr;
						done = true;
						return;
					}
					return null;
				}
				const headerBlock = peek(512);
				if (isZeroBlock(headerBlock)) {
					if (available() < 512 * 2) {
						if (ended) {
							if (strict) throw truncateErr;
							done = true;
							return;
						}
						return null;
					}
					if (isZeroBlock(peek(512 * 2).subarray(512))) {
						discard(512 * 2);
						done = true;
						eof = true;
						return;
					}
					if (strict) throw new Error("Invalid tar header.");
					discard(512);
					continue;
				}
				let internalHeader;
				try {
					internalHeader = parseUstarHeader(headerBlock, strict);
				} catch (err) {
					if (strict) throw err;
					discard(512);
					continue;
				}
				const metaParser = getMetaParser(internalHeader.type);
				if (metaParser) {
					const paddedSize = internalHeader.size + (-internalHeader.size & 511);
					if (available() < 512 + paddedSize) {
						if (ended && strict) throw truncateErr;
						return null;
					}
					discard(512);
					const overrides = metaParser(pull(paddedSize).subarray(0, internalHeader.size));
					const target = internalHeader.type === "pax-global-header" ? paxGlobals : nextEntryOverrides;
					for (const key in overrides) target[key] = overrides[key];
					continue;
				}
				discard(512);
				const header = internalHeader;
				if (internalHeader.prefix) header.name = `${internalHeader.prefix}/${header.name}`;
				applyOverrides(header, paxGlobals);
				applyOverrides(header, nextEntryOverrides);
				if (header.name.endsWith("/") && header.type === "file") header.type = DIRECTORY;
				nextEntryOverrides = {};
				currentEntry = {
					header,
					remaining: header.size,
					padding: -header.size & 511
				};
				state = STATE_BODY;
				return header;
			}
		},
		streamBody(callback) {
			if (state !== STATE_BODY || !currentEntry || currentEntry.remaining === 0) return 0;
			const bytesToFeed = Math.min(currentEntry.remaining, available());
			if (bytesToFeed === 0) return 0;
			const fed = pull(bytesToFeed, callback);
			currentEntry.remaining -= fed;
			return fed;
		},
		skipPadding() {
			if (state !== STATE_BODY || !currentEntry) return true;
			if (currentEntry.remaining > 0) throw new Error("Body not fully consumed");
			if (available() < currentEntry.padding) return false;
			discard(currentEntry.padding);
			currentEntry = null;
			state = STATE_HEADER;
			return true;
		},
		skipEntry() {
			if (state !== STATE_BODY || !currentEntry) return true;
			const toDiscard = Math.min(currentEntry.remaining, available());
			if (toDiscard > 0) {
				discard(toDiscard);
				currentEntry.remaining -= toDiscard;
			}
			if (currentEntry.remaining > 0) return false;
			return unpacker.skipPadding();
		},
		validateEOF() {
			if (strict) {
				if (!eof) throw truncateErr;
				if (available() > 0) {
					if (pull(available()).some((byte) => byte !== 0)) throw new Error("Invalid EOF.");
				}
			}
		}
	};
	return unpacker;
}
function isZeroBlock(block) {
	if (block.byteOffset % 8 === 0) {
		const view = new BigUint64Array(block.buffer, block.byteOffset, block.length / 8);
		for (let i = 0; i < view.length; i++) if (view[i] !== 0n) return false;
		return true;
	}
	for (let i = 0; i < block.length; i++) if (block[i] !== 0) return false;
	return true;
}
//#endregion
export { normalizeBody as a, LINK as c, isBodyless as i, SYMLINK as l, createTarPacker as n, DIRECTORY as o, transformHeader as r, FILE as s, createUnpacker as t };
