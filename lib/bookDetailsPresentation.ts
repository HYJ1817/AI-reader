import type { BookMetadata } from "./db";
import { formatBookDate, formatBookSize } from "./libraryPresentation";
import { normalizeProgressPercent } from "./readerProgress";
import type { BookEnrichmentError } from "./bookMetadata";

export function getMetadataFailureMessage(code?: BookEnrichmentError) {
  switch (code) {
    case "offline": return "当前离线，已保留已有信息。联网后可重试。";
    case "timeout": return "查询超时，已保留已有信息。可稍后重试。";
    case "no-match": return "未找到匹配的公共图书信息，不影响阅读。";
    case "invalid-response": return "服务返回的信息无法识别，已保留已有信息。";
    default: return "图书信息服务暂时不可用，已保留已有信息。可稍后重试。";
  }
}

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
  metadataActionLabel: "补全图书信息" | "更新图书信息";
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
    metadataActionLabel: hasRemoteMetadata ? "更新图书信息" : "补全图书信息",
    ...(sources.size > 0 ? { sourceSummary: [...sources].join(" · ") } : {}),
  };
}
