/**
 * @license
 * Copyright 2026 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Manages one or more concurrent progress bars on separate terminal lines.
 * Use {@link ProgressBar.createBarTicker} to add a bar; concurrent calls
 * automatically share a session so bars don't overwrite each other.
 *
 * @internal
 */
export declare class ProgressBar {
    #private;
    private constructor();
    /**
     * Returns a `tick(delta)` function for a new progress bar. If another bar
     * is already active on the same stream, the new bar appears on the next line
     * and both update in place. The trailing newline is emitted automatically
     * once every bar in the session has reached 100%.
     */
    static createBarTicker(title: string, total: number, stream?: NodeJS.WriteStream): (delta: number) => void;
}
//# sourceMappingURL=ProgressBar.d.ts.map