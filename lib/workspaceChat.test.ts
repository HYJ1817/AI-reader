import { describe, expect, it } from "vitest";
import {
  buildWorkspaceMessagePair,
  selectInferenceHistory,
  shouldAcceptWorkspaceEvent,
  type WorkspaceRequestIdentity,
} from "./workspaceChat";
import type {
  WorkspaceContextSnapshot,
  WorkspaceMessageRecord,
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

describe("workspace chat policy", () => {
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
});
