import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import AmbientBookBackground, {
  acquireAmbientBlobUrl,
  createAmbientLayer,
  findRetiredAmbientBlobs,
  releaseAmbientBlobUrls,
  transitionAmbientLayers,
  type AmbientLayerState,
} from "../app/AmbientBookBackground";
import { resetBlobUrlCacheForTests } from "./blobUrlCache";
import { createFallbackCoverStyle } from "./bookCoverStyle";
import type { BookRecord } from "./db";

function makeBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: "book-1",
    title: "The Left Hand of Darkness",
    format: "epub",
    fileName: "left-hand.epub",
    fileBlob: new Blob(["book"]),
    size: 4,
    createdAt: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("ambient book background", () => {
  afterEach(() => {
    resetBlobUrlCacheForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates a normal background layer when no book is selected", () => {
    expect(createAmbientLayer(null, null)).toEqual({
      key: "ambient:none",
      kind: "empty",
      imageUrl: null,
      paper: null,
      spine: null,
      blob: null,
    });
  });

  it("reuses the deterministic fallback cover palette", () => {
    const book = makeBook({ title: "A Wizard of Earthsea", format: "txt" });
    const layer = createAmbientLayer(book, null);

    expect(layer.kind).toBe("fallback");
    expect({ paper: layer.paper, spine: layer.spine }).toEqual(
      createFallbackCoverStyle(book.title, book.format)
    );
  });

  it("keeps only the outgoing and incoming layers for one crossfade", () => {
    const first = createAmbientLayer(makeBook(), null);
    const second = createAmbientLayer(
      makeBook({
        id: "book-2",
        title: "The Dispossessed",
        coverImageBlob: new Blob(["cover"]),
      }),
      "blob:cover-2"
    );
    const initial: AmbientLayerState = {
      current: createAmbientLayer(null, null),
      previous: null,
    };

    const firstState = transitionAmbientLayers(initial, first, false);
    const secondState = transitionAmbientLayers(firstState, second, false);

    expect(secondState).toEqual({ current: second, previous: first });
  });

  it("replaces immediately when reduced motion is enabled", () => {
    const first = createAmbientLayer(makeBook(), null);
    const second = createAmbientLayer(
      makeBook({ id: "book-2", title: "The Dispossessed" }),
      null
    );
    const state: AmbientLayerState = { current: first, previous: null };

    expect(transitionAmbientLayers(state, second, true)).toEqual({
      current: second,
      previous: null,
    });
  });

  it("retires only blobs that are no longer displayed", () => {
    const sharedBlob = new Blob(["shared cover"]);
    const oldBlob = new Blob(["old cover"]);
    const before: AmbientLayerState = {
      current: createAmbientLayer(
        makeBook({ coverImageBlob: sharedBlob }),
        "blob:shared"
      ),
      previous: createAmbientLayer(
        makeBook({ id: "old", coverImageBlob: oldBlob }),
        "blob:old"
      ),
    };
    const after: AmbientLayerState = {
      current: createAmbientLayer(
        makeBook({ id: "new", coverImageBlob: sharedBlob }),
        "blob:shared"
      ),
      previous: null,
    };

    expect(findRetiredAmbientBlobs(before, after)).toEqual([oldBlob]);
  });

  it("acquires each displayed blob once and balances its release", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:ambient-cover");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const blob = new Blob(["cover"]);
    const acquiredUrls = new Map<Blob, string>();

    expect(acquireAmbientBlobUrl(blob, acquiredUrls)).toBe(
      "blob:ambient-cover"
    );
    expect(acquireAmbientBlobUrl(blob, acquiredUrls)).toBe(
      "blob:ambient-cover"
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    releaseAmbientBlobUrls([blob], acquiredUrls);
    vi.runAllTimers();

    expect(acquiredUrls.size).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("renders decorative current-layer markup", () => {
    const markup = renderToStaticMarkup(
      createElement(AmbientBookBackground, {
        book: null,
        reduceMotion: false,
      })
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-layer="current"');
  });

  it("uses the shared URL cache and exposes the CSS layer contract", () => {
    const source = readFileSync(
      new URL("../app/AmbientBookBackground.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("acquireBlobUrl");
    expect(source).toContain("releaseBlobUrl");
    expect(source).toContain("createFallbackCoverStyle");
    expect(source).not.toContain("URL.createObjectURL");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("styles.ambientBookBackground");
    expect(source).toContain("styles.ambientBookLayer");
  });
});
