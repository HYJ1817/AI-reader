import type { BookMetadata } from "./db";
import { formatBookDate, formatBookSize } from "./libraryPresentation";
import { normalizeProgressPercent } from "./readerProgress";

export type BookDetailsMetadataRow = {
  label: string;
  value: string;
};

export type BookDetailsPresentation = {
  title: string;
  authors: string[];
  description?: string;
  subjects: string[];
  progressPercent: number;
  primaryActionLabel: "开始阅读" | "继续阅读";
  showContentsAction: boolean;
  readingStatusLabel: string;
  lastReadLabel: string;
  metadataRows: BookDetailsMetadataRow[];
  metadataActionLabel: "补全元数据" | "重新刮削元数据";
  sourceSummary?: string;
};

const SOURCE_LABELS = {
  "open-library": "Open Library",
  "google-books": "Google Books",
  ai: "AI",
} as const;

export function buildBookDetailsPresentation(
  book: BookMetadata,
  progressPercent: number
): BookDetailsPresentation {
  const enrichment = book.enrichment;
  const progress = normalizeProgressPercent(progressPercent);
  const hasReadingProgress = Number.isFinite(progressPercent) && progressPercent > 0;
  const metadataRows: BookDetailsMetadataRow[] = [];
  if (enrichment?.authors?.length) {
    metadataRows.push({ label: "作者", value: enrichment.authors.join("、") });
  }
  if (enrichment?.publisher) {
    metadataRows.push({ label: "出版社", value: enrichment.publisher });
  }
  if (enrichment?.publishedDate) {
    metadataRows.push({ label: "出版日期", value: enrichment.publishedDate });
  }
  if (enrichment?.language) {
    metadataRows.push({ label: "语言", value: enrichment.language });
  }
  metadataRows.push(
    { label: "格式", value: book.format.toUpperCase() },
    { label: "文件大小", value: formatBookSize(book.size) },
    { label: "原文件名", value: book.fileName }
  );

  const sources = new Set<string>();
  for (const provenance of Object.values(enrichment?.fieldSources ?? {})) {
    if (provenance) sources.add(SOURCE_LABELS[provenance.source]);
  }
  const hasRemoteMetadata = sources.size > 0;

  return {
    title: enrichment?.bibliographicTitle ?? book.title,
    authors: enrichment?.authors ?? [],
    ...(enrichment?.description ? { description: enrichment.description } : {}),
    subjects: enrichment?.subjects ?? [],
    progressPercent: progress,
    primaryActionLabel: hasReadingProgress ? "继续阅读" : "开始阅读",
    showContentsAction: book.format === "epub",
    readingStatusLabel:
      progress >= 100 ? "已读完" : hasReadingProgress ? "阅读中" : "未开始",
    lastReadLabel: formatBookDate(book.lastOpenedAt),
    metadataRows,
    metadataActionLabel: hasRemoteMetadata ? "重新刮削元数据" : "补全元数据",
    ...(sources.size > 0 ? { sourceSummary: [...sources].join(" · ") } : {}),
  };
}
