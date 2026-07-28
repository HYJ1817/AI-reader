import type {
  ReadingWorkspaceRecord,
  WorkspaceArtifactKind,
  WorkspaceArtifactRecord,
  WorkspaceBookRecord,
  WorkspaceContextSnapshot,
  WorkspaceMemoryRecord,
  WorkspaceMessageRecord,
  WorkspaceSessionRecord,
} from "./readingWorkspace";

export const WORKSPACE_BACKUP_TEXT_LIMIT = 1_000_000;

export type WorkspaceBackupData = {
  readingWorkspaces: ReadingWorkspaceRecord[];
  workspaceBooks: WorkspaceBookRecord[];
  workspaceSessions: WorkspaceSessionRecord[];
  workspaceMessages: WorkspaceMessageRecord[];
  workspaceArtifacts: WorkspaceArtifactRecord[];
  workspaceMemories: WorkspaceMemoryRecord[];
};

function invalid(label: string): never {
  throw new Error(`Invalid backup: ${label}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) invalid(label);
  return value;
}

function array<T>(
  value: unknown,
  label: string,
  validate: (item: unknown, index: number) => T
): T[] {
  if (!Array.isArray(value)) invalid(`missing ${label} array`);
  return value.map(validate);
}

function text(
  value: unknown,
  label: string,
  { allowEmpty = false }: { allowEmpty?: boolean } = {}
): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && !value.trim()) ||
    value.length > WORKSPACE_BACKUP_TEXT_LIMIT
  ) {
    invalid(label);
  }
  return value;
}

function isoDate(value: unknown, label: string): string {
  const result = text(value, label);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) ||
    Number.isNaN(Date.parse(result))
  ) {
    invalid(label);
  }
  return result;
}

function optionalFiniteNumber(
  value: unknown,
  label: string
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) invalid(label);
  return value;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) invalid(label);
  return value.map((item) => text(item, label));
}

function assertUniqueIds(
  records: ReadonlyArray<{ id: string }>,
  label: string
): void {
  const ids = new Set<string>();
  for (const item of records) {
    if (ids.has(item.id)) invalid(`duplicate ${label} id`);
    ids.add(item.id);
  }
}

function validateWorkspace(value: unknown): ReadingWorkspaceRecord {
  const item = record(value, "workspace");
  return {
    id: text(item.id, "workspace id"),
    title: text(item.title, "workspace title"),
    createdAt: isoDate(item.createdAt, "workspace createdAt"),
    updatedAt: isoDate(item.updatedAt, "workspace updatedAt"),
    ...(item.lastOpenedAt === undefined
      ? {}
      : { lastOpenedAt: isoDate(item.lastOpenedAt, "workspace lastOpenedAt") }),
  };
}

function validateWorkspaceBook(value: unknown): WorkspaceBookRecord {
  const item = record(value, "workspace book");
  if (item.role !== "primary" && item.role !== "reference") {
    invalid("workspace book role");
  }
  return {
    id: text(item.id, "workspace book id"),
    workspaceId: text(item.workspaceId, "workspace book workspaceId"),
    bookId: text(item.bookId, "workspace book bookId"),
    role: item.role,
    addedAt: isoDate(item.addedAt, "workspace book addedAt"),
  };
}

function validateWorkspaceSession(value: unknown): WorkspaceSessionRecord {
  const item = record(value, "workspace session");
  if (
    item.status !== "idle" &&
    item.status !== "streaming" &&
    item.status !== "error" &&
    item.status !== "paused"
  ) {
    invalid("workspace session status");
  }
  return {
    id: text(item.id, "workspace session id"),
    workspaceId: text(item.workspaceId, "workspace session workspaceId"),
    title: text(item.title, "workspace session title"),
    status: item.status,
    ...(item.summary === undefined
      ? {}
      : { summary: text(item.summary, "workspace session summary", { allowEmpty: true }) }),
    ...(item.summaryThroughMessageId === undefined
      ? {}
      : {
          summaryThroughMessageId: text(
            item.summaryThroughMessageId,
            "workspace session summaryThroughMessageId"
          ),
        }),
    createdAt: isoDate(item.createdAt, "workspace session createdAt"),
    updatedAt: isoDate(item.updatedAt, "workspace session updatedAt"),
  };
}

function validateContextSnapshot(value: unknown): WorkspaceContextSnapshot {
  const item = record(value, "workspace context snapshot");
  if (item.bookFormat !== "epub" && item.bookFormat !== "txt") {
    invalid("workspace context bookFormat");
  }
  return {
    bookId: text(item.bookId, "workspace context bookId"),
    bookTitle: text(item.bookTitle, "workspace context bookTitle"),
    bookFormat: item.bookFormat,
    ...(item.selectedText === undefined
      ? {}
      : {
          selectedText: text(item.selectedText, "workspace context selectedText", {
            allowEmpty: true,
          }),
        }),
    ...(item.nearbyText === undefined
      ? {}
      : {
          nearbyText: text(item.nearbyText, "workspace context nearbyText", {
            allowEmpty: true,
          }),
        }),
    ...(item.locator === undefined
      ? {}
      : { locator: text(item.locator, "workspace context locator", { allowEmpty: true }) }),
    ...(item.progressPercent === undefined
      ? {}
      : {
          progressPercent: optionalFiniteNumber(
            item.progressPercent,
            "workspace context progressPercent"
          ) as number,
        }),
    capturedAt: isoDate(item.capturedAt, "workspace context capturedAt"),
  };
}

function validateWorkspaceMessage(value: unknown): WorkspaceMessageRecord {
  const item = record(value, "workspace message");
  if (item.role !== "user" && item.role !== "assistant") {
    invalid("workspace message role");
  }
  if (
    item.state !== "complete" &&
    item.state !== "streaming" &&
    item.state !== "error" &&
    item.state !== "cancelled"
  ) {
    invalid("workspace message state");
  }
  return {
    id: text(item.id, "workspace message id"),
    workspaceId: text(item.workspaceId, "workspace message workspaceId"),
    sessionId: text(item.sessionId, "workspace message sessionId"),
    role: item.role,
    ...(item.replyToMessageId === undefined
      ? {}
      : {
          replyToMessageId: text(
            item.replyToMessageId,
            "workspace message replyToMessageId"
          ),
        }),
    ...(item.skillId === undefined
      ? {}
      : { skillId: text(item.skillId, "workspace message skillId") }),
    content: text(item.content, "workspace message content", { allowEmpty: true }),
    state: item.state,
    ...(item.error === undefined
      ? {}
      : { error: text(item.error, "workspace message error", { allowEmpty: true }) }),
    ...(item.contextSnapshot === undefined
      ? {}
      : { contextSnapshot: validateContextSnapshot(item.contextSnapshot) }),
    createdAt: isoDate(item.createdAt, "workspace message createdAt"),
    updatedAt: isoDate(item.updatedAt, "workspace message updatedAt"),
  };
}

const ARTIFACT_KINDS = new Set<WorkspaceArtifactKind>([
  "summary",
  "explanation",
  "outline",
  "timeline",
  "characters",
  "note",
]);

function validateWorkspaceArtifact(value: unknown): WorkspaceArtifactRecord {
  const item = record(value, "workspace artifact");
  if (typeof item.kind !== "string" || !ARTIFACT_KINDS.has(item.kind as WorkspaceArtifactKind)) {
    invalid("workspace artifact kind");
  }
  if (item.mediaType !== "text/markdown") {
    invalid("workspace artifact mediaType");
  }
  return {
    id: text(item.id, "workspace artifact id"),
    workspaceId: text(item.workspaceId, "workspace artifact workspaceId"),
    ...(item.sessionId === undefined
      ? {}
      : { sessionId: text(item.sessionId, "workspace artifact sessionId") }),
    sourceMessageIds: stringArray(
      item.sourceMessageIds,
      "workspace artifact sourceMessageIds"
    ),
    kind: item.kind as WorkspaceArtifactKind,
    title: text(item.title, "workspace artifact title"),
    content: text(item.content, "workspace artifact content", { allowEmpty: true }),
    mediaType: item.mediaType,
    createdAt: isoDate(item.createdAt, "workspace artifact createdAt"),
    updatedAt: isoDate(item.updatedAt, "workspace artifact updatedAt"),
  };
}

function validateWorkspaceMemory(value: unknown): WorkspaceMemoryRecord {
  const item = record(value, "workspace memory");
  if (item.state !== "active" && item.state !== "revoked") {
    invalid("workspace memory state");
  }
  return {
    id: text(item.id, "workspace memory id"),
    workspaceId: text(item.workspaceId, "workspace memory workspaceId"),
    ...(item.sourceMessageId === undefined
      ? {}
      : {
          sourceMessageId: text(
            item.sourceMessageId,
            "workspace memory sourceMessageId"
          ),
        }),
    content: text(item.content, "workspace memory content", { allowEmpty: true }),
    state: item.state,
    createdAt: isoDate(item.createdAt, "workspace memory createdAt"),
    updatedAt: isoDate(item.updatedAt, "workspace memory updatedAt"),
    ...(item.revokedAt === undefined
      ? {}
      : { revokedAt: isoDate(item.revokedAt, "workspace memory revokedAt") }),
  };
}

export function emptyWorkspaceBackupData(): WorkspaceBackupData {
  return {
    readingWorkspaces: [],
    workspaceBooks: [],
    workspaceSessions: [],
    workspaceMessages: [],
    workspaceArtifacts: [],
    workspaceMemories: [],
  };
}

export function validateWorkspaceBackupData(
  value: unknown,
  bookIds: ReadonlySet<string>
): WorkspaceBackupData {
  const root = record(value, "workspace data");
  const result: WorkspaceBackupData = {
    readingWorkspaces: array(
      root.readingWorkspaces,
      "readingWorkspaces",
      validateWorkspace
    ),
    workspaceBooks: array(
      root.workspaceBooks,
      "workspaceBooks",
      validateWorkspaceBook
    ),
    workspaceSessions: array(
      root.workspaceSessions,
      "workspaceSessions",
      validateWorkspaceSession
    ),
    workspaceMessages: array(
      root.workspaceMessages,
      "workspaceMessages",
      validateWorkspaceMessage
    ),
    workspaceArtifacts: array(
      root.workspaceArtifacts,
      "workspaceArtifacts",
      validateWorkspaceArtifact
    ),
    workspaceMemories: array(
      root.workspaceMemories,
      "workspaceMemories",
      validateWorkspaceMemory
    ),
  };

  assertUniqueIds(result.readingWorkspaces, "workspace");
  assertUniqueIds(result.workspaceBooks, "workspace book");
  assertUniqueIds(result.workspaceSessions, "workspace session");
  assertUniqueIds(result.workspaceMessages, "workspace message");
  assertUniqueIds(result.workspaceArtifacts, "workspace artifact");
  assertUniqueIds(result.workspaceMemories, "workspace memory");

  const workspaceIds = new Set(result.readingWorkspaces.map((item) => item.id));
  const sessionById = new Map(
    result.workspaceSessions.map((item) => [item.id, item])
  );
  const messageById = new Map(
    result.workspaceMessages.map((item) => [item.id, item])
  );
  const associatedBooks = new Map<string, Set<string>>();

  for (const link of result.workspaceBooks) {
    if (!workspaceIds.has(link.workspaceId)) invalid("workspace book owner");
    if (!bookIds.has(link.bookId)) invalid("workspace book reference");
    const ids = associatedBooks.get(link.workspaceId) ?? new Set<string>();
    if (ids.has(link.bookId)) invalid("duplicate workspace book association");
    ids.add(link.bookId);
    associatedBooks.set(link.workspaceId, ids);
  }

  for (const session of result.workspaceSessions) {
    if (!workspaceIds.has(session.workspaceId)) invalid("workspace session owner");
  }

  for (const message of result.workspaceMessages) {
    const session = sessionById.get(message.sessionId);
    if (
      !workspaceIds.has(message.workspaceId) ||
      !session ||
      session.workspaceId !== message.workspaceId
    ) {
      invalid("workspace message owner");
    }
    if (message.replyToMessageId) {
      const replyTarget = messageById.get(message.replyToMessageId);
      if (
        !replyTarget ||
        replyTarget.role !== "user" ||
        replyTarget.sessionId !== message.sessionId
      ) {
        invalid("workspace message reply reference");
      }
    }
    if (
      message.contextSnapshot &&
      !associatedBooks
        .get(message.workspaceId)
        ?.has(message.contextSnapshot.bookId)
    ) {
      invalid("workspace context book reference");
    }
  }

  for (const session of result.workspaceSessions) {
    if (!session.summaryThroughMessageId) continue;
    const message = messageById.get(session.summaryThroughMessageId);
    if (!message || message.sessionId !== session.id) {
      invalid("workspace session summary reference");
    }
  }

  for (const artifact of result.workspaceArtifacts) {
    if (!workspaceIds.has(artifact.workspaceId)) invalid("workspace artifact owner");
    if (artifact.sessionId) {
      const session = sessionById.get(artifact.sessionId);
      if (!session || session.workspaceId !== artifact.workspaceId) {
        invalid("workspace artifact session reference");
      }
    }
    for (const messageId of artifact.sourceMessageIds) {
      const message = messageById.get(messageId);
      if (!message || message.workspaceId !== artifact.workspaceId) {
        invalid("workspace artifact message reference");
      }
    }
  }

  for (const memory of result.workspaceMemories) {
    if (!workspaceIds.has(memory.workspaceId)) invalid("workspace memory owner");
    if (memory.sourceMessageId) {
      const message = messageById.get(memory.sourceMessageId);
      if (!message || message.workspaceId !== memory.workspaceId) {
        invalid("workspace memory message reference");
      }
    }
  }

  return result;
}
