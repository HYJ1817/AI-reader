import { createLocalId } from "./localId";

export const WORKSPACE_MESSAGE_INITIAL_LIMIT = 100;
export const WORKSPACE_MESSAGE_PAGE_SIZE = 50;
export const WORKSPACE_HISTORY_MESSAGE_LIMIT = 20;
export const WORKSPACE_HISTORY_MESSAGE_CHARS = 3_000;
export const WORKSPACE_CONTEXT_CHARS = 6_000;
export const WORKSPACE_LIVE_DEGRADE_CHARS = 8_000;
export const WORKSPACE_LIVE_TAIL_CHARS = 4_000;
export const WORKSPACE_LARGE_MESSAGE_CHARS = 32_000;
export const WORKSPACE_LARGE_PREVIEW_CHARS = 8_000;
export const WORKSPACE_MEMORY_ITEM_LIMIT = 20;
export const WORKSPACE_MEMORY_CHAR_LIMIT = 4_000;

export type WorkspaceSessionStatus =
  | "idle"
  | "streaming"
  | "error"
  | "paused";

export type WorkspaceMessageState =
  | "complete"
  | "streaming"
  | "error"
  | "cancelled";

export type WorkspaceArtifactKind =
  | "summary"
  | "explanation"
  | "outline"
  | "timeline"
  | "characters"
  | "note";

export type ReadingWorkspaceRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
};

export type WorkspaceBookRecord = {
  id: string;
  workspaceId: string;
  bookId: string;
  role: "primary" | "reference";
  addedAt: string;
};

export type WorkspaceSessionRecord = {
  id: string;
  workspaceId: string;
  title: string;
  status: WorkspaceSessionStatus;
  summary?: string;
  summaryThroughMessageId?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceContextSnapshot = {
  bookId: string;
  bookTitle: string;
  bookFormat: "epub" | "txt";
  selectedText?: string;
  nearbyText?: string;
  locator?: string;
  progressPercent?: number;
  capturedAt: string;
};

export type WorkspaceMessageRecord = {
  id: string;
  workspaceId: string;
  sessionId: string;
  role: "user" | "assistant";
  replyToMessageId?: string;
  skillId?: string;
  content: string;
  state: WorkspaceMessageState;
  error?: string;
  contextSnapshot?: WorkspaceContextSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceArtifactRecord = {
  id: string;
  workspaceId: string;
  sessionId?: string;
  sourceMessageIds: string[];
  kind: WorkspaceArtifactKind;
  title: string;
  content: string;
  mediaType: "text/markdown";
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMemoryRecord = {
  id: string;
  workspaceId: string;
  sourceMessageId?: string;
  content: string;
  state: "active" | "revoked";
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
};

export type BookWorkspaceRecords = {
  workspace: ReadingWorkspaceRecord;
  bookLink: WorkspaceBookRecord;
  session: WorkspaceSessionRecord;
};

export function isWorkspaceMessageState(
  value: unknown
): value is WorkspaceMessageState {
  return (
    value === "complete" ||
    value === "streaming" ||
    value === "error" ||
    value === "cancelled"
  );
}

export function createBookWorkspaceRecords({
  bookId,
  bookTitle,
  now = new Date().toISOString(),
  createId = createLocalId,
}: {
  bookId: string;
  bookTitle: string;
  now?: string;
  createId?: () => string;
}): BookWorkspaceRecords {
  const workspaceId = createId();
  return {
    workspace: {
      id: workspaceId,
      title: bookTitle,
      createdAt: now,
      updatedAt: now,
    },
    bookLink: {
      id: createId(),
      workspaceId,
      bookId,
      role: "primary",
      addedAt: now,
    },
    session: {
      id: createId(),
      workspaceId,
      title: "新对话",
      status: "idle",
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function selectRenderableMessageWindow<T>(
  messages: T[],
  olderPageCount: number
): T[] {
  const safePages = Math.max(0, Math.floor(olderPageCount));
  const count =
    WORKSPACE_MESSAGE_INITIAL_LIMIT +
    safePages * WORKSPACE_MESSAGE_PAGE_SIZE;
  return messages.slice(-count);
}
