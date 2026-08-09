import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const tocSource = readFileSync(
  new URL("../app/TocDrawer.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
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

it("keeps all annotation pages mounted in a fixed-height swipe viewport", () => {
  expect(tocSource).toContain("READER_TOC_TABS");
  expect(tocSource).toContain('data-sheet-horizontal-gesture="true"');
  expect(tocSource).toContain('data-toc-swipe-viewport="true"');
  expect(tocSource).toContain('data-active-tab={activeTab}');
  expect(tocSource).not.toContain('className={styles.tocTabIndicator}');
  expect(tocSource).not.toContain('layoutId="toc-active-tab-indicator"');
  expect(tocSource).toContain("getNearestReaderTocTabIndex");
  expect(tocSource).toContain("onTouchStart={releaseProgrammaticTab}");
  expect(tocSource).toContain("tabScrollFrameRef.current = window.requestAnimationFrame");
  expect(tocSource).toContain("aria-hidden={activeTab !== tab.id}");
  expect(css).toMatch(
    /\.tocSheet\s*\{[^}]*height:\s*min\(92dvh, 760px\)/s
  );
  expect(css).toContain("scroll-snap-type: x mandatory");
  expect(css).toContain("scroll-snap-align: start");
  expect(css).toMatch(
    /\.tocTabs button\s*\{[^}]*transition:[^}]*background-color var\(--motion-fast\)[^}]*color var\(--motion-fast\)/s
  );
  expect(css).toMatch(
    /\.tocTabs \.tocTabActive\s*\{[^}]*background-color:\s*rgba\(255, 255, 255, 0\.23\);/s
  );
  expect(css).toMatch(
    /\.tocSheet\s*\{[\s\S]*?--sheet-page-viewport-flex:\s*1;[\s\S]*?--sheet-page-height:\s*100%;/
  );
  expect(css).toMatch(
    /\.tocPage\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/
  );
});
