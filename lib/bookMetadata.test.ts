import { describe, expect, it } from "vitest";
import {
  BOOK_METADATA_LIMITS,
  markBookEnrichmentFailed,
  mergeBookEnrichment,
  resolveBookEnrichmentStatus,
  type BookEnrichment,
} from "./bookMetadata";

const attemptedAt = "2026-08-09T00:00:00.000Z";

describe("mergeBookEnrichment", () => {
  it("fills missing fields without replacing unprovenanced local values", () => {
    const existing: BookEnrichment = {
      description: "本地保留简介",
      status: "partial",
      attemptedAt: "2026-08-01T00:00:00.000Z",
    };

    const merged = mergeBookEnrichment(
      existing,
      {
        description: "远程简介",
        authors: ["卡尔·马克思"],
        source: { source: "open-library", sourceId: "OL123M" },
        matchScore: 0.91,
        attemptedAt,
      },
      "automatic"
    );

    expect(merged).toMatchObject({
      description: "本地保留简介",
      authors: ["卡尔·马克思"],
      matchScore: 0.91,
      attemptedAt,
      fieldSources: {
        authors: { source: "open-library", sourceId: "OL123M" },
      },
    });
    expect(merged.fieldSources?.description).toBeUndefined();
  });

  it("lets manual rescrape replace only previously scraped fields", () => {
    const existing: BookEnrichment = {
      description: "旧简介",
      publisher: "本地出版社",
      status: "complete",
      attemptedAt: "2026-08-01T00:00:00.000Z",
      fieldSources: {
        description: { source: "ai", generated: true },
      },
    };

    const merged = mergeBookEnrichment(
      existing,
      {
        description: "公开简介",
        publisher: "远程出版社",
        source: { source: "google-books", sourceId: "volume-1" },
        matchScore: 0.95,
        attemptedAt,
      },
      "manual"
    );

    expect(merged.description).toBe("公开简介");
    expect(merged.publisher).toBe("本地出版社");
    expect(merged.fieldSources?.description).toEqual({
      source: "google-books",
      sourceId: "volume-1",
    });
    expect(merged.fieldSources?.publisher).toBeUndefined();
  });

  it("keeps public prose when an AI patch arrives later", () => {
    const existing: BookEnrichment = {
      description: "公开简介",
      status: "partial",
      attemptedAt,
      fieldSources: {
        description: { source: "open-library", sourceId: "OL123M" },
      },
    };

    const merged = mergeBookEnrichment(
      existing,
      {
        description: "AI 简介",
        subjects: ["经济学", "经典"],
        source: { source: "ai", generated: true },
        attemptedAt,
      },
      "manual"
    );

    expect(merged.description).toBe("公开简介");
    expect(merged.subjects).toEqual(["经济学", "经典"]);
  });

  it("sanitizes strings, arrays and identifiers at the storage boundary", () => {
    const merged = mergeBookEnrichment(
      undefined,
      {
        bibliographicTitle: `  ${"书".repeat(BOOK_METADATA_LIMITS.title + 10)}  `,
        authors: [" 作者 ", "作者", ...Array.from({ length: 20 }, (_, i) => `作者${i}`)],
        description: `<b>${"简".repeat(BOOK_METADATA_LIMITS.description + 10)}</b>`,
        subjects: [" 经济学 ", "经济学", "经典"],
        identifiers: [
          { type: " ISBN ", value: " 978-7-01-000000-0 " },
          { type: "ISBN", value: "978-7-01-000000-0" },
        ],
        source: { source: "open-library", sourceId: "OL123M" },
        attemptedAt,
      },
      "automatic"
    );

    expect(merged.bibliographicTitle).toHaveLength(BOOK_METADATA_LIMITS.title);
    expect(merged.authors).toHaveLength(BOOK_METADATA_LIMITS.authorCount);
    expect(merged.authors?.[0]).toBe("作者");
    expect(merged.description).not.toContain("<b>");
    expect(merged.description?.length).toBeLessThanOrEqual(
      BOOK_METADATA_LIMITS.description
    );
    expect(merged.subjects).toEqual(["经济学", "经典"]);
    expect(merged.identifiers).toEqual([
      { type: "ISBN", value: "978-7-01-000000-0" },
    ]);
  });

  it("marks a record complete when prose and discovery metadata exist", () => {
    const merged = mergeBookEnrichment(
      undefined,
      {
        description: "简介",
        authors: ["作者"],
        source: { source: "google-books", sourceId: "volume-1" },
        attemptedAt,
      },
      "automatic"
    );

    expect(merged.status).toBe("complete");
    expect(merged.updatedAt).toBe(attemptedAt);
    expect(merged.errorCode).toBeUndefined();
  });
});

describe("resolveBookEnrichmentStatus", () => {
  it("treats a pending record older than five minutes as failed", () => {
    expect(
      resolveBookEnrichmentStatus(
        { status: "pending", attemptedAt },
        new Date("2026-08-09T00:06:00.000Z")
      )
    ).toBe("failed");
  });

  it("keeps a recent pending record pending", () => {
    expect(
      resolveBookEnrichmentStatus(
        { status: "pending", attemptedAt },
        new Date("2026-08-09T00:04:59.000Z")
      )
    ).toBe("pending");
  });

  it("returns idle for a book without enrichment", () => {
    expect(resolveBookEnrichmentStatus(undefined)).toBe("idle");
  });
});

describe("markBookEnrichmentFailed", () => {
  it("retains previously successful fields and records only a safe error code", () => {
    const previous: BookEnrichment = {
      description: "保留简介",
      status: "complete",
      attemptedAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:01.000Z",
    };

    expect(markBookEnrichmentFailed(previous, "timeout", attemptedAt)).toEqual({
      ...previous,
      status: "failed",
      errorCode: "timeout",
      attemptedAt,
    });
  });
});
