import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getReaderTransitionTiming,
  MOTION_DURATION,
} from "./motionSystem";

const transitionSource = readFileSync(
  new URL("../app/SharedBookTransition.tsx", import.meta.url),
  "utf8"
);
const sessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const cssSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("shared reader transition timing", () => {
  it("uses the 280 ms entry, 210 ms exit, and 100 ms reduced contract", () => {
    expect(MOTION_DURATION.readerEnter).toBe(0.28);
    expect(MOTION_DURATION.readerExit).toBe(0.21);
    expect(getReaderTransitionTiming(false)).toEqual({
      contentEnter: {
        duration: 0.16,
        delay: MOTION_DURATION.readerEnter * 0.24,
      },
      contentExit: { duration: 0.21, delay: 0 },
      coverEnterOpacity: {
        duration: 0.16,
        delay: MOTION_DURATION.readerEnter * 0.42,
      },
      coverExitOpacity: { duration: 0.21, delay: 0 },
    });
    expect(getReaderTransitionTiming(true)).toEqual({
      contentEnter: { duration: 0.1, delay: 0 },
      contentExit: { duration: 0.1, delay: 0 },
      coverEnterOpacity: { duration: 0.1, delay: 0 },
      coverExitOpacity: { duration: 0.1, delay: 0 },
    });
  });

  it("uses explicit entrance and exit timing without an exit delay", () => {
    expect(transitionSource).toContain("getReaderTransitionTiming");
    expect(transitionSource).toMatch(
      /transition:\s*settleImmediately[\s\S]{0,100}:\s*timing\.contentExit/
    );
    expect(transitionSource).toContain("opacity: timing.coverExitOpacity");
    expect(transitionSource).not.toMatch(/exit[\s\S]{0,240}readerEnter \* 0\.24/);
  });

  it("marks the meaningful reader frame while retaining loading in the presentation", () => {
    expect(sessionSource).toContain("data-reader-content-ready={");
    expect(sessionSource).toMatch(
      /book\s*&&\s*\(book\.format\s*===\s*"epub"\s*\|\|\s*!loading\)\s*\?\s*"true"\s*:\s*"false"/
    );
    expect(sessionSource).toContain("loading ? (");
    expect(sessionSource).toContain("UI_TEXT.LOADING");
    const gestureOwnerIndex = sessionSource.indexOf(
      'data-navigation-gesture-owner="reader"'
    );
    expect(gestureOwnerIndex).toBeGreaterThan(-1);
    expect(sessionSource.indexOf("<EpubReader", gestureOwnerIndex)).toBeGreaterThan(
      gestureOwnerIndex
    );
    expect(
      sessionSource.indexOf('data-txt-reader="true"', gestureOwnerIndex)
    ).toBeGreaterThan(gestureOwnerIndex);
  });

  it("settles obsolete reader geometry without changing the presentation key", () => {
    expect(transitionSource).toContain("useAppMotionLifecycle");
    expect(transitionSource).toMatch(/\{\s*epoch,\s*suspended\s*\}/);
    expect(transitionSource).toContain("lifecycleInvalidated");
    expect(transitionSource).toContain("settleImmediately");
    expect(transitionSource).toContain("duration: 0");
    expect(transitionSource).toContain(
      'key={readerEntry.key}'
    );
    expect(transitionSource).not.toMatch(/key=\{[^}]*epoch/);
    expect(transitionSource).toMatch(
      /layoutId=\{[^}]*settleImmediately[^}]*\?\s*undefined/
    );
  });

  it("rechecks source geometry before selecting shared projection", () => {
    expect(transitionSource).toMatch(
      /source\?\.visible\s*&&\s*isSourceVisible\(source\.element\)/
    );
  });

  it("keeps reader presentation visual-first and close persistence non-blocking", () => {
    const prepareIndex = pageSource.indexOf(
      "const contentReady = prepareReaderBook(fullBook, savedPosition)"
    );
    const presentIndex = pageSource.indexOf(
      "navigation.presentReader(book.id, { originId })"
    );
    const awaitIndex = pageSource.indexOf("await contentReady", presentIndex);

    expect(prepareIndex).toBeGreaterThan(-1);
    expect(presentIndex).toBeGreaterThan(prepareIndex);
    expect(awaitIndex).toBeGreaterThan(presentIndex);
    expect(pageSource).toContain("void positionCoordinator.flush().catch");
    expect(pageSource).not.toMatch(
      /await\s+positionCoordinator\.flush\(\)[\s\S]{0,160}navigation\.dismissReader\(\)/
    );
  });

  it("keeps the full reader layer opaque while content crossfades", () => {
    expect(cssSource).toMatch(
      /\.readerPresentationContent\s*\{[\s\S]*?background:\s*var\(--background\)/
    );
  });
});
