import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireBlobUrl,
  releaseBlobUrl,
  resetBlobUrlCacheForTests,
} from "./blobUrlCache";

describe("blobUrlCache", () => {
  afterEach(() => {
    resetBlobUrlCacheForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reuses one object URL while the same blob has multiple consumers", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:cover-1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const blob = new Blob(["cover"]);

    expect(acquireBlobUrl(blob)).toBe("blob:cover-1");
    expect(acquireBlobUrl(blob)).toBe("blob:cover-1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    releaseBlobUrl(blob);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    releaseBlobUrl(blob);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cover-1");
  });

  it("cancels deferred cleanup when a cover returns to the library", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:cover-1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const blob = new Blob(["cover"]);

    expect(acquireBlobUrl(blob)).toBe("blob:cover-1");
    releaseBlobUrl(blob);
    expect(acquireBlobUrl(blob)).toBe("blob:cover-1");
    vi.runAllTimers();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
