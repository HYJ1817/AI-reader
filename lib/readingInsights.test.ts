import { describe, expect, it } from "vitest";
import { buildSevenDayReadingInsights, totalReadingMinutes } from "./readingInsights";
import type { DailyReadingStat } from "./db";

function stat(date: string, secondsRead: number): DailyReadingStat {
  return { date, secondsRead, updatedAt: "2026-05-30T00:00:00Z" };
}

describe("buildSevenDayReadingInsights", () => {
  it("returns seven days ending with today", () => {
    const insights = buildSevenDayReadingInsights([], "2026-05-30", 120);
    expect(insights).toHaveLength(7);
    expect(insights[0].date).toBe("2026-05-24");
    expect(insights[6].date).toBe("2026-05-30");
    expect(insights[6].label).toBe("今");
    expect(insights[6].isToday).toBe(true);
  });

  it("maps seconds to minutes and clamps progress", () => {
    const insights = buildSevenDayReadingInsights(
      [stat("2026-05-29", 3600), stat("2026-05-30", 18000)],
      "2026-05-30",
      120
    );

    expect(insights[5].minutes).toBe(60);
    expect(insights[5].progress).toBe(0.5);
    expect(insights[6].minutes).toBe(300);
    expect(insights[6].progress).toBe(1);
  });

  it("uses a safe target when target is invalid", () => {
    const insights = buildSevenDayReadingInsights([stat("2026-05-30", 60)], "2026-05-30", 0);
    expect(insights[6].progress).toBe(1);
  });
});

describe("totalReadingMinutes", () => {
  it("sums valid positive reading seconds", () => {
    expect(totalReadingMinutes([
      stat("2026-05-28", 90),
      stat("2026-05-29", 3600),
      stat("2026-05-30", -30),
    ])).toBe(61);
  });
});
