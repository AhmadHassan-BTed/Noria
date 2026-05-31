import { ip2long, long2ip } from './netmask4';
declare class Netmask {
    base: string;
    mask: string;
    hostmask: string;
    bitmask: number;
    maskLong: number;
    netLong: number;
    size: number;
    first: string;
    last: string;
    broadcast: string | undefined;
    private _impl;
    constructor(net: string, mask?: string | number);
    contains(ip: string | Netmask): boolean;
    next(count?: number): Netmask;
    /** @deprecated */
    forEach(fn: (ip: string, long: number, index: number) => void): void;
    toString(): string;
}
export { Netmask, ip2long, long2ip };
