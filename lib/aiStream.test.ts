import { describe, expect, it } from "vitest";
import type { AiProviderConfig } from "./aiProviders";
import {
  normalizeAiProviderStream,
  readWorkspaceEventStream,
  type WorkspaceStreamEvent,
} from "./aiStream";

const OPENAI = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
const ANTHROPIC =
  'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n';
const GEMINI =
  'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n';

function chunkedStream(value: string, cuts: number[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let start = 0;
  for (const end of cuts) {
    chunks.push(encoder.encode(value.slice(start, end)));
    start = end;
  }
  chunks.push(encoder.encode(value.slice(start)));
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(
  protocol: AiProviderConfig["protocol"],
  source: string,
  cuts: number[]
): Promise<WorkspaceStreamEvent[]> {
  const events: WorkspaceStreamEvent[] = [];
  const normalized = normalizeAiProviderStream(
    protocol,
    chunkedStream(source, cuts)
  );
  for await (const event of readWorkspaceEventStream(normalized)) {
    events.push(event);
  }
  return events;
}

describe("AI stream normalization", () => {
  it.each([
    ["openai-compatible", OPENAI, 'data: {"choi'.length],
    ["anthropic-compatible", ANTHROPIC, ANTHROPIC.indexOf('"Hello"') + 3],
    ["gemini", GEMINI, GEMINI.indexOf('"Hello"') + 4],
  ] as const)("decodes split %s deltas", async (protocol, fixture, cut) => {
    await expect(collect(protocol, fixture, [2, cut])).resolves.toEqual([
      { type: "delta", text: "Hello" },
    ]);
  });

  it.each([
    ["openai-compatible", "data: [DONE]\n\n"],
    [
      "anthropic-compatible",
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ],
    ["gemini", 'data: {"candidates":[{"finishReason":"STOP"}]}\n\n'],
  ] as const)("normalizes %s completion", async (protocol, fixture) => {
    await expect(collect(protocol, fixture, [1, fixture.length - 2])).resolves.toEqual([
      { type: "done" },
    ]);
  });

  it("emits one sanitized error for an invalid provider event", async () => {
    const secret = "sk-secret-Authorization-Bearer";
    const events = await collect(
      "openai-compatible",
      `data: {not-json:${secret}}\n\ndata: {also-bad}\n\n`,
      [8, 19]
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      message: "AI stream format error",
    });
    expect(JSON.stringify(events)).not.toContain(secret);
    expect(JSON.stringify(events)).not.toContain("Authorization");
  });

  it("reads application events split inside their JSON strings", async () => {
    const source =
      'data: {"type":"delta","text":"Hel' +
      'lo"}\n\ndata: {"type":"done"}\n\n';
    const events: WorkspaceStreamEvent[] = [];
    for await (const event of readWorkspaceEventStream(
      chunkedStream(source, [3, 35, 40])
    )) {
      events.push(event);
    }
    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      { type: "done" },
    ]);
  });
});
