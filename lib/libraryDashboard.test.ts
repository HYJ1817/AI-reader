import { describe, expect, it } from "vitest";
import { buildLibraryDashboard } from "./libraryDashboard";

describe("buildLibraryDashboard", () => {
  it("builds an active dashboard when there is a featured book", () => {
    const dashboard = buildLibraryDashboard({
      bookCount: 6,
      groupCount: 2,
      todayMinutes: 11,
      targetMinutes: 120,
      featuredTitle: "高兴",
    });

    expect(dashboard.title).toBe("现在阅读");
    expect(dashboard.subtitle).toBe("继续阅读《高兴》");
    expect(dashboard.goalText).toBe("11/120 分钟");
    expect(dashboard.goalPercent).toBe(9.2);
    expect(dashboard.stats).toEqual([
      { label: "图书", value: "6" },
      { label: "分组", value: "2" },
      { label: "今日", value: "11分" },
    ]);
  });

  it("builds an empty dashboard prompt before books are imported", () => {
    const dashboard = buildLibraryDashboard({
      bookCount: 0,
      groupCount: 0,
      todayMinutes: 0,
      targetMinutes: 120,
      featuredTitle: null,
    });

    expect(dashboard.title).toBe("整理你的书库");
    expect(dashboard.subtitle).toBe("导入 EPUB 或 TXT 后，这里会显示正在阅读、进度和目标。");
    expect(dashboard.goalText).toBe("0/120 分钟");
    expect(dashboard.goalPercent).toBe(0);
  });
});
