export type ReadingDashboardState =
  | "empty-library"
  | "imported-unread"
  | "active-reading"
  | "populated-week";

export type ReadingDashboardPresentation = {
  state: ReadingDashboardState;
  primaryHeading: string;
  primaryActionLabel: string;
  showGoal: boolean;
  showWeek: boolean;
  showProgress: boolean;
};

export function buildReadingDashboardPresentation(input: {
  hasBook: boolean;
  progressPercent: number;
  totalMinutes: number;
}): ReadingDashboardPresentation {
  const progressPercent = Number.isFinite(input.progressPercent)
    ? Math.max(0, input.progressPercent)
    : 0;
  const totalMinutes = Number.isFinite(input.totalMinutes)
    ? Math.max(0, input.totalMinutes)
    : 0;

  if (!input.hasBook) {
    return {
      state: "empty-library",
      primaryHeading: "开始阅读",
      primaryActionLabel: "导入图书",
      showGoal: false,
      showWeek: false,
      showProgress: false,
    };
  }

  const showProgress = progressPercent > 0;
  const showWeek = totalMinutes > 0;

  return {
    state: showWeek
      ? "populated-week"
      : showProgress
        ? "active-reading"
        : "imported-unread",
    primaryHeading: showProgress ? "继续阅读" : "开始阅读",
    primaryActionLabel: showProgress ? "继续阅读" : "开始阅读",
    showGoal: true,
    showWeek,
    showProgress,
  };
}
