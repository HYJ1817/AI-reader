import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function request(source: string, id: string) {
  const url = new URL("http://localhost/api/book-metadata/cover");
  url.searchParams.set("source", source);
  url.searchParams.set("id", id);
  return new Request(url);
}

describe("GET /api/book-metadata/cover", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/jpeg", "content-length": "3" },
      })
    );
  });

  it.each([
    ["open-library", "OL123M"],
    ["open-library", "9787010000000"],
    ["google-books", "zyTCAlFPjgYC"],
  ])("fetches a validated %s cover reference", async (source, id) => {
    const response = await GET(request(source, id));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it.each([
    ["open-library", "https://internal/"],
    ["open-library", "../cover"],
    ["unknown", "OL123M"],
    ["google-books", "book/id"],
  ])("rejects invalid source/id combinations", async (source, id) => {
    const response = await GET(request(source, id));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-image upstream response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("html", { headers: { "content-type": "text/html" } })
    );
    expect((await GET(request("open-library", "OL123M"))).status).toBe(415);
  });

  it("rejects more than two redirects", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://covers.openlibrary.org/next.jpg" },
      })
    );
    expect((await GET(request("open-library", "OL123M"))).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects redirects outside the fixed provider hosts", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://internal.example/cover.jpg" },
      })
    );
    expect((await GET(request("open-library", "OL123M"))).status).toBe(502);
  });

  it("rejects a declared image larger than two megabytes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Uint8Array([1]), {
        headers: {
          "content-type": "image/png",
          "content-length": String(2_097_153),
        },
      })
    );
    expect((await GET(request("open-library", "OL123M"))).status).toBe(413);
  });

  it("counts a streaming response when content-length is missing", async () => {
    const chunk = new Uint8Array(1_100_000);
    fetchMock.mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(chunk);
            controller.enqueue(chunk);
            controller.close();
          },
        }),
        { headers: { "content-type": "image/webp" } }
      )
    );
    expect((await GET(request("open-library", "OL123M"))).status).toBe(413);
  });
});
