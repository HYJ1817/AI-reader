import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { triggerBlobDownload } from "./browserDownload";

describe("triggerBlobDownload", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let click: ReturnType<typeof vi.fn>;
  let anchor: {
    download: string;
    href: string;
    remove: ReturnType<typeof vi.fn>;
    style: { display: string };
    click: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL = vi.fn(() => "blob:download-url");
    revokeObjectURL = vi.fn();
    click = vi.fn();
    anchor = {
      download: "",
      href: "",
      remove: vi.fn(),
      style: { display: "" },
      click,
    };
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
      },
      createElement: vi.fn(() => anchor),
      querySelector: vi.fn(() => anchor),
    });
    vi.stubGlobal("window", {
      setTimeout,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the blob URL alive until after the browser has started the download", () => {
    const blob = new Blob(["hello"], { type: "text/plain" });

    triggerBlobDownload(blob, "book.txt");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-url");
  });

  it("uses a hidden anchor with the requested file name", () => {
    const blob = new Blob(["{}"], { type: "application/json" });

    triggerBlobDownload(blob, "ai-reader-backup.json");

    expect(anchor.href).toBe("blob:download-url");
    expect(anchor.download).toBe("ai-reader-backup.json");
    expect(anchor.style.display).toBe("none");
  });
});
