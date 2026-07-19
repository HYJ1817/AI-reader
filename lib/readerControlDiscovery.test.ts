import { describe, expect, it, vi } from "vitest";
import {
  READER_CONTROL_DISCOVERY_KEY,
  markReaderControlsDiscovered,
  shouldDiscoverReaderControls,
  type ReaderControlDiscoveryStorage,
} from "./readerControlDiscovery";

function createStorage(value: string | null = null) {
  const values = new Map<string, string>();
  if (value !== null) values.set(READER_CONTROL_DISCOVERY_KEY, value);
  const storage: ReaderControlDiscoveryStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, nextValue: string) => {
      values.set(key, nextValue);
    }),
  };
  return { storage, values };
}

describe("reader control discovery persistence", () => {
  it("requires discovery when the local marker is absent", () => {
    const { storage } = createStorage();
    expect(shouldDiscoverReaderControls(storage)).toBe(true);
  });

  it("skips discovery after it was recorded", () => {
    const { storage } = createStorage("true");
    expect(shouldDiscoverReaderControls(storage)).toBe(false);
  });

  it("records discovery with the versioned key", () => {
    const { storage, values } = createStorage();
    markReaderControlsDiscovered(storage);
    expect(values.get(READER_CONTROL_DISCOVERY_KEY)).toBe("true");
  });

  it("degrades to returning-user behavior when storage throws", () => {
    const storage: ReaderControlDiscoveryStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(shouldDiscoverReaderControls(storage)).toBe(false);
    expect(() => markReaderControlsDiscovered(storage)).not.toThrow();
  });
});
