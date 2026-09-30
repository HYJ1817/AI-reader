import { describe, expect, it, vi } from "vitest";
import type { BookMetadata } from "./db";
import {
  enrichBookMetadata,
  type BookMetadataEnrichmentDependencies,
} from "./bookMetadataEnrichment";

function makeBook(overrides: Partial<BookMetadata> = {}): BookMetadata {
  return {
    id: "book-1",
    title: "资本论",
    format: "epub",
    fileName: "资本论.epub",
    size: 100,
    createdAt: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

const completePublicResult = {
  candidate: {
    source: "open-library" as const,
    sourceId: "OL1W",
    title: "资本论",
    authors: ["卡尔·马克思"],
    description: "政治经济学批判。",
    subjects: ["政治经济学"],
    identifiers: [{ type: "ISBN", value: "9787010000000" }],
    coverRef: { source: "open-library" as const, id: "123" },
  },
  score: 0.98,
  missing: [] as Array<"description" | "subjects">,
};

function makeDeps(
  overrides: Partial<BookMetadataEnrichmentDependencies> = {}
): BookMetadataEnrichmentDependencies {
  return {
    now: () => "2026-08-09T01:00:00.000Z",
    searchPublic: vi.fn().mockResolvedValue(completePublicResult),
    downloadCover: vi.fn().mockResolvedValue(new Blob(["cover"], { type: "image/jpeg" })),
    getBookFile: vi.fn().mockResolvedValue(new Blob(["正文"], { type: "text/plain" })),
    extractOpeningExcerpt: vi.fn().mockResolvedValue("正文节选"),
    completeWithAi: vi.fn().mockResolvedValue({
      completion: { description: "AI 简介", subjects: ["经典"] },
      provenance: { source: "ai", generated: true },
    }),
    updateBookEnrichment: vi.fn().mockResolvedValue(undefined),
    aiProvider: { id: "provider" },
    aiUsable: true,
    isAiAuthorized: () => true,
    shouldCommit: () => true,
    ...overrides,
  };
}

describe("enrichBookMetadata", () => {
  it("continues public lookup but never reads or sends text without consent", async () => {
    const deps = makeDeps({
      isAiAuthorized: undefined,
      searchPublic: vi.fn().mockResolvedValue({ candidate: null, score: 0, missing: ["description"] }),
    });
    const result = await enrichBookMetadata(makeBook(), "manual", deps);
    expect(deps.searchPublic).toHaveBeenCalledOnce();
    expect(deps.getBookFile).not.toHaveBeenCalled();
    expect(deps.completeWithAi).not.toHaveBeenCalled();
    expect(result.offerAiCompletion).toBe(true);
  });

  it("fences queued AI sends when authorization is withdrawn during excerpt extraction", async () => {
    let allowed = true;
    const deps = makeDeps({
      isAiAuthorized: () => allowed,
      searchPublic: vi.fn().mockResolvedValue({ candidate: null, score: 0, missing: ["description"] }),
      extractOpeningExcerpt: vi.fn().mockImplementation(async () => { allowed = false; return "excerpt"; }),
    });
    await enrichBookMetadata(makeBook(), "automatic", deps);
    expect(deps.extractOpeningExcerpt).toHaveBeenCalledOnce();
    expect(deps.completeWithAi).not.toHaveBeenCalled();
  });

  it("allows explicit single-book consent without enabling automatic AI", async () => {
    const deps = makeDeps({
      isAiAuthorized: () => false,
      singleBookAiConsent: true,
      searchPublic: vi.fn().mockResolvedValue({ candidate: null, score: 0, missing: ["description"] }),
    });
    await enrichBookMetadata(makeBook(), "manual", deps);
    expect(deps.completeWithAi).toHaveBeenCalledOnce();
    expect(deps.isAiAuthorized?.()).toBe(false);
  });

  it.each(["offline", "timeout", "provider"] as const)("preserves typed %s failures", async (code) => {
    const deps = makeDeps({ searchPublic: vi.fn().mockRejectedValue({ code }) });
    const result = await enrichBookMetadata(makeBook(), "manual", deps);
    expect(result.enrichment.errorCode).toBe(code);
  });
  it.each(["offline", "timeout", "provider"] as const)("preserves resolved public %s failures", async (code) => {
    const deps = makeDeps({
      aiUsable: false,
      searchPublic: vi.fn().mockResolvedValue({
        candidate: null,
        score: 0,
        missing: ["description", "subjects"],
        errorCode: code,
      }),
    });
    const result = await enrichBookMetadata(makeBook(), "manual", deps);
    expect(result.enrichment.errorCode).toBe(code);
  });
  it("does not read source bytes or call AI when public metadata is complete", async () => {
    const deps = makeDeps();
    const result = await enrichBookMetadata(makeBook(), "automatic", deps);
    expect(deps.getBookFile).not.toHaveBeenCalled();
    expect(deps.completeWithAi).not.toHaveBeenCalled();
    expect(deps.updateBookEnrichment).toHaveBeenCalledTimes(2);
    expect(result.enrichment).toMatchObject({
      description: "政治经济学批判。",
      subjects: ["政治经济学"],
      status: "complete",
    });
  });

  it("reads only the target book excerpt when prose fields are missing", async () => {
    const deps = makeDeps({
      searchPublic: vi.fn().mockResolvedValue({
        candidate: {
          ...completePublicResult.candidate,
          description: undefined,
          subjects: [],
        },
        score: 0.9,
        missing: ["description", "subjects"],
      }),
    });
    await enrichBookMetadata(makeBook({ id: "target" }), "manual", deps);
    expect(deps.getBookFile).toHaveBeenCalledWith("target");
    expect(deps.completeWithAi).toHaveBeenCalledWith(
      expect.objectContaining({
        excerpt: "正文节选",
        missing: ["description", "subjects"],
      }),
      expect.any(AbortSignal)
    );
  });

  it("does not read the book when no usable AI provider exists", async () => {
    const deps = makeDeps({
      aiUsable: false,
      aiProvider: undefined,
      searchPublic: vi.fn().mockResolvedValue({
        candidate: { ...completePublicResult.candidate, description: undefined },
        score: 0.9,
        missing: ["description"],
      }),
    });
    const result = await enrichBookMetadata(makeBook(), "automatic", deps);
    expect(deps.getBookFile).not.toHaveBeenCalled();
    expect(result.enrichment.status).toBe("partial");
  });

  it("retains previous good values when a manual search has no match", async () => {
    const deps = makeDeps({
      aiUsable: false,
      searchPublic: vi.fn().mockResolvedValue({
        candidate: null,
        score: 0,
        missing: ["description", "subjects"],
      }),
    });
    const result = await enrichBookMetadata(
      makeBook({
        enrichment: {
          description: "保留简介",
          status: "complete",
          attemptedAt: "2026-08-01T00:00:00.000Z",
          fieldSources: { description: { source: "ai", generated: true } },
        },
      }),
      "manual",
      deps
    );
    expect(result.enrichment.description).toBe("保留简介");
    expect(result.enrichment.errorCode).toBe("no-match");
  });

  it("downloads a cover only when local cover is absent or previously scraped", async () => {
    const localCoverDeps = makeDeps();
    await enrichBookMetadata(
      makeBook({ coverImageBlob: new Blob(["local"], { type: "image/png" }) }),
      "automatic",
      localCoverDeps
    );
    expect(localCoverDeps.downloadCover).not.toHaveBeenCalled();

    const scrapedCoverDeps = makeDeps();
    await enrichBookMetadata(
      makeBook({
        coverImageBlob: new Blob(["old"], { type: "image/png" }),
        enrichment: {
          status: "partial",
          attemptedAt: "2026-08-01T00:00:00.000Z",
          fieldSources: { cover: { source: "open-library", sourceId: "old" } },
        },
      }),
      "manual",
      scrapedCoverDeps
    );
    expect(scrapedCoverDeps.downloadCover).toHaveBeenCalledOnce();
  });

  it("prevents a stale task from committing its final result", async () => {
    let commitChecks = 0;
    const deps = makeDeps({ shouldCommit: () => ++commitChecks === 1 });
    const result = await enrichBookMetadata(makeBook(), "automatic", deps);
    expect(result.committed).toBe(false);
    expect(deps.updateBookEnrichment).toHaveBeenCalledTimes(1);
  });
});
