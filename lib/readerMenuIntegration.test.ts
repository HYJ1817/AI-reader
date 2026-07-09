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

function cssRule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

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

  it("keeps visible reader menu rows tappable while chrome exits", () => {
    const rowRule = cssRule(".readerMenuRow");
    const hiddenRowRule = cssRule(".readerChromeControlsHidden .readerMenuRow");

    expect(rowRule).toContain("visibility: visible");
    expect(rowRule).toContain("pointer-events: auto");
    expect(hiddenRowRule).toContain("visibility: hidden");
    expect(hiddenRowRule).toContain("visibility 0s linear var(--motion-chrome-exit)");
    expect(hiddenRowRule).not.toContain("pointer-events: none");
  });

  it("uses a circular reader close button", () => {
    const closeRule = cssRule(".readerOverlayBack");

    expect(controlsSource).toContain("styles.readerOverlayBack");
    expect(closeRule).toContain("width: 48px");
    expect(closeRule).toContain("height: 48px");
    expect(closeRule).toContain("border-radius: 999px");
  });

  it("keeps a chrome-owned menu button tappable for both opening and closing", () => {
    const wakeRule = cssRule(".readerMenuWakeButton");
    const hiddenWakeRule = cssRule(
      ".readerChromeControlsHidden .readerMenuWakeButton"
    );

    expect(sessionSource).toContain("onWakeMenu={onReaderTap}");
    expect(controlsSource).toContain("onWakeMenu: () => void");
    expect(controlsSource).toContain("className={styles.readerMenuWakeButton}");
    expect(controlsSource).toContain("onClick={onWakeMenu}");
    expect(wakeRule).toContain("pointer-events: auto");
    expect(wakeRule).toContain("visibility: visible");
    expect(hiddenWakeRule).toContain("pointer-events: auto");
    expect(hiddenWakeRule).toContain("visibility: visible");
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

  it("keeps the reader theme preview cards to light and dark", () => {
    const themePreviewStart = settingsSource.indexOf("const THEMES:");
    const themePreviewEnd = settingsSource.indexOf("];", themePreviewStart);
    const themePreviewSource = settingsSource.slice(themePreviewStart, themePreviewEnd);
    expect(settingsSource).toContain('value: "light"');
    expect(settingsSource).toContain('value: "dark"');
    expect(themePreviewSource).not.toContain('value: "system"');
    expect(themePreviewSource).not.toContain('value: "sepia"');
    expect(settingsSource).toContain("styles.readerThemePreviewGrid");
  });

  it("presents small and large as font-size controls with a scale indicator", () => {
    expect(settingsSource).toContain("FONT_SCALE_DOTS");
    expect(settingsSource).toContain("Math.round((FONT_MAX - FONT_MIN) / FONT_STEP) + 1");
    expect(settingsSource).toContain("fontScaleActiveIndex");
    expect(settingsSource).toContain('aria-label="减小字号"');
    expect(settingsSource).toContain('aria-label="增大字号"');
    expect(settingsSource).toMatch(/>\s*小\s*</);
    expect(settingsSource).toMatch(/>\s*大\s*</);
    expect(settingsSource).toContain("styles.readerFontScale");
    expect(settingsSource).toContain("styles.readerFontScaleDot");
  });

  it("separates appearance and page-flow menus in the top controls", () => {
    expect(settingsSource).toContain('type ReaderSettingsMenu = "mode" | "theme"');
    expect(settingsSource).toContain('setOpenMenu(openMenu === "mode" ? null : "mode")');
    expect(settingsSource).toContain('setOpenMenu(openMenu === "theme" ? null : "theme")');
    expect(settingsSource).toContain("READER_MODE_MENU_OPTIONS.map");
    expect(settingsSource).toContain("READER_THEME_MENU_OPTIONS.map");
    expect(settingsSource).toContain("styles.readerSettingsPopover");
    expect(settingsSource).toContain("styles.readerModeIcon");
    expect(settingsSource).toContain("styles.readerThemeIcon");
    expect(settingsSource).toContain("styles.readerCustomGearIcon");
    expect(settingsSource).not.toContain("M12 2.5v3M12 18.5v3M2.5 12h3");
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

  it("uses a live text preview in the custom settings sheet", () => {
    expect(customSettingsSource).toContain("const previewStyle: CSSProperties");
    expect(customSettingsSource).toContain("style={previewStyle}");
    expect(customSettingsSource).toContain("styles.readerCustomPreviewText");
    expect(customSettingsSource).toContain("styles.readerCustomControlCard");
    expect(customSettingsSource).toContain("styles.readerCustomSliderIcon");
    expect(customSettingsSource).toContain("styles.readerCustomSliderSvg");
    expect(customSettingsSource).not.toContain("styles.readerCustomLetterIcon");
    expect(customSettingsSource).not.toContain("styles.readerCustomLineIcon");
    expect(customSettingsSource).not.toContain("<img");
    expect(css).toContain(".readerCustomPreviewText");
    expect(css).toContain(".readerCustomControlCard");
  });
});
