import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSafeAiUpstreamUrl,
  fetchAiUpstream,
  readLimitedJson,
} from "./aiRequestSecurity";

const chatRouteSource = readFileSync(
  new URL("../app/api/chat/route.ts", import.meta.url),
  "utf8"
);
const modelsRouteSource = readFileSync(
  new URL("../app/api/models/route.ts", import.meta.url),
  "utf8"
);

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

  it("cancels a streamed request as soon as it exceeds the limit", async () => {
    let cancelled = false;
    const request = {
      headers: new Headers(),
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(80));
          controller.enqueue(new Uint8Array(80));
        },
        cancel() {
          cancelled = true;
        },
      }),
    } as Request;

    await expect(readLimitedJson(request, 100)).rejects.toMatchObject({
      status: 413,
    });
    expect(cancelled).toBe(true);
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

  it("passes safe validation errors through both API routes", () => {
    for (const source of [chatRouteSource, modelsRouteSource]) {
      expect(source).toContain("error instanceof AiRequestError ? error.message");
      expect(source).toContain("fetchAiUpstream(");
    }
  });
});
