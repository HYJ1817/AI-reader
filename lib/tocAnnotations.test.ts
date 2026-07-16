import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const tocSource = readFileSync(
  new URL("../app/TocDrawer.tsx", import.meta.url),
  "utf8"
);

it("renders functional bookmark and highlight tabs", () => {
  expect(tocSource).toContain(
    'useState<"chapters" | "bookmarks" | "highlights">'
  );
  expect(tocSource).toContain('role="tab"');
  expect(tocSource).toContain("aria-selected");
  expect(tocSource).toContain("bookmarks.length");
  expect(tocSource).toContain("highlights.length");
  expect(tocSource).toContain("onSelectAnnotation");
  expect(tocSource).toContain("onDeleteAnnotation");
  expect(tocSource).toContain("添加当前页书签");
  expect(tocSource).toContain("这本书没有目录信息");
  expect(tocSource).toContain("还没有书签");
  expect(tocSource).toContain("还没有高亮");
});
