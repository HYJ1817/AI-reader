import { describe, expect, it } from "vitest";
import {
  createBookWorkspaceRecords,
  isWorkspaceMessageState,
  selectRenderableMessageWindow,
  WORKSPACE_MESSAGE_INITIAL_LIMIT,
  WORKSPACE_MESSAGE_PAGE_SIZE,
} from "./readingWorkspace";

describe("createBookWorkspaceRecords", () => {
  it("creates one workspace, primary book link, and idle session", () => {
    const ids = ["workspace-1", "link-1", "session-1"];
    const records = createBookWorkspaceRecords({
      bookId: "book-1",
      bookTitle: "The Book",
      now: "2026-07-28T00:00:00.000Z",
      createId: () => ids.shift()!,
    });

    expect(records.workspace).toMatchObject({
      id: "workspace-1",
      title: "The Book",
      createdAt: "2026-07-28T00:00:00.000Z",
      updatedAt: "2026-07-28T00:00:00.000Z",
    });
    expect(records.bookLink).toMatchObject({
      id: "link-1",
      workspaceId: "workspace-1",
      bookId: "book-1",
      role: "primary",
    });
    expect(records.session).toMatchObject({
      id: "session-1",
      workspaceId: "workspace-1",
      title: "新对话",
      status: "idle",
    });
  });
});

describe("workspace policies", () => {
  it("accepts only persisted message states", () => {
    expect(
      ["complete", "streaming", "error", "cancelled"].every(
        isWorkspaceMessageState
      )
    ).toBe(true);
    expect(isWorkspaceMessageState("done")).toBe(false);
  });

  it("keeps the initial tail and pages older messages in fixed increments", () => {
    const messages = Array.from({ length: 180 }, (_, index) => ({
      id: `m-${index}`,
    }));

    expect(
      selectRenderableMessageWindow(messages, 0).map((item) => item.id)
    ).toEqual(
      messages
        .slice(-WORKSPACE_MESSAGE_INITIAL_LIMIT)
        .map((item) => item.id)
    );
    expect(selectRenderableMessageWindow(messages, 1)).toHaveLength(
      WORKSPACE_MESSAGE_INITIAL_LIMIT + WORKSPACE_MESSAGE_PAGE_SIZE
    );
  });

  it("normalizes negative and fractional older-page counts", () => {
    const messages = Array.from({ length: 180 }, (_, index) => index);

    expect(selectRenderableMessageWindow(messages, -1)).toHaveLength(
      WORKSPACE_MESSAGE_INITIAL_LIMIT
    );
    expect(selectRenderableMessageWindow(messages, 1.9)).toHaveLength(
      WORKSPACE_MESSAGE_INITIAL_LIMIT + WORKSPACE_MESSAGE_PAGE_SIZE
    );
  });
});
