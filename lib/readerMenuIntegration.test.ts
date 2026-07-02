import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  estimateReaderPageInfo,
  formatReaderPageLabel,
} from "./readerPageInfo";

const controlsSource = readFileSync(
  new URL("../app/ReaderControls.tsx", import.meta.url),
  "utf8"
);
const sessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const tocSource = readFileSync(
  new URL("../app/TocDrawer.tsx", import.meta.url),
  "utf8"
);
const settingsSource = readFileSync(
  new URL("../app/ReaderSettingsPanel.tsx", import.meta.url),
  "utf8"
);
const customSettingsSource = readFileSync(
  new URL("../app/ReaderCustomSettingsPanel.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("reader page indicator", () => {
  it("formats page labels as current over total pages", () => {
    expect(formatReaderPageLabel({ current: 1426, total: 3226 })).toBe(
      "1426/3226页"
    );
  });

  it("estimates a safe page from progress when exact pages are unavailable", () => {
    expect(estimateReaderPageInfo(44, 3226)).toEqual({
      current: 1420,
      total: 3226,
    });
    expect(estimateReaderPageInfo(Number.NaN, 0)).toEqual({
      current: 1,
      total: 1,
    });
  });

  it("renders a page pill through the reading controls", () => {
    expect(sessionSource).toContain("pageInfo={pageInfo}");
    expect(controlsSource).toContain("styles.readerPagePill");
    expect(controlsSource).toContain("formatReaderPageLabel(pageInfo)");
    expect(css).toContain(".readerPagePill");
  });
});

describe("reader action menu", () => {
  it("uses staggered capsule buttons for contents, AI, and theme actions", () => {
    const menuStart = controlsSource.indexOf(
      "className={styles.readerActionMenu}"
    );
    const menuSource = controlsSource.slice(menuStart);
    expect(controlsSource).toContain("styles.readerActionMenu");
    expect(controlsSource).toContain("styles.readerMenuRow");
    expect(menuSource.indexOf("handleContents")).toBeLessThan(
      menuSource.indexOf("onAsk")
    );
    expect(menuSource.indexOf("onAsk")).toBeLessThan(
      menuSource.indexOf("onOpenSettings")
    );
    expect(css).toContain(".readerActionMenu");
    expect(css).toContain(".readerMenuRow:nth-child(2)");
    expect(css).toContain(".readerMenuRow:nth-child(3)");
    expect(css).toMatch(
      /\.readerMenuRow\s*\{[^}]*border-radius:\s*999px;[^}]*box-shadow:/s
    );
    expect(css).toContain("transition-delay: 0ms;");
    expect(css).toContain("90ms, 90ms");
    expect(css).toContain("180ms, 180ms");
    expect(css).not.toContain(".readerFloatingTools");
  });
});

describe("reader contents and theme sheets", () => {
  it("passes book and page metadata into the contents sheet", () => {
    expect(overlaysSource).toContain("bookTitle: string | null");
    expect(overlaysSource).toContain("pageInfo");
    expect(tocSource).toContain("styles.tocHeaderTitle");
    expect(tocSource).toContain("章节");
    expect(tocSource).toContain("书签");
    expect(tocSource).toContain("高亮标记");
  });

  it("keeps the reader theme picker to light and dark only", () => {
    expect(settingsSource).toContain('value: "light"');
    expect(settingsSource).toContain('value: "dark"');
    expect(settingsSource).not.toContain('value: "system"');
    expect(settingsSource).not.toContain('value: "sepia"');
    expect(settingsSource).toContain("styles.readerThemePreviewGrid");
  });

  it("opens detailed custom settings in a separate sheet", () => {
    expect(settingsSource).toContain("ReaderCustomSettingsPanel");
    expect(settingsSource).toContain("setCustomSettingsOpen(true)");
    expect(customSettingsSource).toContain("ariaLabel=\"自定义设置\"");
    expect(customSettingsSource).toContain("无障碍与布局选项");
    expect(customSettingsSource).toContain("letterSpacingPercent");
    expect(customSettingsSource).toContain("wordSpacingPercent");
    expect(customSettingsSource).toContain("pageMarginPx");
    expect(css).toContain(".readerCustomSettingsSheet");
    expect(css).toContain(".readerCustomEntryButton");
  });
});
