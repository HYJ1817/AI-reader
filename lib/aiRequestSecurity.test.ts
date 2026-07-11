import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSafeAiUpstreamUrl,
  fetchAiUpstream,
  readLimitedJson,
} from "./aiRequestSecurity";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AI request security", () => {
  it.each([
    "http://localhost:8080/v1",
    "https://127.0.0.1/v1",
    "https://10.0.0.5/v1",
    "https://172.20.0.5/v1",
    "https://192.168.1.5/v1",
    "https://169.254.169.254/latest",
    "https://[::1]/v1",
    "https://metadata.google.internal/v1",
    "https://user:pass@example.com/v1",
  ])("blocks unsafe production upstream %s", (url) => {
    expect(() => assertSafeAiUpstreamUrl(url)).toThrow();
  });

  it("allows public HTTPS custom providers", () => {
    expect(assertSafeAiUpstreamUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1"
    );
  });

  it("allows local HTTP only when explicitly enabled for development", () => {
    expect(
      assertSafeAiUpstreamUrl("http://localhost:11434/v1", {
        allowLocalDevelopment: true,
      })
    ).toBe("http://localhost:11434/v1");
  });

  it("rejects request bodies above the configured limit", async () => {
    const request = new Request("https://reader.test/api/chat", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(200) }),
    });

    await expect(readLimitedJson(request, 100)).rejects.toMatchObject({
      status: 413,
    });
  });

  it("parses JSON within the configured limit", async () => {
    const request = new Request("https://reader.test/api/chat", {
      method: "POST",
      body: JSON.stringify({ value: "ok" }),
    });

    await expect(readLimitedJson(request, 100)).resolves.toEqual({ value: "ok" });
  });

  it("rejects oversized upstream responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("x".repeat(200)))
    );

    await expect(
      fetchAiUpstream("https://api.example.com/v1", {}, { maxResponseBytes: 100 })
    ).rejects.toMatchObject({ status: 502 });
  });
});
