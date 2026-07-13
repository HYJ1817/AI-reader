import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
  "utf8"
);
const backgroundSheetSource = readFileSync(
  new URL("../app/CustomBackgroundSettingsSheet.tsx", import.meta.url),
  "utf8"
);
const backgroundSurfaceUrl = new URL(
  "../app/CustomBackgroundSettingsSurface.tsx",
  import.meta.url
);
const backgroundSurfaceSource = existsSync(backgroundSurfaceUrl)
  ? readFileSync(backgroundSurfaceUrl, "utf8")
  : "";
const hookSource = readFileSync(
  new URL("../app/useCustomBackground.ts", import.meta.url),
  "utf8"
);
const cssSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssRule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

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
    expect(source).toContain("onOpenCustomBackgroundSettings");
    expect(source).toContain("backgroundInputRef.current?.click()");
    expect(source).toContain('accept="image/*"');
    expect(source).toContain("customBackgroundAvailable");
    expect(source).not.toContain("styles.customBackgroundPanel");
    expect(source).not.toContain("customBackgroundSettingsOpen");
    expect(source).not.toContain("CustomBackgroundSettingsSheet");
  });

  it("exposes native push callbacks for settings subviews", () => {
    expect(source).toContain("onOpenAiProviders");
    expect(source).toContain("onOpenCustomBackgroundSettings");
    expect(source).not.toContain("useState");
  });

  it("keeps native checkboxes while projecting one motion thumb per switch", () => {
    expect(source).toContain("NativeMotionSwitch");
    expect(source).toContain('type="checkbox"');
    expect(source).toContain("styles.motionSwitchInput");
    expect(source).toContain("styles.motionSwitchThumb");
    expect(source).toContain("layoutId={reduceMotion ? undefined :");
    expect(source).toContain("settings-switch-thumb-${id}");
    expect(source).toContain("useAppReducedMotion");
  });

  it("shows custom background controls in a pushed surface with a compatibility sheet", () => {
    expect(backgroundSheetSource).toContain("<BottomSheet");
    expect(backgroundSheetSource).toContain("CustomBackgroundSettingsSurface");
    expect(backgroundSurfaceSource).toContain("customBackgroundPreviewUrl");
    expect(backgroundSurfaceSource).toContain("styles.customBackgroundPreview");
    expect(backgroundSurfaceSource).toContain("styles.customBackgroundPreviewImage");
    expect(backgroundSurfaceSource).toContain("customBackgroundPreviewStyle");
    expect(backgroundSurfaceSource).toContain('"--custom-background-preview-blur"');
    expect(backgroundSurfaceSource).toContain("<img");
    expect(backgroundSurfaceSource).toContain("src={customBackgroundPreviewUrl}");
    expect(backgroundSurfaceSource).toContain("UI_TEXT.BACKGROUND_PREVIEW");
    expect(backgroundSurfaceSource).toContain('type="range"');
    expect(backgroundSurfaceSource).toContain('min="0"');
    expect(backgroundSurfaceSource).toContain('max="1"');
    expect(backgroundSurfaceSource).toContain('step="0.05"');
    expect(backgroundSurfaceSource).toContain("customBackgroundOpacity");
    expect(backgroundSurfaceSource).toContain("UI_TEXT.BACKGROUND_OPACITY");
    expect(backgroundSurfaceSource).toContain("onClearBackground");
    expect(backgroundSurfaceSource).not.toContain("opacity: appPreferences.customBackgroundOpacity");
    expect(cssSource).toContain(".customBackgroundPreview");
    expect(cssSource).toContain(".customBackgroundPreviewImage");
    expect(cssSource).toContain(".bottomSheet.customBackgroundSettingsSheet");
    expect(
      cssRule(cssSource, ".bottomSheet.customBackgroundSettingsSheet")
    ).toContain("height: calc(100dvh - var(--safe-top) - 12px)");
    expect(cssRule(cssSource, ".customBackgroundSettingsSheet")).toContain(
      "background: var(--app-bg)"
    );
    expect(cssRule(cssSource, ".customBackgroundSheetCard")).toContain(
      "background: var(--surface-primary)"
    );
    expect(cssRule(cssSource, ".customBackgroundPreviewImage")).toContain(
      "object-fit: contain"
    );
    expect(cssRule(cssSource, ".customBackgroundPreviewImage")).toContain(
      "filter: blur(var(--custom-background-preview-blur))"
    );
    expect(cssRule(cssSource, ".customBackgroundPreview")).not.toContain(
      "background-size: cover"
    );
    expect(cssSource).toContain(".backgroundOpacitySlider");
  });

  it("owns and releases the custom background preview URL", () => {
    expect(hookSource).toContain("customBackgroundPreviewUrl");
    expect(hookSource).toContain("URL.createObjectURL");
    expect(hookSource).toContain("URL.revokeObjectURL");
  });
});
