import { describe, expect, it } from "vitest";
import {
  WORKSPACE_BACKUP_TEXT_LIMIT,
  emptyWorkspaceBackupData,
  validateWorkspaceBackupData,
  type WorkspaceBackupData,
} from "./workspaceBackup";

const ISO = "2026-07-28T00:00:00.000Z";

function makeValidGraph(): WorkspaceBackupData {
  return {
    readingWorkspaces: [
      { id: "w1", title: "Book", createdAt: ISO, updatedAt: ISO },
    ],
    workspaceBooks: [
      {
        id: "wb1",
        workspaceId: "w1",
        bookId: "b1",
        role: "primary",
        addedAt: ISO,
      },
    ],
    workspaceSessions: [
      {
        id: "s1",
        workspaceId: "w1",
        title: "New chat",
        status: "idle",
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
    workspaceMessages: [
      {
        id: "m1",
        workspaceId: "w1",
        sessionId: "s1",
        role: "user",
        content: "Question",
        state: "complete",
        createdAt: ISO,
        updatedAt: ISO,
      },
    ],
    workspaceArtifacts: [],
    workspaceMemories: [],
  };
}

describe("workspace backup validation", () => {
  it("returns a fresh empty workspace graph", () => {
    expect(emptyWorkspaceBackupData()).toEqual({
      readingWorkspaces: [],
      workspaceBooks: [],
      workspaceSessions: [],
      workspaceMessages: [],
      workspaceArtifacts: [],
      workspaceMemories: [],
    });
  });

  it("accepts a referentially complete workspace graph", () => {
    const graph = makeValidGraph();
    expect(validateWorkspaceBackupData(graph, new Set(["b1"]))).toEqual(graph);
  });

  it.each([
    [
      "missing book",
      () => {
        const graph = makeValidGraph();
        graph.workspaceBooks[0].bookId = "missing";
        return graph;
      },
    ],
    [
      "missing workspace",
      () => {
        const graph = makeValidGraph();
        graph.workspaceSessions[0].workspaceId = "missing";
        return graph;
      },
    ],
    [
      "missing session",
      () => {
        const graph = makeValidGraph();
        graph.workspaceMessages[0].sessionId = "missing";
        return graph;
      },
    ],
  ])("rejects %s references", (_label, createGraph) => {
    expect(() =>
      validateWorkspaceBackupData(createGraph(), new Set(["b1"]))
    ).toThrow("Invalid backup");
  });

  it("rejects duplicate IDs inside a record collection", () => {
    const graph = makeValidGraph();
    graph.workspaceSessions.push({ ...graph.workspaceSessions[0] });
    expect(() => validateWorkspaceBackupData(graph, new Set(["b1"]))).toThrow(
      "Invalid backup"
    );
  });

  it.each([
    ["book role", "workspaceBooks", "role", "owner"],
    ["session status", "workspaceSessions", "status", "running"],
    ["message role", "workspaceMessages", "role", "system"],
    ["message state", "workspaceMessages", "state", "pending"],
  ])("rejects an invalid %s enum", (_label, collection, field, value) => {
    const graph = makeValidGraph() as unknown as Record<string, unknown[]>;
    graph[collection][0] = {
      ...(graph[collection][0] as Record<string, unknown>),
      [field]: value,
    };
    expect(() =>
      validateWorkspaceBackupData(graph, new Set(["b1"]))
    ).toThrow("Invalid backup");
  });

  it("rejects text above the per-record limit", () => {
    const graph = makeValidGraph();
    graph.workspaceMessages[0].content = "x".repeat(
      WORKSPACE_BACKUP_TEXT_LIMIT + 1
    );
    expect(() => validateWorkspaceBackupData(graph, new Set(["b1"]))).toThrow(
      "Invalid backup"
    );
  });

  it("rejects malformed timestamps", () => {
    const graph = makeValidGraph();
    graph.readingWorkspaces[0].updatedAt = "yesterday";
    expect(() => validateWorkspaceBackupData(graph, new Set(["b1"]))).toThrow(
      "Invalid backup"
    );
  });

  it("rejects a context snapshot for a book outside the owning workspace", () => {
    const graph = makeValidGraph();
    graph.workspaceMessages[0].contextSnapshot = {
      bookId: "b2",
      bookTitle: "Other",
      bookFormat: "txt",
      capturedAt: ISO,
    };
    expect(() =>
      validateWorkspaceBackupData(graph, new Set(["b1", "b2"]))
    ).toThrow("Invalid backup");
  });

  it("accepts an assistant reply to a user in the same session", () => {
    const graph = makeValidGraph();
    graph.workspaceMessages.push({
      id: "m2",
      workspaceId: "w1",
      sessionId: "s1",
      role: "assistant",
      replyToMessageId: "m1",
      content: "Answer",
      state: "complete",
      createdAt: ISO,
      updatedAt: ISO,
    });
    expect(validateWorkspaceBackupData(graph, new Set(["b1"]))).toEqual(graph);
  });

  it("rejects reply targets that are absent, assistant-authored, or cross-session", () => {
    const graph = makeValidGraph();
    graph.workspaceMessages.push({
      id: "m2",
      workspaceId: "w1",
      sessionId: "s1",
      role: "assistant",
      replyToMessageId: "missing",
      content: "Answer",
      state: "complete",
      createdAt: ISO,
      updatedAt: ISO,
    });
    expect(() => validateWorkspaceBackupData(graph, new Set(["b1"]))).toThrow(
      "Invalid backup"
    );
  });
});
