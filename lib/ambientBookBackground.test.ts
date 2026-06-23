import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMBIENT_CROSSFADE_MS,
  completeAmbientTransition,
  createAmbientBlobUrlRegistry,
  createAmbientLayer,
  createInitialAmbientTransitionState,
  selectAmbientBlobsToRelease,
  startAmbientTransition,
  type AmbientTransitionState,
} from "./ambientBookBackground";
import {
  acquireBlobUrl,
  releaseBlobUrl,
  resetBlobUrlCacheForTests,
} from "./blobUrlCache";
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

  it("owns acquired URLs through releaseUnretained and dispose", () => {
    vi.useFakeTimers();
    let nextUrl = 0;
    const createObjectURL = vi.fn(() => `blob:ambient-${++nextUrl}`);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const blobA = new Blob(["cover-a"]);
    const blobB = new Blob(["cover-b"]);
    const acquire = vi.fn(acquireBlobUrl);
    const release = vi.fn(releaseBlobUrl);
    const registry = createAmbientBlobUrlRegistry({ acquire, release });
    const layerA = createAmbientLayer(
      makeBook({ id: "a", coverImageBlob: blobA }),
      registry.acquire(blobA)
    );
    registry.acquire(blobA);
    registry.acquire(blobB);

    expect(acquire).toHaveBeenCalledTimes(2);
    registry.releaseUnretained({
      current: layerA,
      previous: null,
      generation: 2,
    });
    vi.runOnlyPendingTimers();

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ambient-2");
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith(blobB);

    registry.dispose();
    registry.dispose();
    vi.runOnlyPendingTimers();

    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ambient-1");
    expect(release).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledWith(blobA);
    expect(() => registry.acquire(blobA)).toThrow(/disposed/i);
  });

  it("supports StrictMode-style registry replacement without double release", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:strict-cover");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const blob = new Blob(["cover"]);
    const acquire = vi.fn(acquireBlobUrl);
    const release = vi.fn(releaseBlobUrl);

    const firstRegistry = createAmbientBlobUrlRegistry({ acquire, release });
    expect(firstRegistry.acquire(blob)).toBe("blob:strict-cover");
    firstRegistry.dispose();
    expect(() => firstRegistry.acquire(blob)).toThrow(/disposed/i);

    const secondRegistry = createAmbientBlobUrlRegistry({ acquire, release });
    expect(secondRegistry.acquire(blob)).toBe("blob:strict-cover");
    firstRegistry.dispose();
    secondRegistry.dispose();
    vi.runAllTimers();

    expect(acquire).toHaveBeenCalledTimes(2);
    expect(release).toHaveBeenCalledTimes(2);
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:strict-cover");
  });

  it("keeps the component decorative and wired to the resource owner", () => {
    const source = readFileSync(
      new URL("../app/AmbientBookBackground.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('from "@/lib/ambientBookBackground"');
    expect(source).toContain("createAmbientBlobUrlRegistry");
    expect(source).toMatch(
      /completeAmbientTransition\(\s*layersRef\.current,\s*generation\s*\)/
    );
    expect(source).toMatch(
      /registryRef\.current\?\.releaseUnretained\(\s*layersRef\.current\s*\)/
    );
    expect(source).toMatch(
      /useEffect\(\s*\(\) => \(\) => \{[\s\S]*?registryRef\.current = null;[\s\S]*?registry\?\.dispose\(\);[\s\S]*?\},\s*\[\]\s*\)/
    );
    expect(source).not.toContain("URL.createObjectURL");
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("styles.ambientBookBackground");
    expect(source).toContain("styles.ambientBookLayer");
  });
});
