import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const hookSource = readFileSync(
  new URL("../app/useReaderAnnotations.ts", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const controllerSource = readFileSync(
  new URL("../app/useReaderAnnotationsController.ts", import.meta.url),
  "utf8"
);
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const sessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const navigationSource = readFileSync(
  new URL("../app/useReaderAnnotationNavigation.ts", import.meta.url),
  "utf8"
);

it("owns annotation persistence behind one hook", () => {
  expect(hookSource).toContain("listAnnotations");
  expect(hookSource).toContain("addAnnotation");
  expect(hookSource).toContain("deleteAnnotation");
  expect(hookSource).toContain("createLocalId");
  expect(hookSource).not.toContain("crypto.randomUUID");
});

it("composes annotation state, cross-format navigation, and status", () => {
  expect(pageSource).toContain("useReaderAnnotationsController");
  expect(pageSource).toContain("setAnnotationSnapshot");
  expect(pageSource).toContain("toggleBookmark");
  expect(controllerSource).toContain("saveHighlight");
  expect(controllerSource).toContain("useReaderAnnotationNavigation");
  expect(navigationSource).toContain("goToAnnotation");
  expect(navigationSource).toContain("navigateToTxtLocator");
  expect(overlaysSource).toContain("bookmarks={reader.bookmarks}");
  expect(overlaysSource).toContain("highlights={reader.highlights}");
  expect(sessionSource).toContain('aria-live="polite"');
});
