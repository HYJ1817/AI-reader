import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const pageSource = readSource("app/page.tsx");
const epubSource = readSource("app/EpubReader.tsx");
const sessionSource = readSource("app/ReadingSession.tsx");
const registrationSource = readSource("app/ServiceWorkerRegistration.tsx");

describe("reading position persistence integration", () => {
  it("routes TXT persistence through the shared coordinator", () => {
    expect(pageSource).toContain("createReaderPositionCoordinator");
    expect(pageSource).toContain("positionCoordinator.schedule({");
    expect(pageSource).not.toContain("readerSaveTimerRef");
  });

  it("flushes pending positions before book switches and lifecycle exits", () => {
    expect(pageSource).toContain("await positionCoordinator.flush()");
    expect(pageSource).toContain('document.addEventListener("visibilitychange"');
    expect(pageSource).toContain('window.addEventListener("pagehide"');
    expect(pageSource).toContain(
      'window.addEventListener("ai-reader-before-reload"'
    );
    expect(pageSource).toContain("positionCoordinator.flush()");
  });

  it("keeps EPUB relocation writes outside rendition-local timers", () => {
    expect(epubSource).toContain("scheduleReadingPosition(position)");
    expect(sessionSource).toContain("scheduleReadingPosition={scheduleReadingPosition}");
    expect(epubSource).not.toContain("pendingPositionRef");
    expect(epubSource).not.toContain("saveTimerRef");
  });

  it("persists the new EPUB mode before changing the rendition", () => {
    const saveIndex = pageSource.indexOf(
      "positionCoordinator.saveNow({"
    );
    const newModeIndex = pageSource.indexOf("readingMode: nextMode", saveIndex);
    const setModeIndex = pageSource.indexOf("setReaderMode(nextMode)", saveIndex);

    expect(saveIndex).toBeGreaterThanOrEqual(0);
    expect(newModeIndex).toBeGreaterThan(saveIndex);
    expect(setModeIndex).toBeGreaterThan(newModeIndex);
  });

  it("requests a final flush before controlled service worker reloads", () => {
    expect(registrationSource).toContain(
      'new CustomEvent("ai-reader-before-reload"'
    );
    expect(registrationSource.indexOf("ai-reader-before-reload")).toBeLessThan(
      registrationSource.indexOf("window.location.reload()")
    );
  });
});
