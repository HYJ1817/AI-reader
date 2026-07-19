export const READER_CONTROL_DISCOVERY_KEY =
  "ai-reader-reader-controls-discovered-v1";

export type ReaderControlDiscoveryStorage = Pick<
  Storage,
  "getItem" | "setItem"
>;

function getBrowserStorage(): ReaderControlDiscoveryStorage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function shouldDiscoverReaderControls(
  storage?: ReaderControlDiscoveryStorage
): boolean {
  try {
    const target = storage ?? getBrowserStorage();
    if (!target) return false;
    return target.getItem(READER_CONTROL_DISCOVERY_KEY) !== "true";
  } catch {
    return false;
  }
}

export function markReaderControlsDiscovered(
  storage?: ReaderControlDiscoveryStorage
): void {
  try {
    const target = storage ?? getBrowserStorage();
    target?.setItem(READER_CONTROL_DISCOVERY_KEY, "true");
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}
