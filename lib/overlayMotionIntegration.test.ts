import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bottomSheetSource = readFileSync(
  new URL("../app/BottomSheet.tsx", import.meta.url),
  "utf8"
);
const motionSheetUrl = new URL("../app/MotionSheet.tsx", import.meta.url);
const motionSheetSource = existsSync(motionSheetUrl)
  ? readFileSync(motionSheetUrl, "utf8")
  : "";
const librarySource = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const aiSettingsUrl = new URL("../app/AiSettingsSurface.tsx", import.meta.url);
const aiSettingsSource = existsSync(aiSettingsUrl)
  ? readFileSync(aiSettingsUrl, "utf8")
  : "";
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("overlay and nested view motion", () => {
  it("adapts the legacy sheet contract to one interruptible Motion owner", () => {
    expect(bottomSheetSource).toContain('import MotionSheet from "./MotionSheet"');
    expect(bottomSheetSource).toContain("return <MotionSheet {...props} />");
    expect(motionSheetSource).toContain("AnimatePresence");
    expect(motionSheetSource).toContain("useMotionValue");
    expect(motionSheetSource).toContain("useTransform");
    expect(motionSheetSource).toContain('drag="y"');
    expect(motionSheetSource).toContain("dragControls");
    expect(motionSheetSource).toContain("shouldCompleteSheetDismiss");
    expect(motionSheetSource).toContain("onExitComplete={finishClose}");
    expect(motionSheetSource).toContain("useAppReducedMotion");
    expect(motionSheetSource).not.toContain("requestAnimationFrame");
    expect(motionSheetSource).not.toContain("setTimeout");
    expect(motionSheetSource).not.toContain("panel.style");
  });

  it("removes standalone keyframes from library and AI nested views", () => {
    for (const source of [librarySource, aiSettingsSource]) {
      expect(source).not.toContain("subviewEnterForward");
      expect(source).not.toContain("subviewEnterBackward");
    }

    expect(css).not.toContain(".subviewEnterForward");
    expect(css).not.toContain(".subviewEnterBackward");
    expect(css).not.toContain("@keyframes subviewInForward");
    expect(css).not.toContain("@keyframes subviewInBackward");
  });

  it("removes phase classes once Motion owns transforms and presence", () => {
    for (const legacy of [
      "motionSheetEntering",
      "motionSheetOpen",
      "motionSheetSettling",
      "motionSheetClosing",
      "motionSheetDragging",
    ]) {
      expect(bottomSheetSource + motionSheetSource).not.toContain(legacy);
      expect(css).not.toContain(`.${legacy}`);
    }
  });
});
