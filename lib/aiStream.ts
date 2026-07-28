import type { AiProviderConfig } from "./aiProviders";

export type WorkspaceStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const STREAM_FORMAT_ERROR = "AI stream format error";

function encodeEvent(event: WorkspaceStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function parseSseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];
  for (const rawLine of frame.split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(":")) continue;
    const colon = rawLine.indexOf(":");
    const field = colon < 0 ? rawLine : rawLine.slice(0, colon);
    const value = colon < 0 ? "" : rawLine.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  return data.length > 0 || event !== "message"
    ? { event, data: data.join("\n") }
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson(data: string): Record<string, unknown> {
  const parsed = JSON.parse(data) as unknown;
  const result = asRecord(parsed);
  if (!result) throw new Error(STREAM_FORMAT_ERROR);
  return result;
}

function openAiEvents(frame: { event: string; data: string }): WorkspaceStreamEvent[] {
  if (frame.data.trim() === "[DONE]") return [{ type: "done" }];
  const payload = parseJson(frame.data);
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(STREAM_FORMAT_ERROR);
  }
  const choice = asRecord(choices[0]);
  const delta = asRecord(choice?.delta);
  const content = delta?.content;
  const events: WorkspaceStreamEvent[] = [];
  if (typeof content === "string" && content) {
    events.push({ type: "delta", text: content });
  }
  if (choice?.finish_reason !== undefined && choice.finish_reason !== null) {
    events.push({ type: "done" });
  }
  return events;
}

function anthropicEvents(frame: {
  event: string;
  data: string;
}): WorkspaceStreamEvent[] {
  if (frame.event === "message_stop") return [{ type: "done" }];
  const payload = parseJson(frame.data);
  if (payload.type === "message_stop") return [{ type: "done" }];
  if (payload.type === "error") throw new Error(STREAM_FORMAT_ERROR);
  if (
    frame.event === "content_block_delta" ||
    payload.type === "content_block_delta"
  ) {
    const delta = asRecord(payload.delta);
    if (typeof delta?.text === "string" && delta.text) {
      return [{ type: "delta", text: delta.text }];
    }
  }
  return [];
}

function geminiEvents(frame: { data: string }): WorkspaceStreamEvent[] {
  const payload = parseJson(frame.data);
  const candidates = payload.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error(STREAM_FORMAT_ERROR);
  }
  const candidate = asRecord(candidates[0]);
  const content = asRecord(candidate?.content);
  const parts = content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((part) => asRecord(part)?.text)
        .filter((part): part is string => typeof part === "string")
        .join("")
    : "";
  const events: WorkspaceStreamEvent[] = [];
  if (text) events.push({ type: "delta", text });
  if (typeof candidate?.finishReason === "string") {
    events.push({ type: "done" });
  }
  return events;
}

function normalizeFrame(
  protocol: AiProviderConfig["protocol"],
  frameText: string
): WorkspaceStreamEvent[] {
  const frame = parseSseFrame(frameText);
  if (!frame) return [];
  if (protocol === "anthropic-compatible") return anthropicEvents(frame);
  if (protocol === "gemini") return geminiEvents(frame);
  return openAiEvents(frame);
}

function takeFrame(buffer: string): { frame: string; rest: string } | null {
  const match = /\r?\n\r?\n/.exec(buffer);
  if (!match || match.index === undefined) return null;
  return {
    frame: buffer.slice(0, match.index),
    rest: buffer.slice(match.index + match[0].length),
  };
}

export function normalizeAiProviderStream(
  protocol: AiProviderConfig["protocol"],
  upstream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let extracted = takeFrame(buffer);
          while (extracted) {
            buffer = extracted.rest;
            for (const event of normalizeFrame(protocol, extracted.frame)) {
              controller.enqueue(encodeEvent(event));
            }
            extracted = takeFrame(buffer);
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const event of normalizeFrame(protocol, buffer)) {
            controller.enqueue(encodeEvent(event));
          }
        }
      } catch {
        failed = true;
        controller.enqueue(
          encodeEvent({ type: "error", message: STREAM_FORMAT_ERROR })
        );
        await reader.cancel().catch(() => undefined);
      } finally {
        if (!failed) reader.releaseLock();
        controller.close();
      }
    },
  });
}

function validateWorkspaceEvent(value: unknown): WorkspaceStreamEvent {
  const record = asRecord(value);
  if (record?.type === "delta" && typeof record.text === "string") {
    return { type: "delta", text: record.text };
  }
  if (record?.type === "done") return { type: "done" };
  if (record?.type === "error" && typeof record.message === "string") {
    return { type: "error", message: record.message };
  }
  throw new Error(STREAM_FORMAT_ERROR);
}

export async function* readWorkspaceEventStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<WorkspaceStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let extracted = takeFrame(buffer);
      while (extracted) {
        buffer = extracted.rest;
        const frame = parseSseFrame(extracted.frame);
        if (frame?.data) {
          yield validateWorkspaceEvent(JSON.parse(frame.data) as unknown);
        }
        extracted = takeFrame(buffer);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const frame = parseSseFrame(buffer);
      if (frame?.data) {
        yield validateWorkspaceEvent(JSON.parse(frame.data) as unknown);
      }
    }
  } catch {
    yield { type: "error", message: STREAM_FORMAT_ERROR };
  } finally {
    reader.releaseLock();
  }
}
