import { Address4 } from './ipv4';
import { Address6 } from './ipv6';
export interface ReverseFormOptions {
    omitSuffix?: boolean;
}
export declare function isInSubnet(this: Address4 | Address6, address: Address4 | Address6): boolean;
export declare function isCorrect(defaultBits: number): (this: Address4 | Address6) => boolean;
/**
 * Returns the prefix length (number of leading 1 bits) of a contiguous
 * subnet mask. Throws `AddressError` if the mask is non-contiguous (e.g.
 * `255.0.255.0`).
 */
export declare function prefixLengthFromMask(value: bigint, totalBits: number): number;
export declare function numberToPaddedHex(number: number): string;
export declare function stringToPaddedHex(numberString: string): string;
/**
 * @param binaryValue Binary representation of a value (e.g. `10`)
 * @param position Byte position, where 0 is the least significant bit
 */
export declare function testBit(binaryValue: string, position: number): boolean;
