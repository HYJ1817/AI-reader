export function parseTxtParagraphs(text: string): string[] {
  if (!text.trim()) return [];

  const normalized = text.replace(/\r\n?/g, "\n");

  const hasBlankLines = /\n\s*\n/.test(normalized);

  if (hasBlankLines) {
    return normalized
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  return normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function progressFromScroll(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  const raw = (scrollTop / maxScroll) * 100;
  return Math.floor(Math.min(100, Math.max(0, raw)));
}

export function scrollTopFromProgress(
  progressPercent: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return 0;
  const clamped = Math.min(100, Math.max(0, progressPercent));
  return (clamped / 100) * maxScroll;
}
