import { Writable } from "stream";
import { StringEncoding } from "./StringEncoding";
export declare class StringWriter extends Writable {
    protected maxByteLength: number;
    protected byteLength: number;
    protected bufs: Buffer<ArrayBuffer>[];
    constructor(maxByteLength?: number);
    _write(chunk: Buffer | string | any, _: string, callback: (error: Error | null) => void): void;
    getText(encoding: StringEncoding): string;
}
