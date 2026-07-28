import { describe, expect, it } from "vitest";
import {
  buildWorkspaceMessagePair,
  applySessionCompaction,
  buildCompactedInferenceHistory,
  getWorkspaceMessageRenderMode,
  selectInferenceHistory,
  selectWorkspaceMemoryForPrompt,
  shouldAcceptWorkspaceEvent,
  type WorkspaceRequestIdentity,
} from "./workspaceChat";
import type {
  WorkspaceContextSnapshot,
  WorkspaceMemoryRecord,
  WorkspaceMessageRecord,
  WorkspaceSessionRecord,
} from "./readingWorkspace";

const SNAPSHOT: WorkspaceContextSnapshot = {
  bookId: "book-1",
  bookTitle: "Book",
  bookFormat: "txt",
  nearbyText: "Visible passage",
  capturedAt: "2026-07-28T00:00:00.000Z",
};

const CURRENT: WorkspaceRequestIdentity = {
  workspaceId: "w1",
  sessionId: "s1",
  assistantMessageId: "a1",
  generation: 1,
};

function makeHistory(
  count: number,
  options: { includeErrorAt?: number; includeStreamingAt?: number } = {}
): WorkspaceMessageRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m-${index}`,
    workspaceId: "w1",
    sessionId: "s1",
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index}`,
    state:
      index === options.includeErrorAt
        ? "error"
        : index === options.includeStreamingAt
          ? "streaming"
          : "complete",
    createdAt: new Date(Date.UTC(2026, 6, 28, 0, 0, 0, index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 6, 28, 0, 0, 0, index)).toISOString(),
  }));
}

function makeMemory(index: number): WorkspaceMemoryRecord {
  const timestamp = new Date(Date.UTC(2026, 6, 28, 0, 0, 0, index)).toISOString();
  return {
    id: `memory-${index}`,
    workspaceId: "w1",
    content: `memory ${index}`,
    state: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function makeSession(): WorkspaceSessionRecord {
  return {
    id: "s1",
    workspaceId: "w1",
    title: "Conversation",
    status: "idle",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T00:00:00.000Z",
  };
}

describe("workspace chat policy", () => {
  it("selects bounded live and completed render modes at exact thresholds", () => {
    expect(
      getWorkspaceMessageRenderMode({ length: 7_999, streaming: true })
    ).toBe("live");
    expect(
      getWorkspaceMessageRenderMode({ length: 8_001, streaming: true })
    ).toBe("live-tail");
    expect(
      getWorkspaceMessageRenderMode({ length: 32_001, streaming: false })
    ).toBe("collapsed");
    expect(
      getWorkspaceMessageRenderMode({ length: 32_000, streaming: false })
    ).toBe("markdown");
  });

  it("creates a complete user turn and streaming assistant record", () => {
    const ids = ["u1", "a1"];
    const pair = buildWorkspaceMessagePair({
      workspaceId: "w1",
      sessionId: "s1",
      question: "Explain this",
      contextSnapshot: SNAPSHOT,
      skillId: "explain",
      now: "2026-07-28T00:00:00.000Z",
      createId: () => ids.shift()!,
    });

    expect(pair.user).toMatchObject({
      id: "u1",
      role: "user",
      state: "complete",
      content: "Explain this",
      skillId: "explain",
      contextSnapshot: SNAPSHOT,
    });
    expect(pair.assistant).toMatchObject({
      id: "a1",
      role: "assistant",
      state: "streaming",
      content: "",
      replyToMessageId: "u1",
      skillId: "explain",
    });
  });

  it("excludes failed and streaming records and keeps latest bounded history", () => {
    const history = makeHistory(30, {
      includeErrorAt: 28,
      includeStreamingAt: 29,
    });
    history[27].content = "x".repeat(3_100);

    const selected = selectInferenceHistory(history);

    expect(selected).toHaveLength(20);
    expect(selected.map((message) => message.content)).not.toContain("message-28");
    expect(selected.map((message) => message.content)).not.toContain("message-29");
    expect(selected.at(-1)?.content).toContain("[truncated]");
  });

  it("keeps a cancelled assistant only when partial content exists", () => {
    const history = makeHistory(2);
    history.push(
      { ...history[1], id: "cancelled-empty", state: "cancelled", content: "" },
      {
        ...history[1],
        id: "cancelled-partial",
        state: "cancelled",
        content: "Partial answer",
      }
    );

    expect(selectInferenceHistory(history).map((item) => item.content)).toEqual([
      "message-0",
      "message-1",
      "Partial answer",
    ]);
  });

  it("rejects events from a stale workspace, session, message, or generation", () => {
    expect(shouldAcceptWorkspaceEvent(CURRENT, CURRENT)).toBe(true);
    expect(
      shouldAcceptWorkspaceEvent(CURRENT, { ...CURRENT, workspaceId: "old" })
    ).toBe(false);
    expect(
      shouldAcceptWorkspaceEvent(CURRENT, { ...CURRENT, sessionId: "old" })
    ).toBe(false);
    expect(
      shouldAcceptWorkspaceEvent(CURRENT, {
        ...CURRENT,
        assistantMessageId: "old",
      })
    ).toBe(false);
    expect(
      shouldAcceptWorkspaceEvent(CURRENT, { ...CURRENT, generation: 0 })
    ).toBe(false);
  });

  it("injects only active memory within item and character budgets", () => {
    const items = Array.from({ length: 25 }, (_, index) => makeMemory(index));
    items[2] = { ...items[2], state: "revoked" };
    const result = selectWorkspaceMemoryForPrompt(items);
    expect(result.items).toHaveLength(20);
    expect(result.items.some((item) => item.state === "revoked")).toBe(false);
    expect(result.text.length).toBeLessThanOrEqual(4_000);
  });

  it("uses only messages after the persisted summary anchor", () => {
    const messages = makeHistory(40);
    const result = buildCompactedInferenceHistory({
      messages,
      summary: "Earlier discussion summary",
      summaryThroughMessageId: messages[19].id,
    });
    expect(result.summary).toBe("Earlier discussion summary");
    expect(result.messages[0].id).toBe(messages[20].id);
  });

  it("keeps full stored messages after compaction", () => {
    const session = applySessionCompaction(makeSession(), "summary", "m20");
    expect(session).toMatchObject({
      summary: "summary",
      summaryThroughMessageId: "m20",
    });
  });
});
