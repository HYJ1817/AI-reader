import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMBIENT_CROSSFADE_MS,
  acquireAmbientBlobUrl,
  completeAmbientTransition,
  createAmbientLayer,
  createInitialAmbientTransitionState,
  releaseAmbientBlobUrls,
  selectAmbientBlobsToRelease,
  startAmbientTransition,
  type AmbientTransitionState,
} from "./ambientBookBackground";
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

describe("ambient book background state", () => {
  afterEach(() => {
    resetBlobUrlCacheForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("creates normal and deterministic fallback layers", () => {
    expect(createAmbientLayer(null, null)).toEqual({
      key: "ambient:none",
      kind: "empty",
      imageUrl: null,
      paper: null,
      spine: null,
      blob: null,
    });

    const book = makeBook({ title: "A Wizard of Earthsea", format: "txt" });
    const fallback = createAmbientLayer(book, null);
    expect(fallback.kind).toBe("fallback");
    expect({ paper: fallback.paper, spine: fallback.spine }).toEqual(
      createFallbackCoverStyle(book.title, book.format)
    );
  });

  it("ignores an old generation completing during a fast A to B to A sequence", () => {
    vi.useFakeTimers();
    const blobA = new Blob(["cover-a"]);
    const blobB = new Blob(["cover-b"]);
    const layerA = createAmbientLayer(
      makeBook({ id: "a", coverImageBlob: blobA }),
      "blob:a"
    );
    const layerB = createAmbientLayer(
      makeBook({ id: "b", coverImageBlob: blobB }),
      "blob:b"
    );
    let state = startAmbientTransition(
      createInitialAmbientTransitionState(),
      layerA,
      false
    );

    state = startAmbientTransition(state, layerB, false);
    const generationAB = state.generation;
    setTimeout(() => {
      state = completeAmbientTransition(state, generationAB);
    }, AMBIENT_CROSSFADE_MS);

    vi.advanceTimersByTime(100);
    state = startAmbientTransition(state, layerA, false);
    const generationBA = state.generation;
    setTimeout(() => {
      state = completeAmbientTransition(state, generationBA);
    }, AMBIENT_CROSSFADE_MS);

    vi.advanceTimersByTime(AMBIENT_CROSSFADE_MS - 100);
    expect(state.current).toBe(layerA);
    expect(state.previous).toBe(layerB);
    expect(state.generation).toBe(generationBA);
    expect(
      selectAmbientBlobsToRelease([blobA, blobB], state)
    ).toEqual([]);

    vi.advanceTimersByTime(100);
    expect(state.current).toBe(layerA);
    expect(state.previous).toBeNull();
    expect(selectAmbientBlobsToRelease([blobA, blobB], state)).toEqual([
      blobB,
    ]);
  });

  it("converges immediately and invalidates pending motion when reduceMotion turns on", () => {
    const first = createAmbientLayer(makeBook({ id: "a" }), null);
    const second = createAmbientLayer(makeBook({ id: "b" }), null);
    let state = startAmbientTransition(
      createInitialAmbientTransitionState(),
      first,
      false
    );
    state = startAmbientTransition(state, second, false);
    const movingGeneration = state.generation;

    state = startAmbientTransition(state, state.current, true);

    expect(state.previous).toBeNull();
    expect(state.generation).toBeGreaterThan(movingGeneration);
    expect(completeAmbientTransition(state, movingGeneration)).toBe(state);
  });

  it("never releases a different blob that is still current", () => {
    const oldBlob = new Blob(["old"]);
    const currentBlob = new Blob(["current"]);
    const current = createAmbientLayer(
      makeBook({ id: "current", coverImageBlob: currentBlob }),
      "blob:current"
    );
    const state: AmbientTransitionState = {
      current,
      previous: null,
      generation: 4,
    };

    expect(
      selectAmbientBlobsToRelease([oldBlob, currentBlob], state)
    ).toEqual([oldBlob]);
  });

  it("releases every acquired blob on unmount", () => {
    const blobA = new Blob(["a"]);
    const blobB = new Blob(["b"]);

    expect(selectAmbientBlobsToRelease([blobA, blobB], null)).toEqual([
      blobA,
      blobB,
    ]);
  });

  it("acquires each blob once and balances release decisions", () => {
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

    releaseAmbientBlobUrls(
      selectAmbientBlobsToRelease(acquiredUrls.keys(), null),
      acquiredUrls
    );
    vi.runAllTimers();

    expect(acquiredUrls.size).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("keeps the component decorative and wired to the shared lib state machine", () => {
    const source = readFileSync(
      new URL("../app/AmbientBookBackground.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "@/lib/ambientBookBackground"');
    expect(source).toMatch(
      /completeAmbientTransition\(\s*layersRef\.current,\s*generation\s*\)/
    );
    expect(source).toMatch(
      /selectAmbientBlobsToRelease\(\s*acquiredUrlsRef\.current\.keys\(\),\s*layersRef\.current\s*\)/
    );
    expect(source).not.toContain("URL.createObjectURL");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("styles.ambientBookBackground");
    expect(source).toContain("styles.ambientBookLayer");
  });
});
