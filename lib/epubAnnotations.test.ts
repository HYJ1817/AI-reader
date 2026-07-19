import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const epubSource = readFileSync(
  new URL("../app/EpubReader.tsx", import.meta.url),
  "utf8"
);

it("keeps precise EPUB selections and native highlight layers", () => {
  expect(epubSource).toContain("ReaderTextSelection");
  expect(epubSource).toContain("annotations.highlight");
  expect(epubSource).toContain('annotations.remove(locator, "highlight")');
  expect(epubSource).toContain("getCurrentSnapshot");
  expect(epubSource).toContain("goToAnnotation");
  expect(epubSource).toContain("clearNativeSelection");
});
