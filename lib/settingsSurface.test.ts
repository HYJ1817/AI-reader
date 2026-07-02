import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
  "utf8"
);
const hookSource = readFileSync(
  new URL("../app/useCustomBackground.ts", import.meta.url),
  "utf8"
);
const cssSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("settings surface copy", () => {
  it("omits explanatory hints from switch rows", () => {
    for (const hint of [
      "UI_TEXT.AUTO_OPEN_LAST_BOOK_HINT",
      "UI_TEXT.KEEP_SCREEN_AWAKE_HINT",
      "UI_TEXT.REDUCE_MOTION_HINT",
      "UI_TEXT.SWIPE_TO_TURN_HINT",
    ]) {
      expect(source).not.toContain(hint);
    }
  });

  it("keeps secondary status text on navigation rows", () => {
    expect(source).toContain("activeProviderLabel ??");
    expect(source).toContain("<small>{readerThemeLabel}</small>");
    expect(source).toContain("todayMinutes");
    expect(source).toContain("targetMinutes");
  });

  it("exposes background mode controls and image selection", () => {
    expect(source).toContain("UI_TEXT.BACKGROUND");
    expect(source).toContain('onBackgroundModeChange("auto")');
    expect(source).toContain('onBackgroundModeChange("custom")');
    expect(source).toContain("backgroundInputRef.current?.click()");
    expect(source).toContain('accept="image/*"');
    expect(source).toContain("customBackgroundAvailable");
    expect(source).toContain("onClearBackground");
  });

  it("shows custom background preview and opacity controls", () => {
    expect(source).toContain("customBackgroundPreviewUrl");
    expect(source).toContain("styles.customBackgroundPreview");
    expect(source).toContain("UI_TEXT.BACKGROUND_PREVIEW");
    expect(source).toContain('type="range"');
    expect(source).toContain('min="0"');
    expect(source).toContain('max="1"');
    expect(source).toContain('step="0.05"');
    expect(source).toContain("customBackgroundOpacity");
    expect(source).toContain("UI_TEXT.BACKGROUND_OPACITY");
    expect(source).not.toContain("opacity: appPreferences.customBackgroundOpacity");
    expect(cssSource).toContain(".customBackgroundPreview");
    expect(cssSource).toContain(".backgroundOpacitySlider");
  });

  it("owns and releases the custom background preview URL", () => {
    expect(hookSource).toContain("customBackgroundPreviewUrl");
    expect(hookSource).toContain("URL.createObjectURL");
    expect(hookSource).toContain("URL.revokeObjectURL");
  });
});
