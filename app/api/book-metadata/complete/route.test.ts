import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAiProviderFromPreset } from "../../../../lib/aiProviders";
import { POST } from "./route";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const provider = createAiProviderFromPreset("openai", {
  apiKey: "top-secret-key",
  model: "gpt-test",
});

function request(body: unknown) {
  return new Request("http://localhost/api/book-metadata/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/book-metadata/complete", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"description":"简介"}' } }] })
    );
  });

  it("returns immediately without an AI request when nothing is missing", async () => {
    const response = await POST(request({ missing: [], knownMetadata: {}, excerpt: "" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      completion: {},
      provenance: { source: "ai", generated: true },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unusable provider", async () => {
    const response = await POST(request({
      provider: { ...provider, apiKey: "" },
      missing: ["description"],
      knownMetadata: { title: "资本论" },
      excerpt: "正文",
    }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("truncates the excerpt to 6000 characters before sending", async () => {
    const response = await POST(request({
      provider,
      missing: ["description"],
      knownMetadata: { title: "资本论" },
      excerpt: "章".repeat(7_000),
    }));
    expect(response.status).toBe(200);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const upstreamBody = JSON.parse(String(init.body));
    const serialized = JSON.stringify(upstreamBody.messages);
    expect(serialized).toContain("章".repeat(6_000));
    expect(serialized).not.toContain("章".repeat(6_001));
  });

  it("maps malformed upstream JSON to a secret-safe 502", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("not json", { headers: { "content-type": "application/json" } })
    );
    const response = await POST(request({
      provider,
      missing: ["description"],
      knownMetadata: { title: "资本论" },
      excerpt: "正文",
    }));
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain("AI request failed");
    expect(body).not.toContain("top-secret-key");
  });
});
