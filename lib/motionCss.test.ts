import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
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
    expect(css).toContain("--motion-sheet-exit: 260ms;");
    expect(css).toContain(
      "--ease-sheet-settle: cubic-bezier(0.2, 0.86, 0.18, 1);"
    );
    expect(css).toContain(
      "--ease-navigation: cubic-bezier(0.32, 0.72, 0, 1);"
    );
    expect(css).toMatch(
      /\.appSurface\s*\{[^}]*opacity\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)[^}]*transform\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.tabIndicator\s*\{[^}]*transition:\s*transform\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.readerShell\s*\{[^}]*opacity\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)[^}]*transform\s+var\(--motion-navigation\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.motionSheetOverlay\s*\{[^}]*opacity\s+var\(--motion-sheet\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.motionSheetOverlay\s+\.bottomSheet\s*\{[^}]*transform\s+var\(--motion-sheet\)\s+var\(--ease-navigation\)/s
    );
    expect(css).toMatch(
      /\.motionSheetClosing\s+\.bottomSheet\s*\{[^}]*transition-duration:\s*var\(--motion-sheet-exit\)[^}]*transition-timing-function:\s*var\(--ease-sheet-settle\)/s
    );
    expect(css).toMatch(
      /\.motionSheetSettling\s+\.bottomSheet\s*\{[^}]*transition-duration:\s*var\(--motion-sheet-settle\)[^}]*transition-timing-function:\s*var\(--ease-sheet-settle\)/s
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.app,[\s\S]*?transition-duration:\s*0\.001ms !important;/s
    );
    for (const selector of [".appSurface {", ".tabIndicator {", ".readerShell {"]) {
      const start = css.indexOf(selector);
      const end = css.indexOf("}", start);
      expect(css.slice(start, end)).toContain(
        "will-change: transform, opacity"
      );
    }
  });

  it("uses a visible 36 pixel horizontal push for tabs and reader presentation", () => {
    expect(css).toMatch(
      /\.appSurface\s*\{[^}]*transform:\s*translate3d\(36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.appSurfaceBefore\s*\{[^}]*translate3d\(-36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.appSurfaceAfter\s*\{[^}]*translate3d\(36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readerSessionInactive\s*\{[^}]*transform:\s*translate3d\(36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readingDashboardReaderOpen\s*\{[^}]*transform:\s*translate3d\(-36px,\s*0,\s*0\)/s
    );
    expect(css).toMatch(
      /\.readingDashboardReaderOpen\s*\{[^}]*transition-delay:\s*0s,\s*0s,\s*var\(--motion-navigation\)/s
    );
  });

  it("keeps the moving sheet shadow within a restrained paint budget", () => {
    expect(css).toContain("--shadow-sheet: 0 -8px 18px rgba(0, 0, 0, 0.16);");
  });

  it("uses persistent tab surfaces instead of display switching or mount fades", () => {
    expect(css).not.toContain(".tabPageInactive");
    expect(css).not.toContain("@keyframes pageFadeIn");
    expect(css).toMatch(
      /\.appSurface\s*\{[^}]*transition:[^}]*opacity[^}]*transform/s
    );
  });

  it("moves one shared tab indicator with a compositor transform", () => {
    expect(css).toMatch(
      /\.tabIndicator\s*\{[^}]*transform:\s*translate3d\(calc\(var\(--tab-index\)\s*\*\s*100%\),\s*0,\s*0\)/s
    );
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

  it("keeps a dismissing sheet available for an interrupting drag", () => {
    const start = css.indexOf(".motionSheetClosing {");
    const end = css.indexOf("}", start);
    const rule = css.slice(start, end);
    expect(rule).not.toContain("pointer-events: none");
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
    const hiddenStart = css.indexOf(
      ".readerChromeControlsHidden .readerMenuRow {"
    );
    const hiddenEnd = css.indexOf("}", hiddenStart);
    const hiddenRule = css.slice(hiddenStart, hiddenEnd);
    expect(hiddenRule).toContain("translate3d(0, 18px, 0)");

    const pageStart = css.indexOf(
      ".readerChromeControlsHidden .readerPagePill {"
    );
    const pageEnd = css.indexOf("}", pageStart);
    const pageRule = css.slice(pageStart, pageEnd);
    expect(pageRule).toContain("translateX(-50%) translateY(10px)");
  });

  it("stagers individual reader menu capsules", () => {
    expect(css).toContain(".readerActionMenu");
    expect(css).toContain(".readerMenuRow:nth-child(2)");
    expect(css).toContain(".readerMenuRow:nth-child(3)");
    expect(css).toContain("90ms, 90ms");
    expect(css).toContain("180ms, 180ms");
    expect(css).toMatch(
      /\.readerMenuRow\s*\{[^}]*border-radius:\s*999px;[^}]*opacity\s+320ms\s+var\(--ease-emphasized\)[^}]*transform\s+320ms\s+var\(--ease-emphasized\)/s
    );
  });

  it("removes reader menu travel when motion is reduced", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.readerPagePill,[\s\S]*?\.readerOverlayBack,[\s\S]*?\.readerMenuRow\s*\{[\s\S]*?transition:\s*none;[\s\S]*?transform:\s*none;/s
    );
  });

  it("gives reader chrome a tactile pressed state without moving blur layers", () => {
    const backActiveStart = css.indexOf(".readerOverlayBack:active {");
    const backActiveEnd = css.indexOf("}", backActiveStart);
    const backActiveRule = css.slice(backActiveStart, backActiveEnd);
    expect(backActiveRule).toContain("scale(0.94)");

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
    expect(navRule).toContain("will-change: transform");

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
    expect(tabRule).toContain("will-change: transform");

    const tabActiveStart = css.indexOf(".tab:not(:disabled):active {");
    const tabActiveEnd = css.indexOf("}", tabActiveStart);
    const tabActiveRule = css.slice(tabActiveStart, tabActiveEnd);
    expect(tabActiveRule).toContain("scale(0.96)");

    const tabIconStart = css.indexOf(".tabIcon {");
    const tabIconEnd = css.indexOf("}", tabIconStart);
    const tabIconRule = css.slice(tabIconStart, tabIconEnd);
    expect(tabIconRule).toContain("transform");

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
