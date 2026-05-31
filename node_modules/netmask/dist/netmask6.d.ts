declare function ip6bigint(ip: string): bigint;
declare function bigint2ip6(n: bigint): string;
declare class Netmask6Impl {
    netBigint: bigint;
    maskBigint: bigint;
    bitmask: number;
    size: number;
    base: string;
    mask: string;
    hostmask: string;
    first: string;
    last: string;
    broadcast: undefined;
    constructor(net: string, mask?: number);
    contains(ip: string | Netmask6Impl): boolean;
    next(count?: number): Netmask6Impl;
    forEach(fn: (ip: string, long: number, index: number) => void): void;
    toString(): string;
}
export { ip6bigint, bigint2ip6, Netmask6Impl };
