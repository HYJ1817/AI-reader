import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UI_TEXT } from "./uiText";

const goal = readFileSync(
  new URL("../app/ReadingGoalSheet.tsx", import.meta.url),
  "utf8"
);
const provider = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);
const workspace = readFileSync(
  new URL("../app/ReadingWorkspaceSheet.tsx", import.meta.url),
  "utf8"
);

describe("closed-grade copy and glyph polish", () => {
  it("keeps reading-goal feedback factual", () => {
    expect(goal).toContain("今日已阅读 {todayMinutes} 分钟");
    expect(goal).not.toContain("继续保持阅读节奏");
    expect(goal).not.toContain("你正朝着每日目标奋进");
    expect(UI_TEXT.READING_GOAL_SUBTITLE).toBe(
      "设置每日阅读时长，进度仅保存在本机。"
    );
  });

  it("uses local SVG glyphs on the touched provider controls", () => {
    expect(provider).toContain("<AddIcon");
    expect(provider).toContain("<ImportIcon");
    expect(provider).toContain("<ChevronRightIcon");
    expect(provider).toContain("<CheckIcon");
    expect(provider).not.toContain('<span aria-hidden="true">↥</span>');
  });

  it("uses an SVG session-menu glyph", () => {
    expect(workspace).toContain("<MoreHorizontalIcon");
    expect(workspace).not.toContain("•••");
  });
});
