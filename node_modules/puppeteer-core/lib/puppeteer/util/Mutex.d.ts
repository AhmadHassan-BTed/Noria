import { disposeSymbol } from './disposable.js';
/**
 * @internal
 */
declare class MutexGuard {
    #private;
    constructor(mutex: Mutex, onRelease?: () => void);
    [disposeSymbol](): void;
}
/**
 * @internal
 */
export declare class Mutex {
    #private;
    static Guard: typeof MutexGuard;
    acquire(onRelease?: () => void): Promise<InstanceType<typeof Mutex.Guard>>;
    release(): void;
}
export {};
//# sourceMappingURL=Mutex.d.ts.map