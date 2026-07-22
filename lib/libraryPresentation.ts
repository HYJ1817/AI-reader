import { formatLibraryProgressLabel } from "./libraryProgress";
import { normalizeProgressPercent } from "./readerProgress";

const bookDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export type LibraryBookPresentation = {
  state: "unread" | "active" | "finished";
  sourceLabel: string;
  lastReadLabel: string;
  progressLabel: string;
  progressPercent: number;
  showProgress: boolean;
};

export function formatBookSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function fileStem(fileName: string): string {
  return fileName.trim().replace(/\.[^.]+$/, "").trim();
}

function comparableTitle(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

export function formatLibraryBookSource(
  title: string,
  fileName: string
): string {
  const source = fileStem(fileName);
  if (!source || comparableTitle(source) === comparableTitle(title)) {
    return "本地图书";
  }
  return source;
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatLibraryLastOpened(
  value?: string,
  now = new Date()
): string {
  if (!value) return "尚未阅读";
  const opened = new Date(value);
  if (Number.isNaN(opened.getTime())) return "阅读时间未知";
  if (isSameLocalDay(opened, now)) return "今天阅读";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(opened, yesterday)) return "昨天阅读";

  const monthDay = `${opened.getMonth() + 1}月${opened.getDate()}日阅读`;
  return opened.getFullYear() === now.getFullYear()
    ? monthDay
    : `${opened.getFullYear()}年${monthDay}`;
}

export function buildLibraryBookPresentation(
  book: { title: string; fileName: string; lastOpenedAt?: string },
  progressPercent: number,
  now = new Date()
): LibraryBookPresentation {
  const progress = normalizeProgressPercent(progressPercent);
  return {
    state: progress >= 100 ? "finished" : progress > 0 ? "active" : "unread",
    sourceLabel: formatLibraryBookSource(book.title, book.fileName),
    lastReadLabel: formatLibraryLastOpened(book.lastOpenedAt, now),
    progressLabel: formatLibraryProgressLabel(progress),
    progressPercent: progress,
    showProgress: progress > 0,
  };
}

export function formatBookDate(value?: string): string {
  if (!value) return "从未";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return bookDateFormatter.format(date);
}
