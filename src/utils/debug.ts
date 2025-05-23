export const DEBUG = false;
export function debugLog(...args: unknown[]) {
  if (DEBUG) {
    console.log(...args);
  }
}

