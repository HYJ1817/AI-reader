import { describe, expect, it } from "vitest";
import { buildReadingDashboardPresentation } from "./readingDashboardPresentation";

describe("reading dashboard presentation", () => {
  it("makes import the only low-data action for an empty library", () => {
    expect(
      buildReadingDashboardPresentation({
        hasBook: false,
        progressPercent: 0,
        totalMinutes: 0,
      })
    ).toEqual({
      state: "empty-library",
      primaryHeading: "开始阅读",
      primaryActionLabel: "导入图书",
      showGoal: false,
      showWeek: false,
      showProgress: false,
    });
  });

  it("offers start reading after import without showing an empty chart", () => {
    expect(
      buildReadingDashboardPresentation({
        hasBook: true,
        progressPercent: 0,
        totalMinutes: 0,
      })
    ).toEqual({
      state: "imported-unread",
      primaryHeading: "开始阅读",
      primaryActionLabel: "开始阅读",
      showGoal: true,
      showWeek: false,
      showProgress: false,
    });
  });

  it("offers continue reading when the book has progress", () => {
    expect(
      buildReadingDashboardPresentation({
        hasBook: true,
        progressPercent: 42,
        totalMinutes: 0,
      })
    ).toEqual({
      state: "active-reading",
      primaryHeading: "继续阅读",
      primaryActionLabel: "继续阅读",
      showGoal: true,
      showWeek: false,
      showProgress: true,
    });
  });

  it("reveals the week only when recorded minutes exist", () => {
    expect(
      buildReadingDashboardPresentation({
        hasBook: true,
        progressPercent: 42,
        totalMinutes: 65,
      })
    ).toEqual({
      state: "populated-week",
      primaryHeading: "继续阅读",
      primaryActionLabel: "继续阅读",
      showGoal: true,
      showWeek: true,
      showProgress: true,
    });
  });
});
