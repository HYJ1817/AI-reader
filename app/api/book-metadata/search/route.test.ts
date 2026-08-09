import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/bookMetadataSearch", () => ({
  searchPublicBookMetadata: vi.fn(),
}));

import { searchPublicBookMetadata } from "../../../../lib/bookMetadataSearch";
import { POST } from "./route";

const searchMock = vi.mocked(searchPublicBookMetadata);

function request(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/book-metadata/search", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/book-metadata/search", () => {
  beforeEach(() => {
    searchMock.mockReset();
    searchMock.mockResolvedValue({
      candidate: null,
      score: 0,
      missing: ["description", "subjects"],
    });
  });

  it.each(["", "x".repeat(501)])("rejects an empty or overlong title", async (title) => {
    const response = await POST(request({
      title,
      format: "epub",
      needsCover: true,
    }));
    expect(response.status).toBe(400);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it("rejects an over-limit JSON body", async () => {
    const response = await POST(
      request(
        { title: "资本论", format: "epub", needsCover: true },
        { "content-length": "70000" }
      )
    );
    expect(response.status).toBe(413);
  });

  it("returns no-match as a normal non-cacheable response", async () => {
    const response = await POST(request({
      title: "资本论",
      format: "txt",
      needsCover: false,
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      candidate: null,
      score: 0,
      missing: ["description", "subjects"],
    });
  });

  it("does not echo provider secrets from an unexpected service failure", async () => {
    searchMock.mockRejectedValueOnce(new Error("GOOGLE_BOOKS_API_KEY=top-secret"));
    const response = await POST(request({
      title: "资本论",
      format: "txt",
      needsCover: false,
    }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("top-secret");
  });
});
