declare function long2ip(long: number): string;
declare function ip2long(ip: string): number;
declare class Netmask4Impl {
    maskLong: number;
    bitmask: number;
    netLong: number;
    size: number;
    base: string;
    mask: string;
    hostmask: string;
    first: string;
    last: string;
    broadcast: string | undefined;
    constructor(net: string, mask?: string | number);
    contains(ip: string | Netmask4Impl): boolean;
    next(count?: number): Netmask4Impl;
    forEach(fn: (ip: string, long: number, index: number) => void): void;
    toString(): string;
}
export { ip2long, long2ip, Netmask4Impl };
