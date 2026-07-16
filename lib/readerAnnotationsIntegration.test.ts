import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const hookSource = readFileSync(
  new URL("../app/useReaderAnnotations.ts", import.meta.url),
  "utf8"
);

it("owns annotation persistence behind one hook", () => {
  expect(hookSource).toContain("listAnnotations");
  expect(hookSource).toContain("addAnnotation");
  expect(hookSource).toContain("deleteAnnotation");
  expect(hookSource).toContain("createLocalId");
  expect(hookSource).not.toContain("crypto.randomUUID");
});
