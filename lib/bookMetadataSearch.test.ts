import { describe, expect, it, vi } from "vitest";
import { searchPublicBookMetadata } from "./bookMetadataSearch";
import type { BookMetadataSearchInput } from "./bookMetadataProviders";

const validInput: BookMetadataSearchInput = {
  title: "资本论",
  authors: ["卡尔·马克思"],
  identifiers: [{ type: "ISBN", value: "9787010000000" }],
  language: "zh-CN",
  format: "epub",
  needsCover: true,
};

const openLibraryResponse = {
  docs: [
    {
      key: "/works/OL1W",
      title: "资本论",
      author_name: ["卡尔·马克思"],
      isbn: ["9787010000000"],
      subject: ["政治经济学"],
      cover_i: 123,
    },
  ],
};

describe("searchPublicBookMetadata", () => {
  it("returns Open Library when Google Books is not configured", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(openLibraryResponse)
    );
    const result = await searchPublicBookMetadata(validInput, {
      fetcher,
      googleBooksApiKey: "",
    });
    expect(result.candidate?.source).toBe("open-library");
    expect(result.missing).toEqual(["description"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain("openlibrary.org/search.json");
  });

  it("starts configured providers independently and keeps a valid partial result", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("googleapis.com")) {
        throw new DOMException("Aborted", "AbortError");
      }
      return Response.json(openLibraryResponse);
    });
    const result = await searchPublicBookMetadata(validInput, {
      fetcher,
      googleBooksApiKey: "secret-key",
    });
    expect(result.candidate?.source).toBe("open-library");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("key=secret-key"))).toBe(true);
  });

  it("returns a safe no-match result when every provider fails", async () => {
    const result = await searchPublicBookMetadata(validInput, {
      fetcher: vi.fn().mockRejectedValue(new Error("secret upstream failure")),
      googleBooksApiKey: "secret-key",
    });
    expect(result).toEqual({
      candidate: null,
      score: 0,
      missing: ["description", "subjects"],
    });
  });

  it("ignores an oversized provider response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ docs: [], padding: "x".repeat(513_000) }), {
        headers: { "content-type": "application/json" },
      })
    );
    await expect(
      searchPublicBookMetadata(validInput, { fetcher, googleBooksApiKey: "" })
    ).resolves.toMatchObject({ candidate: null });
  });
});
