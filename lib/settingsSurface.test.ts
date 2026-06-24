import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
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
});
