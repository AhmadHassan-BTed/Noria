import { a as normalizeBody, i as isBodyless, n as createTarPacker$1, r as transformHeader, t as createUnpacker } from "../unpacker-CPCEF5CT.js";
//#region src/web/compression.ts
function createGzipEncoder() {
	return new CompressionStream("gzip");
}
function createGzipDecoder() {
	return new DecompressionStream("gzip");
}
//#endregion
//#region src/web/pack.ts
function createTarPacker() {
	let streamController;
	let packer;
	return {
		readable: new ReadableStream({ start(controller) {
			streamController = controller;
			packer = createTarPacker$1(controller.enqueue.bind(controller), controller.error.bind(controller), controller.close.bind(controller));
		} }),
		controller: {
			add(header) {
				const bodyless = isBodyless(header);
				packer.add(header);
				if (bodyless) packer.endEntry();
				return new WritableStream({
					write(chunk) {
						packer.write(chunk);
					},
					close() {
						if (!bodyless) packer.endEntry();
					},
					abort(reason) {
						streamController.error(reason);
					}
				});
			},
			finalize() {
				packer.finalize();
			},
			error(err) {
				streamController.error(err);
			}
		}
	};
}
//#endregion
//#region src/web/stream-utils.ts
async function streamToBuffer(stream) {
	const chunks = [];
	const reader = stream.getReader();
	let totalLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			totalLength += value.length;
		}
		const result = new Uint8Array(totalLength);
		let offset = 0;
		for (const chunk of chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		return result;
	} finally {
		reader.releaseLock();
	}
}
const drain = (stream) => stream.pipeTo(new WritableStream());
//#endregion
//#region src/web/unpack.ts
function createTarDecoder(options = {}) {
	const unpacker = createUnpacker(options);
	const strict = options.strict ?? false;
	let controller = null;
	let bodyController = null;
	let pumping = false;
	let eofReached = false;
	let sourceEnded = false;
	let closed = false;
	const closeBody = () => {
		try {
			bodyController?.close();
		} catch {}
		bodyController = null;
	};
	const fail = (reason) => {
		if (closed) return;
		closed = true;
		try {
			bodyController?.error(reason);
		} catch {}
		bodyController = null;
		try {
			controller.error(reason);
		} catch {}
		controller = null;
	};
	const finish = () => {
		if (closed) return;
		closed = true;
		closeBody();
		try {
			controller.close();
		} catch {}
		controller = null;
	};
	const truncateOrFinish = () => {
		if (strict) throw new Error("Tar archive is truncated.");
		finish();
	};
	const pump = () => {
		if (pumping || closed || !controller) return;
		pumping = true;
		try {
			while (true) {
				if (eofReached) {
					if (sourceEnded) {
						unpacker.validateEOF();
						finish();
					}
					break;
				}
				if (unpacker.isEntryActive()) {
					if (sourceEnded && !unpacker.canFinish()) {
						truncateOrFinish();
						break;
					}
					if (bodyController) {
						if ((bodyController.desiredSize ?? 1) <= 0) break;
						if (unpacker.streamBody((c) => (bodyController.enqueue(c), (bodyController.desiredSize ?? 1) > 0)) === 0 && !unpacker.isBodyComplete()) {
							if (sourceEnded) truncateOrFinish();
							break;
						}
					} else if (!unpacker.skipEntry()) {
						if (sourceEnded) truncateOrFinish();
						break;
					}
					if (unpacker.isBodyComplete()) {
						closeBody();
						if (!unpacker.skipPadding()) {
							if (sourceEnded) truncateOrFinish();
							break;
						}
					}
				} else {
					if ((controller.desiredSize ?? 0) < 0) break;
					const header = unpacker.readHeader();
					if (header === null) {
						if (sourceEnded) finish();
						break;
					}
					if (header === void 0) {
						if (sourceEnded) {
							unpacker.validateEOF();
							finish();
							break;
						}
						eofReached = true;
						break;
					}
					controller.enqueue({
						header,
						body: new ReadableStream({
							start(c) {
								if (header.size === 0) c.close();
								else bodyController = c;
							},
							pull: pump,
							cancel() {
								bodyController = null;
								pump();
							}
						})
					});
				}
			}
		} catch (error) {
			fail(error);
			throw error;
		} finally {
			pumping = false;
		}
	};
	return {
		readable: new ReadableStream({
			start(c) {
				controller = c;
			},
			pull: pump,
			cancel(reason) {
				if (reason !== void 0) fail(reason);
				else finish();
			}
		}, { highWaterMark: 2 }),
		writable: new WritableStream({
			write(chunk) {
				try {
					if (eofReached && strict && chunk.some((byte) => byte !== 0)) throw new Error("Invalid EOF.");
					unpacker.write(chunk);
					pump();
				} catch (error) {
					fail(error);
					throw error;
				}
			},
			close() {
				try {
					sourceEnded = true;
					unpacker.end();
					pump();
				} catch (error) {
					fail(error);
					throw error;
				}
			},
			abort(reason) {
				fail(reason);
			}
		})
	};
}
//#endregion
//#region src/web/helpers.ts
async function packTar(entries) {
	const { readable, controller } = createTarPacker();
	await (async () => {
		for (const entry of entries) {
			const entryStream = controller.add(entry.header);
			const body = "body" in entry ? entry.body : entry.data;
			if (!body) {
				await entryStream.close();
				continue;
			}
			if (body instanceof ReadableStream) await body.pipeTo(entryStream);
			else if (body instanceof Blob) await body.stream().pipeTo(entryStream);
			else try {
				const chunk = await normalizeBody(body);
				if (chunk.length > 0) {
					const writer = entryStream.getWriter();
					await writer.write(chunk);
					await writer.close();
				} else await entryStream.close();
			} catch {
				throw new TypeError(`Unsupported content type for entry "${entry.header.name}".`);
			}
		}
	})().then(() => controller.finalize()).catch((err) => controller.error(err));
	return new Uint8Array(await streamToBuffer(readable));
}
async function unpackTar(archive, options = {}) {
	const sourceStream = archive instanceof ReadableStream ? archive : new ReadableStream({ start(controller) {
		controller.enqueue(archive instanceof Uint8Array ? archive : new Uint8Array(archive));
		controller.close();
	} });
	const results = [];
	const entryStream = sourceStream.pipeThrough(createTarDecoder(options));
	for await (const entry of entryStream) {
		let processedHeader;
		try {
			processedHeader = transformHeader(entry.header, options);
		} catch (error) {
			await entry.body.cancel();
			throw error;
		}
		if (processedHeader === null) {
			await drain(entry.body);
			continue;
		}
		if (isBodyless(processedHeader)) {
			await drain(entry.body);
			results.push({ header: processedHeader });
		} else results.push({
			header: processedHeader,
			data: await streamToBuffer(entry.body)
		});
	}
	return results;
}
//#endregion
export { createGzipDecoder, createGzipEncoder, createTarDecoder, createTarPacker, packTar, unpackTar };
