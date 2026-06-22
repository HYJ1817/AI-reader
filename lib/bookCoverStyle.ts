const PAPER_COLORS = [
  "#f1eee7",
  "#e9edf0",
  "#eee9e3",
  "#e8ece7",
  "#ece8ed",
];

const SPINE_COLORS = [
  "#385f71",
  "#715244",
  "#516a55",
  "#66547a",
  "#7a4f5b",
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function normalizeCoverTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ") || "未命名";
}

export function createFallbackCoverStyle(title: string, format: string) {
  const hash = hashString(`${title}:${format}`);
  return {
    paper: PAPER_COLORS[hash % PAPER_COLORS.length],
    spine: SPINE_COLORS[hash % SPINE_COLORS.length],
  };
}
