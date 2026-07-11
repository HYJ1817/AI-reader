import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AMBIENT_CROSSFADE_MS,
  completeAmbientTransition,
  createAmbientBlobUrlRegistry,
  createAmbientLayer,
  createCustomAmbientLayer,
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

const globalsCss = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const moduleCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

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

  it("creates a custom image layer from a selected background blob", () => {
    const blob = new Blob(["background"], { type: "image/png" });

    expect(createCustomAmbientLayer(blob, "blob:custom")).toEqual({
      key: "ambient:custom:blob:custom",
      kind: "image",
      imageUrl: "blob:custom",
      paper: null,
      spine: null,
      blob,
    });
    expect(createCustomAmbientLayer(null, null)).toEqual(
      createAmbientLayer(null, null)
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
    expect(source).toContain("createCustomAmbientLayer");
    expect(source).toContain("customBackgroundOpacity");
    expect(source).toContain('"--ambient-custom-effect"');
    expect(source).toContain('"--ambient-custom-blur"');
    expect(source).toContain('"--ambient-custom-inset"');
    expect(source).toContain("data-custom-active={isCustomLayer(layers.current)");
    expect(source).toContain("data-custom={isCustomLayer(");
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

  it("mounts the shared ambient background once at the app root", () => {
    const source = readFileSync(
      new URL("../app/page.tsx", import.meta.url),
      "utf8"
    );
    const appRootStart = source.indexOf("className={styles.app}");
    const appRootContentStart = source.indexOf(">", appRootStart) + 1;
    const ambientMounts = source.match(/<AmbientBookBackground\b/g) ?? [];
    const ambientStart = source.indexOf(
      "<AmbientBookBackground",
      appRootContentStart
    );
    const firstInput = source.indexOf(
      "<input",
      appRootContentStart
    );
    const firstMain = source.indexOf("<main", appRootContentStart);
    const ambientEnd = source.indexOf("/>", ambientStart) + 2;
    const ambientMount = source.slice(ambientStart, ambientEnd);

    expect(source).toContain(
      'import AmbientBookBackground from "@/app/AmbientBookBackground";'
    );
    expect(ambientMounts).toHaveLength(1);
    expect(appRootStart).toBeGreaterThanOrEqual(0);
    expect(ambientStart).toBeGreaterThan(appRootContentStart);
    expect(ambientStart).toBeLessThan(firstInput);
    expect(ambientStart).toBeLessThan(firstMain);
    expect(ambientEnd).toBeGreaterThan(ambientStart);
    expect(ambientMount).toContain("customBackgroundBlob={");
    expect(ambientMount).toContain("customBackgroundOpacity={");
    expect(ambientMount).toContain(
      "reduceMotion={appPrefs.reduceMotion}"
    );
  });

  it("defines theme-specific ambient veil, strength, and saturation tokens", () => {
    const tokens = [
      "--ambient-veil",
      "--ambient-strength",
      "--ambient-saturate",
    ];
    const themeSelectors = [
      ":root",
      '[data-reader-theme="light"]',
      '[data-reader-theme="sepia"]',
      '[data-reader-theme="dark"]',
    ];

    for (const token of tokens) {
      expect(
        globalsCss.match(new RegExp(`${token}:`, "g"))?.length ?? 0
      ).toBeGreaterThanOrEqual(4);
      for (const selector of themeSelectors) {
        expect(
          cssRule(globalsCss, selector),
          `${selector} should define ${token}`
        ).toContain(`${token}:`);
      }
    }

    expect(globalsCss).toMatch(
      /\nbody\s*\{[^}]*background:\s*var\(--background\)/s
    );
  });

  it("keeps the ambient cover fixed behind interactive content", () => {
    const appRule = cssRule(moduleCss, ".app");
    const backgroundRule = cssRule(moduleCss, ".ambientBookBackground");
    const veilRule = cssRule(moduleCss, ".ambientBookBackground::after");
    const contentRule = cssRule(moduleCss, ".content");
    const tabBarRule = cssRule(moduleCss, ".tabBar");
    const readerRule = cssRule(moduleCss, ".readerShell");

    expect(appRule).toContain("position: relative");
    expect(appRule).toContain("isolation: isolate");
    expect(appRule).toContain("background: transparent");
    expect(backgroundRule).toContain("position: fixed");
    expect(backgroundRule).toContain("inset: 0");
    expect(backgroundRule).toContain("z-index: -1");
    expect(backgroundRule).toContain("background: var(--app-bg)");
    expect(backgroundRule).toContain("pointer-events: none");
    expect(backgroundRule).toContain("overflow: hidden");
    expect(veilRule).toContain("background: var(--ambient-veil)");
    expect(contentRule).not.toContain("z-index:");
    expect(tabBarRule).toContain("z-index: 10");
    expect(readerRule).toContain("z-index: 20");
  });

  it("renders bounded blurred cover layers with an opacity-only crossfade", () => {
    const layerRule = cssRule(moduleCss, ".ambientBookLayer");
    const currentRule = cssRule(
      moduleCss,
      '.ambientBookLayer[data-layer="current"]'
    );
    const previousRule = cssRule(
      moduleCss,
      '.ambientBookLayer[data-layer="previous"]'
    );

    expect(layerRule).toMatch(/inset:\s*-(?:3[6-9]|4[0-8])px/);
    expect(layerRule).toContain("background-size: cover");
    expect(layerRule).toContain("background-position: center");
    expect(layerRule).toMatch(
      /filter:\s*blur\((?:3[6-9]|4[0-8])px\)\s+saturate\(var\(--ambient-saturate\)\)/
    );
    expect(layerRule).toContain("transition:");
    expect(layerRule).toContain(
      "opacity var(--motion-navigation) var(--ease-navigation)"
    );
    expect(layerRule).not.toMatch(/transition:[^;]*(?:filter|transform)/s);
    expect(layerRule).not.toContain("animation:");
    expect(layerRule).not.toContain("scale(");
    expect(currentRule).toContain("z-index: 0");
    expect(currentRule).toContain("opacity: var(--ambient-strength)");
    expect(moduleCss).toContain('[data-custom="true"]');
    expect(moduleCss).toContain("filter: blur(var(--ambient-custom-blur)) saturate(1)");
    expect(moduleCss).toContain("inset: var(--ambient-custom-inset)");
    expect(moduleCss).toContain('.ambientBookBackground[data-custom-active="true"]::after');
    expect(moduleCss).toContain("opacity: var(--ambient-custom-effect)");
    expect(moduleCss).not.toContain("var(--ambient-custom-opacity)");
    expect(moduleCss).not.toContain("calc(var(--ambient-strength) *");
    expect(previousRule).toContain("z-index: 1");
    expect(previousRule).toContain("opacity: 0");
    expect(cssRule(moduleCss, ".ambientBookBackground::after")).toContain(
      "z-index: 2"
    );
  });

  it("uses the generated paper and spine colors for the CSS fallback field", () => {
    const fallbackRule = cssRule(
      moduleCss,
      '.ambientBookLayer[data-kind="fallback"]'
    );

    expect(fallbackRule).toContain("linear-gradient(");
    expect(fallbackRule).toContain("var(--ambient-cover-paper)");
    expect(fallbackRule).toContain("var(--ambient-cover-spine)");
    expect(fallbackRule).not.toContain("url(");
  });

  it("keeps app and reader canvases transparent without glassifying content", () => {
    for (const selector of [".app", ".readerShell", ".readerStage"]) {
      expect(cssRule(moduleCss, selector)).toContain(
        "background: transparent"
      );
    }
    expect(moduleCss).not.toContain(".readerEpubLightCanvas");

    for (const selector of [".readerBody", ".epubReaderShell"]) {
      const rule = cssRule(moduleCss, selector);
      expect(rule).not.toMatch(/(?:^|\n)\s*background\s*:/);
      expect(rule).not.toMatch(/(?:^|\n)\s*background-color\s*:/);
    }

    const settingsSurfaceRule = cssRule(moduleCss, ".settingsNativeList");
    expect(settingsSurfaceRule).toContain("background: var(--liquid-glass-bg)");
    expect(settingsSurfaceRule).toContain("backdrop-filter:");

    for (const selector of [".collectionList", ".readerSettingsList"]) {
      expect(cssRule(moduleCss, selector)).toContain(
        "background: var(--surface-primary)"
      );
    }
  });

  it("disables ambient layer transitions for both motion preferences", () => {
    expect(moduleCss).toMatch(
      /\.app\[data-reduce-motion="true"\]\s+\.ambientBookLayer\s*\{[^}]*transition:\s*none/s
    );
    expect(moduleCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.ambientBookLayer\s*\{[^}]*transition:\s*none/s
    );
  });
});
