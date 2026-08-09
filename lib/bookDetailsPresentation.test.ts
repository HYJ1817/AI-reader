import { describe, expect, it } from "vitest";
import type { BookMetadata } from "./db";
import { buildBookDetailsPresentation } from "./bookDetailsPresentation";

const now = "2026-08-09T00:00:00.000Z";

function makeBook(overrides: Partial<BookMetadata> = {}): BookMetadata {
  return {
    id: "book-1",
    title: "资本论",
    format: "epub",
    fileName: "资本论.epub",
    size: 1_048_576,
    createdAt: now,
    ...overrides,
  };
}

describe("buildBookDetailsPresentation", () => {
  it.each([
    [0, "开始阅读"],
    [0.01, "继续阅读"],
    [42, "继续阅读"],
  ])("maps progress %s to CTA %s", (progressPercent, expected) => {
    expect(
      buildBookDetailsPresentation(makeBook(), progressPercent).primaryActionLabel
    ).toBe(expected);
  });

  it("shows contents only for EPUB and omits absent metadata rows", () => {
    const view = buildBookDetailsPresentation(
      makeBook({
        format: "txt",
        fileName: "资本论.txt",
        enrichment: {
          status: "partial",
          attemptedAt: now,
          authors: ["作者"],
        },
      }),
      0
    );
    expect(view.showContentsAction).toBe(false);
    expect(view.metadataRows.map((row) => row.label)).toEqual([
      "作者",
      "格式",
      "文件大小",
      "原文件名",
    ]);
  });

  it("uses enriched title, prose, subjects and source summary", () => {
    const view = buildBookDetailsPresentation(
      makeBook({
        enrichment: {
          bibliographicTitle: "资本论（第一卷）",
          authors: ["卡尔·马克思"],
          description: "政治经济学批判。",
          subjects: ["经济学", "经典"],
          status: "complete",
          attemptedAt: now,
          updatedAt: now,
          fieldSources: {
            description: { source: "open-library", sourceId: "OL1W" },
            subjects: { source: "ai", generated: true },
          },
        },
      }),
      25
    );
    expect(view).toMatchObject({
      title: "资本论（第一卷）",
      description: "政治经济学批判。",
      subjects: ["经济学", "经典"],
      sourceSummary: "Open Library · AI",
    });
  });
});
