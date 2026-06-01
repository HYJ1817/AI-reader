import { getReadingGoalArcPercent } from "./readingGoalDisplay";

type BuildLibraryDashboardInput = {
  bookCount: number;
  groupCount: number;
  todayMinutes: number;
  targetMinutes: number;
  featuredTitle?: string | null;
};

type LibraryDashboardStat = {
  label: string;
  value: string;
};

export type LibraryDashboard = {
  title: string;
  subtitle: string;
  goalText: string;
  goalPercent: number;
  stats: LibraryDashboardStat[];
};

export function buildLibraryDashboard({
  bookCount,
  groupCount,
  todayMinutes,
  targetMinutes,
  featuredTitle,
}: BuildLibraryDashboardInput): LibraryDashboard {
  const safeBookCount = Math.max(0, Math.floor(bookCount));
  const safeGroupCount = Math.max(0, Math.floor(groupCount));
  const safeTodayMinutes = Math.max(0, Math.floor(todayMinutes));
  const safeTargetMinutes = Math.max(1, Math.floor(targetMinutes));
  const title = featuredTitle?.trim();

  return {
    title: title ? "现在阅读" : "整理你的书库",
    subtitle: title
      ? `继续阅读《${title}》`
      : "导入 EPUB 或 TXT 后，这里会显示正在阅读、进度和目标。",
    goalText: `${safeTodayMinutes}/${safeTargetMinutes} 分钟`,
    goalPercent: getReadingGoalArcPercent(safeTodayMinutes, safeTargetMinutes),
    stats: [
      { label: "图书", value: String(safeBookCount) },
      { label: "分组", value: String(safeGroupCount) },
      { label: "今日", value: `${safeTodayMinutes}分` },
    ],
  };
}
