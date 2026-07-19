import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const navigationStackSource = readFileSync(
  new URL("../app/NavigationStack.tsx", import.meta.url),
  "utf8"
);
const appNavigationSource = readFileSync(
  new URL("../app/AppNavigation.tsx", import.meta.url),
  "utf8"
);
const readerControlsSource = readFileSync(
  new URL("../app/ReaderControls.tsx", import.meta.url),
  "utf8"
);
const motionSheetSource = readFileSync(
  new URL("../app/MotionSheet.tsx", import.meta.url),
  "utf8"
);
const navigationMotionSource = readFileSync(
  new URL("./navigationMotion.ts", import.meta.url),
  "utf8"
);

describe("motion CSS", () => {
  it("uses an explicit project easing curve for timed transitions", () => {
    const declarations = css.match(/transition:\s*[^;]+;/g) ?? [];
    const uncurved = declarations.filter((declaration) => {
      if (declaration.includes("none")) return false;
      if (!/(?:\d+ms|0?\.\d+s)/.test(declaration)) return false;
      return !declaration.includes("var(--ease-");
    });

    expect(uncurved).toEqual([]);
  });

  it("does not use bounce, elastic, or positive-duration linear motion", () => {
    expect(css).not.toMatch(/cubic-bezier\([^)]*(?:-\d|1\.\d)/);
    const motionDeclarations =
      css.match(/(?:transition|animation):\s*[^;]+;/g) ?? [];
    const positiveLinear = motionDeclarations.filter((declaration) =>
      declaration.replaceAll("0s linear", "").match(/\blinear\b/)
    );
    expect(positiveLinear).toEqual([]);
  });

  it("uses one navigation timing and easing protocol", () => {
    expect(css).toContain("--motion-navigation: 340ms;");
    expect(css).toContain("--motion-sheet: 300ms;");
    expect(css).toContain("--motion-sheet-settle: 220ms;");
    expect(css).toContain("--motion-sheet-exit: 250ms;");
    expect(css).toContain(
      "--ease-sheet-settle: cubic-bezier(0.2, 0.86, 0.18, 1);"
    );
    expect(css).toContain(
      "--ease-navigation: cubic-bezier(0.32, 0.72, 0, 1);"
    );
    expect(navigationStackSource).toContain("MOTION_SPRING.navigation");
    expect(appNavigationSource).toContain("ROOT_TAB_TRANSITION");
    expect(appNavigationSource).not.toContain("MOTION_SPRING.navigation");
    expect(navigationStackSource).toContain("useAppReducedMotion");
    expect(appNavigationSource).toContain("useAppReducedMotion");
    const readerShellStart = css.indexOf(".readerShell {");
    const readerShellEnd = css.indexOf("}", readerShellStart);
    const readerShellRule = css.slice(readerShellStart, readerShellEnd);
    expect(readerShellRule).not.toMatch(/(?:opacity|transform)\s+var\(--motion-navigation\)/);
    expect(motionSheetSource).toContain("MOTION_SPRING.sheet");
    expect(motionSheetSource).toContain("MOTION_DURATION.sheetExit");
    expect(motionSheetSource).toContain("ease: [0.32, 0.72, 0, 1]");
    expect(motionSheetSource).toContain("useAppReducedMotion");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.app,[\s\S]*?transition-duration:\s*0\.001ms !important;/s
    );
    for (const selector of [".appSurface {", ".tabIndicator {"]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      expect(css.slice(start, end)).not.toContain("will-change");
      expect(css.slice(start, end)).not.toContain("transition:");
    }
  });

  it("uses compact Motion offsets without duplicate reader presentation CSS", () => {
    expect(navigationMotionSource).toContain("direction * -12");
    expect(navigationMotionSource).toContain("direction * 22");
    expect(css).not.toContain(".appSurfaceBefore");
    expect(css).not.toContain(".appSurfaceAfter");
    expect(css).not.toContain(".readerSessionInactive");
    expect(css).not.toContain(".readerSessionActive");
    expect(css).not.toContain(".readingDashboardReaderOpen");
  });

  it("removes superseded keyframes, visual timers, and idle compositing hints", () => {
    for (const legacy of [
      "subviewInForward",
      "subviewInBackward",
      "motionSheetEntering",
      "motionSheetSettling",
      "motionSheetClosing",
      "readerSessionInactive",
      "batchBarEnter",
      "libraryContentIn",
      "sheetBackdropIn",
      "sheetSlideUp",
      "goalOverlayIn",
      "goalEditorIn",
    ]) {
      expect(css + pageSource).not.toContain(legacy);
    }

    expect(pageSource).not.toContain("readerPrefsMotionTimerRef");
    expect(pageSource).not.toContain("readerPreferencesAdjusting");
    const willChangeDeclarations = css.match(/will-change:\s*[^;]+;/g) ?? [];
    expect(willChangeDeclarations).toEqual(["will-change: transform;"]);
    const swipeStart = css.indexOf(".readerSwipeTracking {");
    const swipeEnd = css.indexOf("}", swipeStart);
    expect(css.slice(swipeStart, swipeEnd)).toContain("will-change: transform;");
  });

  it("keeps the moving sheet shadow within a restrained paint budget", () => {
    expect(css).toContain("--shadow-sheet: 0 -8px 18px rgba(0, 0, 0, 0.16);");
  });

  it("uses persistent tab surfaces instead of display switching or mount fades", () => {
    expect(css).not.toContain(".tabPageInactive");
    expect(css).not.toContain("@keyframes pageFadeIn");
    expect(navigationStackSource).toContain("m.section");
    expect(navigationStackSource).toContain("initial={false}");
    expect(navigationStackSource).toContain("inert");
  });

  it("moves one shared tab indicator with a compositor transform", () => {
    expect(appNavigationSource).toContain("<m.span");
    expect(appNavigationSource).toContain('layoutId="root-tab-indicator"');
    expect(appNavigationSource).toContain(
      "getNavigationTabIndex(activeTab) * 100"
    );
    expect(css).not.toContain("var(--tab-index)");
    const activeStart = css.indexOf(".activeTab {");
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).not.toContain("background:");
    expect(activeRule).not.toContain("box-shadow:");
  });

  it("keeps the library import action free of moving blur and shadow", () => {
    const start = css.indexOf(".libraryActionButton {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).not.toContain("backdrop-filter");
    expect(rule).not.toContain("box-shadow");
  });

  it("gives library book entries layered press depth", () => {
    const coverStart = css.indexOf("\n.bookCover {");
    const coverEnd = css.indexOf("}", coverStart);
    const coverRule = css.slice(coverStart, coverEnd);
    expect(coverRule).toContain("transform");
    expect(coverRule).toMatch(/transition:[^}]*transform/s);

    expect(css).toMatch(
      /\.bookGridItem:active\s+\.bookCover\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)[^}]*scale\(0\.985\)/s
    );
    expect(css).toMatch(
      /\.bookItem:active\s+\.bookCover\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)[^}]*scale\(0\.985\)/s
    );

    const moreStart = css.indexOf(".bookMoreButton {");
    const moreEnd = css.indexOf("}", moreStart);
    const moreRule = css.slice(moreStart, moreEnd);
    expect(moreRule).toContain("transform");
    expect(moreRule).toMatch(/transition:[^}]*opacity[^}]*transform/s);

    const gridMoreStart = css.indexOf(".bookGridMoreButton {");
    const gridMoreEnd = css.indexOf("}", gridMoreStart);
    const gridMoreRule = css.slice(gridMoreStart, gridMoreEnd);
    expect(gridMoreRule).toMatch(/transition:[^}]*opacity[^}]*transform/s);

    expect(css).toMatch(/\.bookMoreButton:active\s*\{[^}]*scale\(0\.94\)/s);
    expect(css).toMatch(
      /\.bookItem:active\s+\.bookMoreButton\s*\{[^}]*scale\(0\.96\)/s
    );

    const reduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".bookGridItem:active .bookCover")
    );
    const reduceEnd = css.indexOf(
      "}",
      css.indexOf("transform: none;", reduceStart)
    );
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".bookCover",
      ".bookGridItem:active .bookCover",
      ".bookItem:active .bookCover",
      ".bookMoreButton",
      ".bookMoreButton:active",
      ".bookItem:active .bookMoreButton",
      ".bookGridMoreButton",
      ".bookGridMoreButton:active",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
    expect(reduceRule).toContain("transform: none;");
  });

  it("leaves library view changes to Motion layout projection", () => {
    for (const selector of [".bookGrid {", ".bookItems {"]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).not.toContain("animation:");
    }
    expect(css).not.toContain("@keyframes libraryContentIn");
  });

  it("gives library selection badges elevated selected state", () => {
    const badgeStart = css.indexOf(".selectionBadge,");
    const badgeEnd = css.indexOf("}", badgeStart);
    const badgeRule = css.slice(badgeStart, badgeEnd);
    expect(badgeRule).toContain("transform");
    expect(badgeRule).toMatch(
      /transition:[^}]*background[^}]*border-color[^}]*box-shadow[^}]*transform/s
    );

    const selectedStart = css.indexOf(
      ".bookSelected .selectionBadge,",
      badgeEnd
    );
    const selectedEnd = css.indexOf("}", selectedStart);
    const selectedRule = css.slice(selectedStart, selectedEnd);
    expect(selectedRule).toContain("transform: scale(1.06)");
    expect(selectedRule).toContain("box-shadow");

    const reduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      selectedStart
    );
    const reduceEnd = css.indexOf(
      "}",
      css.indexOf(".bookSelected .selectionBadgeInline", reduceStart)
    );
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".selectionBadge",
      ".selectionBadgeInline",
      ".bookSelected .selectionBadge",
      ".bookSelected .selectionBadgeInline",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
    expect(reduceRule).toContain("transform: none;");
  });

  it("keeps a dismissing sheet available for an interrupting drag", () => {
    expect(motionSheetSource).toContain("interruptClose();");
    expect(motionSheetSource).toContain("dragControls.start(event)");
    expect(motionSheetSource).toContain("activeAnimationRef.current?.stop()");
    expect(motionSheetSource).not.toContain("pointerEvents: \"none\"");
  });

  it("does not move multiple live backdrop-filter layers with reader chrome", () => {
    for (const selector of [
      ".readerOverlayBack {",
      ".readerMenuRow {",
      ".readerPagePill {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).not.toContain("backdrop-filter");
    }
  });

  it("keeps reader chrome travel compact", () => {
    expect(readerControlsSource).toContain("y: reduceMotion ? 0 : 14");
    expect(readerControlsSource).toContain("y: reduceMotion ? 0 : 10");
    expect(readerControlsSource).toContain("y: reduceMotion ? 0 : -8");
    expect(css).not.toContain(".readerChromeControlsHidden .readerMenuRow");
  });

  it("stagers individual reader menu capsules", () => {
    expect(css).toContain(".readerActionMenu");
    expect(readerControlsSource).toContain("staggerChildren: 0.035");
    expect(readerControlsSource).toContain("staggerChildren: 0.025");
    expect(readerControlsSource).toContain("staggerDirection: -1");
    expect(css).not.toContain(".readerMenuRow:nth-child(");
  });

  it("removes reader menu travel when motion is reduced", () => {
    expect(readerControlsSource).toContain("useAppReducedMotion");
    expect(readerControlsSource).toContain("MOTION_DURATION.chromeEnter");
    expect(readerControlsSource).toContain("MOTION_DURATION.chromeExit");
    expect(readerControlsSource).toContain("scale: reduceMotion ? 1 : 0.96");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.readerMenuWakeButton,[\s\S]*?\.readerMenuRow\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });

  it("gives reader chrome a tactile pressed state without moving blur layers", () => {
    expect(readerControlsSource).toContain(
      "whileTap={reduceMotion ? undefined : { scale: 0.94 }}"
    );

    const menuActiveStart = css.indexOf(".readerMenuRow:not(:disabled):active {");
    const menuActiveEnd = css.indexOf("}", menuActiveStart);
    const menuActiveRule = css.slice(menuActiveStart, menuActiveEnd);
    expect(menuActiveRule).toContain("translate3d(0, 1px, 0) scale(0.985)");

    const menuIconStart = css.indexOf(".readerMenuRow svg,");
    const menuIconEnd = css.indexOf("}", menuIconStart);
    const menuIconRule = css.slice(menuIconStart, menuIconEnd);
    expect(menuIconRule).toMatch(/transition:[^}]*transform/s);

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.readerMenuRow:not\(:disabled\):active,[\s\S]*?\.readerMenuRow:not\(:disabled\):active svg,[\s\S]*?\.readerMenuRow:not\(:disabled\):active \.readerMenuTrailing\s*\{[\s\S]*?transform:\s*none;/s
    );
  });

  it("gives the reader contents rows a compact pressed response", () => {
    const rowStart = css.indexOf(".tocSheet .tocRowButton {");
    const rowEnd = css.indexOf("}", rowStart);
    const rowRule = css.slice(rowStart, rowEnd);
    expect(rowRule).toContain("transform");
    expect(rowRule).toMatch(/transition:[^}]*background[^}]*transform/s);

    const activeStart = css.indexOf(".tocSheet .tocRowButton:active {");
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).toContain("translate3d(4px, 0, 0)");

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.tocSheet \.tocRowButton,[\s\S]*?\.tocSheet \.tocRowButton:active\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });

  it("gives reader appearance controls native-feeling pressed and selected states", () => {
    const controlButtonStart = css.indexOf(
      ".readerFontStepper button,\n.readerModeSegment button {"
    );
    const controlButtonEnd = css.indexOf("}", controlButtonStart);
    const controlButtonRule = css.slice(controlButtonStart, controlButtonEnd);
    expect(controlButtonRule).toContain("transform");
    expect(controlButtonRule).toMatch(/transition:[^}]*background[^}]*transform/s);

    for (const selector of [
      ".readerFontStepper button:active {",
      ".readerModeSegment button:active {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toContain("scale(0.94)");
    }

    const activeStart = css.indexOf(
      ".readerModeSegment .readerModeSegmentActive {"
    );
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).toContain("box-shadow");
    expect(activeRule).toContain("transform");

    const reduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".readerFontStepper button")
    );
    const reduceEnd = css.indexOf("}", css.indexOf("transform: none;", reduceStart));
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".readerFontStepper button",
      ".readerModeSegment button",
      ".readerFontStepper button:active",
      ".readerModeSegment button:active",
      ".readerSettingsPopoverCheck",
      ".readerSettingsPopoverIcon",
      ".readerSettingsPopoverRow:active .readerSettingsPopoverCheck",
      ".readerSettingsPopoverRow:active .readerSettingsPopoverIcon",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
    expect(reduceRule).toContain("transform: none;");
  });

  it("separates reader font sizing from reading mode controls", () => {
    const rowStart = css.indexOf(".readerSettingsControlRow {");
    const rowEnd = css.indexOf("}", rowStart);
    const rowRule = css.slice(rowStart, rowEnd);
    expect(rowRule).toContain("1.75fr");

    const scaleStart = css.indexOf(".readerFontScale {");
    const scaleEnd = css.indexOf("}", scaleStart);
    const scaleRule = css.slice(scaleStart, scaleEnd);
    expect(scaleRule).toContain("display: flex");
    expect(scaleRule).toContain("gap");

    const dotStart = css.indexOf(".readerFontScaleDot {");
    const dotEnd = css.indexOf("}", dotStart);
    const dotRule = css.slice(dotStart, dotEnd);
    expect(dotRule).toContain("border-radius: 50%");
    expect(dotRule).toMatch(/transition:[^}]*background[^}]*transform/s);

    const activeStart = css.indexOf('.readerFontScaleDot[data-active="true"] {');
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).toContain("scale(1.18)");

    const iconStart = css.indexOf(".readerModeIcon,");
    const iconEnd = css.indexOf("}", iconStart);
    const iconRule = css.slice(iconStart, iconEnd);
    expect(iconRule).toContain("display: inline-flex");

    const fontButtonStart = css.indexOf(
      ".readerFontStepper button,\n.readerModeSegment button {"
    );
    const fontButtonEnd = css.indexOf("}", fontButtonStart);
    const fontButtonRule = css.slice(fontButtonStart, fontButtonEnd);
    expect(fontButtonRule).toContain("font-size: 17px");
  });

  it("styles reader settings popover menus independently from font sizing", () => {
    const popoverStart = css.indexOf(".readerSettingsPopover {");
    const popoverEnd = css.indexOf("}", popoverStart);
    const popoverRule = css.slice(popoverStart, popoverEnd);
    expect(popoverRule).toContain("position: absolute");
    expect(popoverRule).toContain("z-index");

    for (const selector of [
      '.readerSettingsPopover[data-menu="mode"] {',
      '.readerSettingsPopover[data-menu="theme"] {',
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toContain("right:");
    }

    const rowStart = css.indexOf(".readerSettingsPopoverRow {");
    const rowEnd = css.indexOf("}", rowStart);
    const rowRule = css.slice(rowStart, rowEnd);
    expect(rowRule).toContain("font-size: 15px");
    expect(rowRule).toMatch(/transition:[^}]*background[^}]*transform/s);

    const checkStart = css.indexOf(".readerSettingsPopoverCheck {");
    const checkEnd = css.indexOf("}", checkStart);
    const checkRule = css.slice(checkStart, checkEnd);
    expect(checkRule).toContain("transform");
    expect(checkRule).toMatch(/transition:[^}]*transform/s);

    const iconStart = css.indexOf(".readerSettingsPopoverIcon {");
    const iconEnd = css.indexOf("}", iconStart);
    const iconRule = css.slice(iconStart, iconEnd);
    expect(iconRule).toContain("transform");
    expect(iconRule).toMatch(/transition:[^}]*transform/s);

    expect(css).toMatch(
      /\.readerSettingsPopoverRow:active\s+\.readerSettingsPopoverCheck\s*\{[^}]*scale\(1\.08\)/s
    );
    expect(css).toMatch(
      /\.readerSettingsPopoverRow:active\s+\.readerSettingsPopoverIcon\s*\{[^}]*scale\(0\.94\)/s
    );

    const customIconStart = css.indexOf(".readerCustomGearIcon {");
    const customIconEnd = css.indexOf("}", customIconStart);
    const customIconRule = css.slice(customIconStart, customIconEnd);
    expect(customIconRule).toContain("display: inline-flex");
  });

  it("keeps reader settings typography at a normal menu scale", () => {
    const headerStart = css.indexOf(".readerSettingsHeader h2 {");
    const headerEnd = css.indexOf("}", headerStart);
    const headerRule = css.slice(headerStart, headerEnd);
    expect(headerRule).toContain("font-size: 17px");

    const sampleStart = css.indexOf(".readerThemePreviewSample {");
    const sampleEnd = css.indexOf("}", sampleStart);
    const sampleRule = css.slice(sampleStart, sampleEnd);
    expect(sampleRule).toContain("font-size: 30px");

    const previewLabelStart = css.indexOf(".readerThemePreview span:last-child {");
    const previewLabelEnd = css.indexOf("}", previewLabelStart);
    const previewLabelRule = css.slice(previewLabelStart, previewLabelEnd);
    expect(previewLabelRule).toContain("font-size: 15px");

    const customEntryStart = css.indexOf(".readerCustomEntryButton {");
    const customEntryEnd = css.indexOf("}", customEntryStart);
    const customEntryRule = css.slice(customEntryStart, customEntryEnd);
    expect(customEntryRule).toContain("font-size: 22px");
    expect(customEntryRule).toContain("min-height: 64px");

    const customGearStart = css.indexOf(".readerCustomGearIcon {");
    const customGearEnd = css.indexOf("}", customGearStart);
    const customGearRule = css.slice(customGearStart, customGearEnd);
    expect(customGearRule).toContain("transform");
    expect(customGearRule).toMatch(/transition:[^}]*transform/s);
    expect(css).toMatch(
      /\.readerCustomEntryButton:active\s+\.readerCustomGearIcon\s*\{[^}]*scale\(0\.92\)/s
    );

    const customReduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".readerCustomEntryButton:active .readerCustomGearIcon")
    );
    const customReduceEnd = css.indexOf(
      "}",
      css.indexOf("transform: none;", customReduceStart)
    );
    const customReduceRule = css.slice(customReduceStart, customReduceEnd);
    expect(customReduceRule).toContain(".readerCustomGearIcon");
    expect(customReduceRule).toContain(
      ".readerCustomEntryButton:active .readerCustomGearIcon"
    );
    expect(customReduceRule).toContain("transition: none;");
    expect(customReduceRule).toContain("transform: none;");
  });

  it("lays out custom settings as a preview above a compact control card", () => {
    const previewStart = css.indexOf(".readerCustomPreview {");
    const previewEnd = css.indexOf("}", previewStart);
    const previewRule = css.slice(previewStart, previewEnd);
    expect(previewRule).toContain("background: color-mix");
    expect(previewRule).toContain("border-bottom");
    expect(previewRule).not.toContain("border-radius");

    const previewTextStart = css.indexOf(".readerCustomPreviewText {");
    const previewTextEnd = css.indexOf("}", previewTextStart);
    const previewTextRule = css.slice(previewTextStart, previewTextEnd);
    expect(previewTextRule).toContain("font-size: 16px");
    expect(previewTextRule).toContain("line-height: inherit");

    const cardStart = css.indexOf(".readerCustomControlCard {");
    const cardEnd = css.indexOf("}", cardStart);
    const cardRule = css.slice(cardStart, cardEnd);
    expect(cardRule).toContain("border-radius: 24px");
    expect(cardRule).toContain("overflow: hidden");

    const sliderRule = [...css.matchAll(/\.readerCustomSliderRow\s*\{[^}]*\}/g)]
      .map((match) => match[0])
      .find((rule) => rule.includes("grid-template-columns")) ?? "";
    expect(sliderRule).toContain("min-height: 96px");
    expect(sliderRule).toContain("grid-template-columns: minmax(0, 1fr) auto");

    const sliderControlStart = css.indexOf(".readerCustomSliderControl {");
    const sliderControlEnd = css.indexOf("}", sliderControlStart);
    const sliderControlRule = css.slice(sliderControlStart, sliderControlEnd);
    expect(sliderControlRule).toContain("grid-template-columns: 42px minmax(0, 1fr)");

    const iconStart = css.indexOf(".readerCustomSliderIcon {");
    const iconEnd = css.indexOf("}", iconStart);
    const iconRule = css.slice(iconStart, iconEnd);
    expect(iconRule).toContain("width: 34px");
    expect(iconRule).toContain("height: 34px");

    expect(css).toContain(".readerCustomSliderSvg");
  });

  it("makes the active reader theme preview visually stable", () => {
    const previewStart = css.indexOf(".readerThemePreview {");
    const previewEnd = css.indexOf("}", previewStart);
    const previewRule = css.slice(previewStart, previewEnd);
    expect(previewRule).toMatch(/transition:[^}]*border-color[^}]*box-shadow[^}]*transform/s);

    const activeStart = css.indexOf(".readerThemePreviewActive {");
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).toContain("box-shadow");
    expect(activeRule).toContain("translate3d(0, -1px, 0)");

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.readerThemePreview,[\s\S]*?\.readerThemePreviewActive,[\s\S]*?\.readerThemePreview:active\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });

  it("gives touch rows and sheet actions compositor-only pressed feedback", () => {
    const navStart = css.indexOf(".settingsNavRow {");
    const navEnd = css.indexOf("}", navStart);
    const navRule = css.slice(navStart, navEnd);
    expect(navRule).toContain("transform");
    expect(navRule).not.toContain("will-change");

    const navActiveStart = css.indexOf(".settingsNavRow:active {");
    const navActiveEnd = css.indexOf("}", navActiveStart);
    const navActiveRule = css.slice(navActiveStart, navActiveEnd);
    expect(navActiveRule).toContain("translate3d(0, 1px, 0)");

    const actionStart = css.indexOf(".customBackgroundActions button {");
    const actionEnd = css.indexOf("}", actionStart);
    const actionRule = css.slice(actionStart, actionEnd);
    expect(actionRule).toContain("transform");

    const actionActiveStart = css.indexOf(".customBackgroundActions button:active {");
    const actionActiveEnd = css.indexOf("}", actionActiveStart);
    const actionActiveRule = css.slice(actionActiveStart, actionActiveEnd);
    expect(actionActiveRule).toContain("scale(0.985)");
  });

  it("gives primary touch controls consistent pressed motion", () => {
    const tabStart = css.indexOf(".tab {");
    const tabEnd = css.indexOf("}", tabStart);
    const tabRule = css.slice(tabStart, tabEnd);
    expect(tabRule).toContain("transform");
    expect(tabRule).not.toContain("will-change");

    const tabActiveStart = css.indexOf(".tab:not(:disabled):active {");
    const tabActiveEnd = css.indexOf("}", tabActiveStart);
    const tabActiveRule = css.slice(tabActiveStart, tabActiveEnd);
    expect(tabActiveRule).toContain("scale(0.96)");

    const tabIconStart = css.indexOf(".tabIcon {");
    const tabIconEnd = css.indexOf("}", tabIconStart);
    const tabIconRule = css.slice(tabIconStart, tabIconEnd);
    expect(tabIconRule).toContain("transform");

    const tabLabelStart = css.indexOf(".tabLabel {");
    const tabLabelEnd = css.indexOf("}", tabLabelStart);
    const tabLabelRule = css.slice(tabLabelStart, tabLabelEnd);
    expect(tabLabelRule).toContain("transform");
    expect(tabLabelRule).toMatch(/transition:[^}]*transform/s);

    expect(css).toMatch(
      /\.activeTab\s+\.tabIcon\s*\{[^}]*translate3d\(0,\s*-1px,\s*0\)[^}]*scale\(1\.04\)/s
    );
    expect(css).toMatch(
      /\.activeTab\s+\.tabLabel\s*\{[^}]*translate3d\(0,\s*-1px,\s*0\)/s
    );
    expect(css).toMatch(
      /\.tab:not\(:disabled\):active\s+\.tabLabel\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)[^}]*scale\(0\.96\)/s
    );

    const reduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".tab.activeTab:hover {")
    );
    const reduceEnd = css.indexOf(
      "}",
      css.indexOf(".tab:not(:disabled):active .tabLabel", reduceStart)
    );
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".tabIcon",
      ".activeTab .tabIcon",
      ".tab:not(:disabled):active .tabIcon",
      ".tabLabel",
      ".activeTab .tabLabel",
      ".tab:not(:disabled):active .tabLabel",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
    expect(reduceRule).toContain("transform: none;");

    const switchStart = css.indexOf(".iosSwitch {");
    const switchEnd = css.indexOf("}", switchStart);
    const switchRule = css.slice(switchStart, switchEnd);
    expect(switchRule).toContain("--switch-press-scale: 1");

    const switchKnobStart = css.indexOf(".iosSwitch::after {");
    const switchKnobEnd = css.indexOf("}", switchKnobStart);
    const switchKnobRule = css.slice(switchKnobStart, switchKnobEnd);
    expect(switchKnobRule).toContain("scale(var(--switch-press-scale))");

    const libraryActionActiveStart = css.indexOf(
      ".libraryActionButton:not(:disabled):active {"
    );
    const libraryActionActiveEnd = css.indexOf(
      "}",
      libraryActionActiveStart
    );
    const libraryActionActiveRule = css.slice(
      libraryActionActiveStart,
      libraryActionActiveEnd
    );
    expect(libraryActionActiveRule).toContain("scale(0.96)");
  });

  it("gives compact segmented and collection controls pressed motion", () => {
    for (const selector of [
      ".settingsSegmentControl button {",
      ".libraryViewToggle button {",
      ".collectionRow {",
      ".collectionRowMain {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toContain("transform");
      expect(rule).toMatch(/transition:[^}]*transform/s);
    }

    expect(css).toMatch(
      /\.settingsSegmentControl\s+button:not\(:disabled\):active\s*\{[^}]*scale\(0\.94\)/s
    );
    expect(css).toMatch(
      /\.libraryViewToggle\s+button:not\(:disabled\):active\s*\{[^}]*scale\(0\.94\)/s
    );
    expect(css).toMatch(
      /\.libraryViewToggle\s+\.libraryViewActive\s*\{[^}]*transform:\s*scale\(1\)/s
    );
    expect(css).toMatch(
      /\.collectionRow:active\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)/s
    );
    expect(css).toMatch(
      /\.collectionRowMain:active\s*\{[^}]*translate3d\(0,\s*1px,\s*0\)/s
    );

    const reduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".settingsSegmentControl button:not(:disabled):active")
    );
    const reduceEnd = css.indexOf(
      "}",
      css.indexOf(".collectionRowMain:active", reduceStart)
    );
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".settingsSegmentControl button",
      ".settingsSegmentControl button:not(:disabled):active",
      ".libraryViewToggle button",
      ".libraryViewToggle button:not(:disabled):active",
      ".libraryViewToggle .libraryViewActive",
      ".collectionRow",
      ".collectionRow:active",
      ".collectionRowMain",
      ".collectionRowMain:active",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
    expect(reduceRule).toContain("transform: none;");
  });

  it("gives active collection rows a stronger selected affordance", () => {
    const rowStart = css.indexOf(".collectionRow {");
    const rowEnd = css.indexOf("}", rowStart);
    const rowRule = css.slice(rowStart, rowEnd);
    expect(rowRule).toMatch(
      /transition:[^}]*background[^}]*box-shadow[^}]*transform/s
    );

    const iconStart = css.indexOf(".collectionRowIcon {");
    const iconEnd = css.indexOf("}", iconStart);
    const iconRule = css.slice(iconStart, iconEnd);
    expect(iconRule).toContain("transform");
    expect(iconRule).toMatch(/transition:[^}]*color[^}]*transform/s);

    const chevronStart = css.indexOf(".collectionRowChevron {");
    const chevronEnd = css.indexOf("}", chevronStart);
    const chevronRule = css.slice(chevronStart, chevronEnd);
    expect(chevronRule).toContain("transform");
    expect(chevronRule).toMatch(/transition:[^}]*color[^}]*transform/s);

    const activeStart = css.indexOf(".collectionRowActive {");
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).toContain("box-shadow");

    expect(css).toMatch(
      /\.collectionRowActive\s+\.collectionRowIcon\s*\{[^}]*color:\s*var\(--tint\)[^}]*scale\(1\.04\)/s
    );
    expect(css).toMatch(
      /\.collectionRowActive\s+\.collectionRowChevron\s*\{[^}]*color:\s*var\(--tint\)[^}]*translate3d\(2px,\s*0,\s*0\)/s
    );

    const reduceStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce)",
      css.indexOf(".collectionRowActive .collectionRowChevron")
    );
    const reduceEnd = css.indexOf(
      "}",
      css.indexOf(".collectionRowActive .collectionRowChevron", reduceStart)
    );
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".collectionRow",
      ".collectionRowIcon",
      ".collectionRowChevron",
      ".collectionRowActive .collectionRowIcon",
      ".collectionRowActive .collectionRowChevron",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
    expect(reduceRule).toContain("transform: none;");
  });

  it("gives provider sheet controls consistent pressed motion", () => {
    for (const selector of [
      ".providerNavButton {",
      ".providerRefreshButton {",
      ".providerChoiceRow,",
      ".providerManualModelRow button {",
      ".providerPrimaryButton,",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toContain("transform");
    }

    for (const selector of [
      ".providerNavButton:active {",
      ".providerRefreshButton:active {",
      ".providerChoiceRow:active {",
      ".providerModelRow:active {",
      ".providerManualModelRow button:active {",
      ".providerPrimaryButton:not(:disabled):active,",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toMatch(/scale\(0\.9[4-8]\)|translate3d\(0,\s*1px,\s*0\)/);
    }

    const grabberStart = css.indexOf(".sheetDragHandle:active .sheetGrabber {");
    const grabberEnd = css.indexOf("}", grabberStart);
    const grabberRule = css.slice(grabberStart, grabberEnd);
    expect(grabberRule).toContain("scaleX(1.2)");
  });

  it("animates provider selection affordances without layout motion", () => {
    for (const selector of [
      ".providerChoiceIcon {",
      ".providerModelCheck {",
      ".providerActiveBadge {",
      ".providerChoiceChevron {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toContain("transform");
      expect(rule).toMatch(/transition:[^}]*opacity[^}]*transform|transition:[^}]*transform[^}]*opacity/s);
      expect(rule).not.toMatch(
        /transition:[^;}]*\b(?:top|left|width|height|margin)\b/
      );
    }

    expect(css).toMatch(
      /\.providerModelRow:active\s+\.providerChoiceIcon\s*\{[^}]*scale\(0\.94\)/s
    );
    expect(css).toMatch(
      /\.providerModelRow\[data-selected="true"\]\s*\{[^}]*background:[^}]*color-mix/s
    );
    expect(css).toMatch(
      /\.providerModelRow\[data-selected="true"\]\s+\.providerChoiceIcon\s*\{[^}]*scale\(1\.04\)/s
    );
    const reduceStart = css.indexOf("@media (prefers-reduced-motion: reduce)", css.indexOf(".providerChoiceIcon"));
    const reduceEnd = css.indexOf("}", css.indexOf("transition: none;", reduceStart));
    const reduceRule = css.slice(reduceStart, reduceEnd);
    for (const selector of [
      ".providerChoiceIcon",
      ".providerModelCheck",
      ".providerActiveBadge",
      ".providerChoiceChevron",
    ]) {
      expect(reduceRule).toContain(selector);
    }
    expect(reduceRule).toContain("transition: none;");
  });

  it("gives library filter chips tactile state transitions", () => {
    const chipStart = css.indexOf(".groupChip {");
    const chipEnd = css.indexOf("}", chipStart);
    const chipRule = css.slice(chipStart, chipEnd);
    expect(chipRule).toContain("transform");
    expect(chipRule).toMatch(
      /transition:[^}]*background[^}]*color[^}]*border-color[^}]*transform/s
    );

    const activeStart = css.indexOf(".groupChipActive {");
    const activeEnd = css.indexOf("}", activeStart);
    const activeRule = css.slice(activeStart, activeEnd);
    expect(activeRule).toContain("transform: scale(1)");

    const pressStart = css.indexOf(".groupChip:not(:disabled):active {");
    const pressEnd = css.indexOf("}", pressStart);
    const pressRule = css.slice(pressStart, pressEnd);
    expect(pressRule).toContain("scale(0.96)");
  });

  it("gives provider text fields a calm focus transition", () => {
    for (const selector of [
      ".providerFormRow:focus-within {",
      ".providerManualModelRow:focus-within {",
    ]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      const rule = css.slice(start, end);
      expect(rule).toContain("background");
      expect(rule).toContain("transform");
    }

    const inputStart = css.indexOf(".providerManualModelRow input {");
    const inputEnd = css.indexOf("}", inputStart);
    const inputRule = css.slice(inputStart, inputEnd);
    expect(inputRule).toMatch(/transition:[^}]*background[^}]*box-shadow/s);

    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.providerFormRow,[\s\S]*?\.providerManualModelRow,[\s\S]*?\.providerManualModelRow input\s*\{[\s\S]*?transition:\s*none;/s
    );
  });
});
