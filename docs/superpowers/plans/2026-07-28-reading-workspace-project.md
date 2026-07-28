# Reading Workspace Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a book-first, local-first reading workspace with persistent AI conversations, semantic materials, bounded reading Skills, visible memory, and resilient long-content UI without adding a fourth root tab or a general-purpose agent runtime.

**Architecture:** Add workspace-owned records to the existing Dexie database, expose one default workspace per book through the current routed-sheet navigation, and replace transient Ask AI state with a session/message repository. Deliver streaming, long-content guards, artifacts, Skills, memory, and compaction in later milestones over the same persisted ownership model. Keep OpenMinis as a source of independently reimplemented design principles; do not copy GPL code or bring its Linux sandbox into this PWA.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Dexie 4 / IndexedDB, Motion 12, Vitest with fake-indexeddb, Playwright mobile profiles, provider-compatible HTTP streaming, `react-markdown`, and `remark-gfm` for completed-message rendering.

---

## Delivery Order and Stop Gates

Implement milestones in order. Each milestone is a usable checkpoint and must
pass its focused tests before the next begins.

1. Tasks 1–3: workspace data, lifecycle, and backup foundation.
2. Tasks 4–5: book/reader UI entry and persistent non-streaming conversation.
3. Tasks 6–7: normalized streaming and long-content resilience.
4. Task 8: bounded reading Skills and semantic artifacts.
5. Task 9: opt-in memory and explicit anchored compaction.
6. Tasks 10–11: accessibility, browser/device evidence, repository gates, and
   handoff.

Do not begin Tasks 6–9 until the preceding checkpoint is green. Do not add
browser automation, a Linux sandbox, arbitrary `SKILL.md` execution, a global
Workspace tab, or cloud sync while executing this plan.

## File and Responsibility Map

**Create:**

- `lib/readingWorkspace.ts` — workspace domain types, constants, pure guards,
  and constructors; no IndexedDB or React dependencies.
- `lib/readingWorkspace.test.ts` — pure domain and policy tests.
- `lib/workspaceBackup.ts` — serialization validation for workspace-owned
  backup data.
- `lib/workspaceBackup.test.ts` — strict validation and referential-integrity
  tests.
- `lib/workspaceChat.ts` — pure message/window/history/request policies.
- `lib/workspaceChat.test.ts` — pagination, stale-event, history, and state
  transition tests.
- `lib/aiStream.ts` — provider stream request flags, upstream event decoding,
  and normalized application-event encoding/decoding.
- `lib/aiStream.test.ts` — split-chunk and provider-format stream tests.
- `lib/readingSkills.ts` — four bundled reading Skill descriptors and prompt
  builders.
- `lib/readingSkills.test.ts` — eligibility and bounded-context tests.
- `app/useWorkspaceChat.ts` — view orchestration, request cancellation,
  coalesced persistence, and book/session isolation.
- `app/WorkspaceConversation.tsx` — shared compact/full conversation renderer
  and composer.
- `app/WorkspaceMessageBody.tsx` — live plain-text, completed Markdown, and
  large-content rendering policy.
- `app/ReadingWorkspaceSheet.tsx` — full routed workspace sheet and two-view
  segmented control.
- `app/WorkspaceMaterials.tsx` — annotations, artifacts, and memory lists.
- `app/WorkspaceArtifactPreview.tsx` — artifact preview, rename, export, and
  delete actions.
- `e2e/reading-workspace.spec.ts` — persistence, isolation, navigation,
  accessibility, and long-session browser regression.

**Modify:**

- `lib/db.ts` — Dexie v7 tables, focused persistence APIs, cascade deletion,
  clear, and atomic replacement.
- `lib/backup.ts` — backup v3 creation/restore while preserving v1/v2.
- `app/SettingsSurface.tsx` — disclose that backups include selected passages
  and AI workspace data.
- `lib/appNavigation.ts`, `lib/navigationHistory.ts`,
  `app/AppOverlays.tsx` — routed `reading-workspace` sheet.
- `app/AskAiPanel.tsx` — thin compact wrapper over the shared conversation UI.
- `app/page.tsx` — workspace hook wiring and book/reader entry actions.
- `app/useAskAi.ts` — remove after all callers use `useWorkspaceChat`.
- `lib/aiChat.ts`, `app/api/chat/route.ts` — normalized streaming while
  preserving the current security boundary and non-stream fallback tests.
- `app/page.module.css`, `lib/uiText.ts` — restrained workspace visuals,
  states, and localized labels.
- `lib/db.test.ts`, `lib/backup.test.ts`, `lib/backupImport.test.ts`,
  `lib/appNavigation.test.ts`, `lib/pushSurfacesIntegration.test.ts`,
  `lib/askAiReaderContextIntegration.test.ts`,
  `lib/accessibilityIntegration.test.ts` — integration regressions.
- `HANDOFF.md` — implementation evidence only after all selected milestones
  are complete.

### Task 1: Define the workspace domain and bounded policies

**Files:**
- Create: `lib/readingWorkspace.ts`
- Create: `lib/readingWorkspace.test.ts`

- [ ] **Step 1: Write failing constructor and policy tests**

Create `lib/readingWorkspace.test.ts` with deterministic clocks and IDs:

```ts
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
      status: "idle",
    });
  });
});

describe("workspace policies", () => {
  it("accepts only persisted message states", () => {
    expect(["complete", "streaming", "error", "cancelled"].every(isWorkspaceMessageState)).toBe(true);
    expect(isWorkspaceMessageState("done")).toBe(false);
  });

  it("keeps the initial tail and pages older messages in fixed increments", () => {
    const messages = Array.from({ length: 180 }, (_, index) => ({ id: `m-${index}` }));
    expect(selectRenderableMessageWindow(messages, 0).map((item) => item.id)).toEqual(
      messages.slice(-WORKSPACE_MESSAGE_INITIAL_LIMIT).map((item) => item.id)
    );
    expect(selectRenderableMessageWindow(messages, 1)).toHaveLength(
      WORKSPACE_MESSAGE_INITIAL_LIMIT + WORKSPACE_MESSAGE_PAGE_SIZE
    );
  });
});
```

- [ ] **Step 2: Run the focused test RED**

```powershell
npm.cmd run test -- lib/readingWorkspace.test.ts
```

Expected: FAIL because `lib/readingWorkspace.ts` does not exist.

- [ ] **Step 3: Add the complete domain contract**

Create `lib/readingWorkspace.ts` with these exported constants and types:

```ts
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

export type WorkspaceSessionStatus = "idle" | "streaming" | "error" | "paused";
export type WorkspaceMessageState = "complete" | "streaming" | "error" | "cancelled";
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

export function isWorkspaceMessageState(value: unknown): value is WorkspaceMessageState {
  return value === "complete" || value === "streaming" || value === "error" || value === "cancelled";
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
}) {
  const workspaceId = createId();
  return {
    workspace: {
      id: workspaceId,
      title: bookTitle,
      createdAt: now,
      updatedAt: now,
    } satisfies ReadingWorkspaceRecord,
    bookLink: {
      id: createId(),
      workspaceId,
      bookId,
      role: "primary",
      addedAt: now,
    } satisfies WorkspaceBookRecord,
    session: {
      id: createId(),
      workspaceId,
      title: "新对话",
      status: "idle",
      createdAt: now,
      updatedAt: now,
    } satisfies WorkspaceSessionRecord,
  };
}

export function selectRenderableMessageWindow<T>(messages: T[], olderPageCount: number): T[] {
  const safePages = Math.max(0, Math.floor(olderPageCount));
  const count = WORKSPACE_MESSAGE_INITIAL_LIMIT + safePages * WORKSPACE_MESSAGE_PAGE_SIZE;
  return messages.slice(-count);
}
```

- [ ] **Step 4: Run the focused test GREEN**

```powershell
npm.cmd run test -- lib/readingWorkspace.test.ts
```

Expected: all workspace-domain tests pass.

- [ ] **Step 5: Commit the domain contract**

```powershell
git add lib/readingWorkspace.ts lib/readingWorkspace.test.ts
git commit -m "feat: define reading workspace domain"
```

### Task 2: Add Dexie v7 workspace persistence and ownership lifecycle

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/db.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add tests to `lib/db.test.ts` that prove all four ownership cases:

```ts
function makeMessage(owner: DefaultBookWorkspace, index: number): WorkspaceMessageRecord {
  const timestamp = new Date(Date.UTC(2026, 6, 28, 0, 0, 0, index)).toISOString();
  return {
    id: `message-${index.toString().padStart(3, "0")}`,
    workspaceId: owner.workspace.id,
    sessionId: owner.session.id,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index}`,
    state: "complete",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

it("creates one stable default workspace and session per book", async () => {
  await saveBook(makeBook({ id: "b-workspace", title: "Workspace Book" }));
  const [first, second] = await Promise.all([
    ensureDefaultBookWorkspace("b-workspace"),
    ensureDefaultBookWorkspace("b-workspace"),
  ]);
  expect(second).toEqual(first);
});

it("pages messages newest-first in storage and returns chronological UI order", async () => {
  await saveBook(makeBook({ id: "b-workspace", title: "Workspace Book" }));
  const owner = await ensureDefaultBookWorkspace("b-workspace");
  for (let index = 0; index < 130; index += 1) {
    await putWorkspaceMessage(makeMessage(owner, index));
  }
  const latest = await listWorkspaceMessages(owner.session.id, { limit: 100 });
  expect(latest).toHaveLength(100);
  expect(latest[0].content).toBe("message-30");
  const older = await listWorkspaceMessages(owner.session.id, {
    limit: 50,
    before: { createdAt: latest[0].createdAt, id: latest[0].id },
  });
  expect(older.at(-1)?.content).toBe("message-29");
});

it("deletes an orphaned one-book workspace with all descendants", async () => {
  await saveBook(makeBook({ id: "b-workspace", title: "Workspace Book" }));
  const owner = await ensureDefaultBookWorkspace("b-workspace");
  await putWorkspaceMessage(makeMessage(owner, 0));
  await deleteBook("b-workspace");
  expect(await getReadingWorkspace(owner.workspace.id)).toBeUndefined();
  expect(await listWorkspaceMessages(owner.session.id, { limit: 100 })).toEqual([]);
});

it("preserves a workspace while another associated book remains", async () => {
  await saveBook(makeBook({ id: "book-a", title: "Book A" }));
  await saveBook(makeBook({ id: "book-b", title: "Book B" }));
  const owner = await ensureDefaultBookWorkspace("book-a");
  await attachBookToWorkspace(owner.workspace.id, "book-b", "reference");
  await deleteBook("book-a");
  expect(await getReadingWorkspace(owner.workspace.id)).toBeDefined();
  expect(await listWorkspaceBooks(owner.workspace.id)).toMatchObject([
    { bookId: "book-b", role: "reference" },
  ]);
});
```

Use the existing fake-indexeddb setup and existing `makeBook` style. Add exact
imports for each new persistence function.

- [ ] **Step 2: Run the focused database test RED**

```powershell
npm.cmd run test -- lib/db.test.ts
```

Expected: FAIL on missing workspace exports.

- [ ] **Step 3: Register the six v7 tables**

Import the domain types, add them to `AiReaderDb`, and append exactly one
Dexie version:

Add these properties inside the existing `AiReaderDb` intersection:

```ts
  readingWorkspaces: EntityTable<ReadingWorkspaceRecord, "id">;
  workspaceBooks: EntityTable<WorkspaceBookRecord, "id">;
  workspaceSessions: EntityTable<WorkspaceSessionRecord, "id">;
  workspaceMessages: EntityTable<WorkspaceMessageRecord, "id">;
  workspaceArtifacts: EntityTable<WorkspaceArtifactRecord, "id">;
  workspaceMemories: EntityTable<WorkspaceMemoryRecord, "id">;
```

Then append the v7 store declaration:

```ts
db.version(7).stores({
  readingWorkspaces: "id, updatedAt, lastOpenedAt",
  workspaceBooks: "id, workspaceId, bookId, [workspaceId+bookId]",
  workspaceSessions: "id, workspaceId, updatedAt, [workspaceId+updatedAt]",
  workspaceMessages: "id, sessionId, workspaceId, createdAt, [sessionId+createdAt+id]",
  workspaceArtifacts: "id, workspaceId, kind, updatedAt, [workspaceId+updatedAt]",
  workspaceMemories: "id, workspaceId, state, updatedAt, [workspaceId+updatedAt]",
});
```

Do not change version 1–6 declarations and do not put book files or covers
back into the metadata table.

- [ ] **Step 4: Implement focused workspace persistence APIs**

Add these exports to `lib/db.ts` with Dexie transactions:

```ts
export type DefaultBookWorkspace = {
  workspace: ReadingWorkspaceRecord;
  bookLink: WorkspaceBookRecord;
  session: WorkspaceSessionRecord;
};

export async function ensureDefaultBookWorkspace(bookId: string): Promise<DefaultBookWorkspace>;
export async function getReadingWorkspace(id: string): Promise<ReadingWorkspaceRecord | undefined>;
export async function listWorkspaceBooks(workspaceId: string): Promise<WorkspaceBookRecord[]>;
export async function attachBookToWorkspace(
  workspaceId: string,
  bookId: string,
  role: WorkspaceBookRecord["role"]
): Promise<WorkspaceBookRecord>;
export async function createWorkspaceSession(workspaceId: string, title?: string): Promise<WorkspaceSessionRecord>;
export async function listWorkspaceSessions(workspaceId: string): Promise<WorkspaceSessionRecord[]>;
export async function putWorkspaceSession(record: WorkspaceSessionRecord): Promise<void>;
export async function putWorkspaceMessage(record: WorkspaceMessageRecord): Promise<void>;
export async function putWorkspaceMessagePair(
  user: WorkspaceMessageRecord,
  assistant: WorkspaceMessageRecord
): Promise<void>;
export async function listWorkspaceMessages(
  sessionId: string,
  options: { limit: number; before?: { createdAt: string; id: string } }
): Promise<WorkspaceMessageRecord[]>;
export async function putWorkspaceArtifact(record: WorkspaceArtifactRecord): Promise<void>;
export async function listWorkspaceArtifacts(workspaceId: string): Promise<WorkspaceArtifactRecord[]>;
export async function deleteWorkspaceArtifact(id: string): Promise<void>;
export async function putWorkspaceMemory(record: WorkspaceMemoryRecord): Promise<void>;
export async function listWorkspaceMemories(workspaceId: string): Promise<WorkspaceMemoryRecord[]>;
export async function listAllReadingWorkspaces(): Promise<ReadingWorkspaceRecord[]>;
export async function listAllWorkspaceBooks(): Promise<WorkspaceBookRecord[]>;
export async function listAllWorkspaceSessions(): Promise<WorkspaceSessionRecord[]>;
export async function listAllWorkspaceMessages(): Promise<WorkspaceMessageRecord[]>;
export async function listAllWorkspaceArtifacts(): Promise<WorkspaceArtifactRecord[]>;
export async function listAllWorkspaceMemories(): Promise<WorkspaceMemoryRecord[]>;
```

`ensureDefaultBookWorkspace` must first confirm the book exists, reuse the
existing primary association when present, create all three initial records in
one transaction when absent, and throw `Book not found: <id>` when ownership
cannot be established. Concurrent calls for the same book must converge on one
association rather than creating duplicate default workspaces.

`listWorkspaceMessages` must use `[sessionId+createdAt+id]`, apply an exclusive
compound upper bound when `before` is present, reverse the database result,
and return chronological order to the caller. The message-pair constructor
gives the assistant record a timestamp one millisecond after its user record
so a new pair has deterministic conversational order.

- [ ] **Step 5: Extend delete, clear, and replacement transactions**

In `deleteBook`, fetch every `workspaceBooks` row for the book before deleting
the book. Remove those links, then for each affected workspace count remaining
links. When the count is zero, delete the workspace and all rows selected by
`workspaceId` from sessions, messages, artifacts, and memories.

Add all six tables to `clearAllReaderData`. Extend `ReaderDataReplacement` with
six required workspace arrays and make `replaceReaderData` clear and bulk-put
them in the same transaction. All current callers must pass empty arrays until
Task 3 supplies restored values.

- [ ] **Step 6: Run storage tests GREEN and all existing DB regressions**

```powershell
npm.cmd run test -- lib/db.test.ts lib/readingPersistenceIntegration.test.ts lib/localIdIntegration.test.ts
```

Expected: all selected tests pass; book/file/cover and annotation behavior is
unchanged.

- [ ] **Step 7: Commit the storage foundation**

```powershell
git add lib/db.ts lib/db.test.ts
git commit -m "feat: persist reading workspaces"
```

### Task 3: Upgrade backup and restore to version 3

**Files:**
- Create: `lib/workspaceBackup.ts`
- Create: `lib/workspaceBackup.test.ts`
- Modify: `lib/backup.ts`
- Modify: `lib/backup.test.ts`
- Modify: `lib/backupImport.test.ts`
- Modify: `lib/backupRestoreGuard.test.ts`
- Modify: `lib/backupUiIntegration.test.ts`
- Modify: `app/SettingsSurface.tsx`
- Modify: `lib/uiText.ts`

- [ ] **Step 1: Write failing workspace backup validator tests**

Create a minimal valid graph and mutate one edge per test:

```ts
const ISO = "2026-07-28T00:00:00.000Z";

const validGraph: WorkspaceBackupData = {
  readingWorkspaces: [{
    id: "w1", title: "Book", createdAt: ISO, updatedAt: ISO,
  }],
  workspaceBooks: [{
    id: "wb1", workspaceId: "w1", bookId: "b1", role: "primary", addedAt: ISO,
  }],
  workspaceSessions: [{
    id: "s1", workspaceId: "w1", title: "New chat", status: "idle",
    createdAt: ISO, updatedAt: ISO,
  }],
  workspaceMessages: [{
    id: "m1", workspaceId: "w1", sessionId: "s1", role: "user",
    content: "Question", state: "complete", createdAt: ISO, updatedAt: ISO,
  }],
  workspaceArtifacts: [],
  workspaceMemories: [],
};

it("accepts a referentially complete workspace graph", () => {
  expect(validateWorkspaceBackupData(validGraph, new Set(["b1"]))).toEqual(validGraph);
});

it.each([
  ["missing book", { ...validGraph, workspaceBooks: [{ ...validGraph.workspaceBooks[0], bookId: "missing" }] }],
  ["missing workspace", { ...validGraph, workspaceSessions: [{ ...validGraph.workspaceSessions[0], workspaceId: "missing" }] }],
  ["missing session", { ...validGraph, workspaceMessages: [{ ...validGraph.workspaceMessages[0], sessionId: "missing" }] }],
])("rejects %s references", (_label, graph) => {
  expect(() => validateWorkspaceBackupData(graph, new Set(["b1"]))).toThrow("Invalid backup");
});
```

Add tests for duplicate IDs, invalid enum values, a 1,000,001-character message,
and a context snapshot whose book is not associated with the owning workspace.

- [ ] **Step 2: Run validator tests RED**

```powershell
npm.cmd run test -- lib/workspaceBackup.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict workspace backup validation**

Create `lib/workspaceBackup.ts` exporting:

```ts
export const WORKSPACE_BACKUP_TEXT_LIMIT = 1_000_000;

export type WorkspaceBackupData = {
  readingWorkspaces: ReadingWorkspaceRecord[];
  workspaceBooks: WorkspaceBookRecord[];
  workspaceSessions: WorkspaceSessionRecord[];
  workspaceMessages: WorkspaceMessageRecord[];
  workspaceArtifacts: WorkspaceArtifactRecord[];
  workspaceMemories: WorkspaceMemoryRecord[];
};

export function emptyWorkspaceBackupData(): WorkspaceBackupData;
export function validateWorkspaceBackupData(
  value: unknown,
  bookIds: ReadonlySet<string>
): WorkspaceBackupData;
```

Implement record/array/string/ISO-date guards locally in this module. After
shape validation, build ID sets and reject every missing owner, duplicate ID,
invalid enum, and text value over `WORKSPACE_BACKUP_TEXT_LIMIT`. Do not repair
or silently drop invalid records. A message `replyToMessageId`, when present,
must resolve to a user message in the same session. A context snapshot's book
must be associated with the owning workspace.

- [ ] **Step 4: Define backup v3 without weakening v1/v2**

In `lib/backup.ts`, rename the current `BackupPayload` to `BackupPayloadV2`,
add `BackupPayloadV3`, and keep a union:

```ts
export interface BackupPayloadV3 extends Omit<BackupPayloadV2, "version">, WorkspaceBackupData {
  version: 3;
}

export type BackupPayload = BackupPayloadV3;
export type RestorableBackupPayload = BackupPayloadV3 | BackupPayloadV2 | LegacyBackupPayload;
```

`createBackupPayload` must read the six workspace arrays through the six
`listAll...` database functions and emit version 3.
`validateBackupPayload` must leave the v1 and v2 paths intact, then validate
the v3 workspace graph against the validated backup book IDs. `restoreBackupPayload`
must pass empty arrays for v1/v2 and the validated arrays for v3.

- [ ] **Step 5: Add round-trip and privacy regressions**

Extend `lib/backup.test.ts` and `lib/backupImport.test.ts` to prove:

- a conversation, context snapshot, artifact, and revoked memory survive a
  create/validate/restore/create round trip;
- v1 and v2 fixtures still restore with no workspace records;
- provider API keys are still empty in version 3;
- the backup UI warning mentions selected passages and AI conversations;
- invalid workspace references fail before `replaceReaderData` runs.

- [ ] **Step 6: Run the complete backup checkpoint**

```powershell
npm.cmd run test -- lib/workspaceBackup.test.ts lib/backup.test.ts lib/backupImport.test.ts lib/backupRestoreGuard.test.ts lib/backupUiIntegration.test.ts
```

Expected: all selected tests pass and existing fixtures remain accepted.

- [ ] **Step 7: Commit backup v3**

```powershell
git add lib/workspaceBackup.ts lib/workspaceBackup.test.ts lib/backup.ts lib/backup.test.ts lib/backupImport.test.ts lib/backupRestoreGuard.test.ts lib/backupUiIntegration.test.ts app/SettingsSurface.tsx lib/uiText.ts
git commit -m "feat: include workspaces in reader backups"
```

### Task 4: Add routed workspace UI and both product entry points

**Files:**
- Create: `app/ReadingWorkspaceSheet.tsx`
- Create: `app/WorkspaceConversation.tsx`
- Create: `app/WorkspaceMaterials.tsx`
- Modify: `lib/appNavigation.ts`
- Modify: `lib/navigationHistory.ts`
- Modify: `app/AppOverlays.tsx`
- Modify: `app/AskAiPanel.tsx`
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/uiText.ts`
- Modify: `lib/appNavigation.test.ts`
- Modify: `lib/pushSurfacesIntegration.test.ts`
- Modify: `lib/askAiReaderContextIntegration.test.ts`

- [ ] **Step 1: Write navigation and source-integration tests RED**

Add a routed sheet assertion to `lib/appNavigation.test.ts`:

```ts
it("presents a book-owned reading workspace as a routed sheet", () => {
  const state = reduceAppNavigation(createAppNavigationState(), {
    type: "present-sheet",
    entry: {
      key: "workspace-sheet",
      kind: "sheet",
      route: "reading-workspace",
      entityId: "book-1",
    },
  });
  expect(state.sheets.at(-1)).toMatchObject({
    route: "reading-workspace",
    entityId: "book-1",
  });
});
```

Add source-integration assertions that require:

- `reading-workspace` in `SheetRoute` and navigation history decoding;
- `ReadingWorkspaceSheet` in `AppOverlays`;
- a `阅读空间` row in `BookActionSheet`;
- an expand action in the Ask AI sheet;
- no new `NavigationTab` value and no fourth root tab button.

- [ ] **Step 2: Run the focused navigation tests RED**

```powershell
npm.cmd run test -- lib/appNavigation.test.ts lib/pushSurfacesIntegration.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: FAIL on the missing route and surface.

- [ ] **Step 3: Register the routed sheet**

Add `"reading-workspace"` to `SheetRoute` and to the route allowlist in
`lib/navigationHistory.ts`. Include it in `BOOK_ROUTES` so a restored history
entry is removed when its book no longer exists.

Extend `AppOverlaysProps.reader` with `bookId: string | null` and add these
actions:

```ts
openReadingWorkspace: (bookId: string) => void;
newWorkspaceSession: (workspaceId: string) => void;
selectWorkspaceSession: (sessionId: string) => void;
```

Render `ReadingWorkspaceSheet` for the new route using `sheet.entityId` as the
book ID. Do not make it a push route and do not modify root-tab types.

- [ ] **Step 4: Build the quiet two-view shell**

Create `app/ReadingWorkspaceSheet.tsx` with this public interface:

```ts
type ReadingWorkspaceSheetProps = {
  book: BookMetadata;
  workspace: ReadingWorkspaceRecord | null;
  sessions: WorkspaceSessionRecord[];
  activeSessionId: string | null;
  messages: WorkspaceMessageRecord[];
  loading: boolean;
  error: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  conversation: Omit<ComponentProps<typeof WorkspaceConversation>, "messages">;
  materials: ComponentProps<typeof WorkspaceMaterials>;
};
```

Use `BottomSheet` with `styles.readingWorkspaceSheet`. Maintain one local
`view: "conversation" | "materials"` state. The header contains the truncated
book title, a single session overflow button on the conversation view, and
Close. The segmented control is a two-button `role="tablist"` with
`aria-selected` and `aria-controls`; it must not become a row of dashboard
cards.

- [ ] **Step 5: Add both entry points without leaving stale sheets**

In `BookActionSheet`, place `阅读空间` immediately after Open Book. Call the
provided `close` callback and present `reading-workspace` only after the action
sheet finishes closing.

In `AskAiSheet`, pass the active book ID to the compact panel and add a header
text button `阅读空间`. It closes Ask AI, then presents the same
`reading-workspace` route with that book ID. If the reader has no active book,
the action is absent rather than disabled.

- [ ] **Step 6: Add restrained mobile CSS**

Add these structural rules using existing tokens:

```css
.readingWorkspaceSheet {
  height: min(94dvh, 920px);
  max-height: calc(100dvh - max(12px, env(safe-area-inset-top)));
}

.workspaceShell {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
}

.workspaceSegments {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  margin: 8px 16px 10px;
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-secondary);
}

.workspaceSegment {
  min-height: 36px;
  border: 0;
  border-radius: 8px;
  color: var(--text-secondary);
  background: transparent;
}

.workspaceSegment[aria-selected="true"] {
  color: var(--text-primary);
  background: var(--surface-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.workspaceViewport {
  min-height: 0;
  overflow: hidden;
}
```

Use the existing safe-area, focus-ring, theme, and reduced-motion variables.
Do not add gradients, remote icons, backdrop blur, or a full-screen fixed
dashboard behind the sheet.

- [ ] **Step 7: Run navigation and shell tests GREEN**

```powershell
npm.cmd run test -- lib/appNavigation.test.ts lib/navigationHistory.test.ts lib/pushSurfacesIntegration.test.ts lib/askAiReaderContextIntegration.test.ts lib/surfaceArchitecture.test.ts
```

Expected: all selected tests pass and root navigation remains three tabs.

- [ ] **Step 8: Commit the workspace shell**

```powershell
git add app/ReadingWorkspaceSheet.tsx app/WorkspaceConversation.tsx app/WorkspaceMaterials.tsx app/AppOverlays.tsx app/AskAiPanel.tsx app/page.tsx app/page.module.css lib/appNavigation.ts lib/navigationHistory.ts lib/uiText.ts lib/appNavigation.test.ts lib/pushSurfacesIntegration.test.ts lib/askAiReaderContextIntegration.test.ts
git commit -m "feat: add reading workspace surface"
```

### Task 5: Replace transient Ask AI state with persistent sessions

**Files:**
- Create: `lib/workspaceChat.ts`
- Create: `lib/workspaceChat.test.ts`
- Create: `app/useWorkspaceChat.ts`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `app/AskAiPanel.tsx`
- Modify: `app/ReadingWorkspaceSheet.tsx`
- Modify: `app/page.tsx`
- Delete: `app/useAskAi.ts`
- Modify: `lib/askAiReaderContextIntegration.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`

- [ ] **Step 1: Write pure message-transition and history tests RED**

Create `lib/workspaceChat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildWorkspaceMessagePair,
  selectInferenceHistory,
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
  options: { includeErrorAt?: number } = {}
): WorkspaceMessageRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `m-${index}`,
    workspaceId: "w1",
    sessionId: "s1",
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index}`,
    state: index === options.includeErrorAt ? "error" : "complete",
    createdAt: new Date(Date.UTC(2026, 6, 28, 0, 0, 0, index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 6, 28, 0, 0, 0, index)).toISOString(),
  }));
}

it("creates a complete user turn and streaming assistant record", () => {
  const pair = buildWorkspaceMessagePair({
    workspaceId: "w1",
    sessionId: "s1",
    question: "Explain this",
    contextSnapshot: SNAPSHOT,
    now: "2026-07-28T00:00:00.000Z",
    createId: (() => { const ids = ["u1", "a1"]; return () => ids.shift()!; })(),
  });
  expect(pair.user).toMatchObject({ role: "user", state: "complete" });
  expect(pair.assistant).toMatchObject({ role: "assistant", state: "streaming", content: "" });
});

it("excludes failed assistants and keeps only the latest bounded usable history", () => {
  const history = makeHistory(30, { includeErrorAt: 28 });
  const selected = selectInferenceHistory(history);
  expect(selected).toHaveLength(20);
  expect(selected.map((message) => message.content)).not.toContain("message-28");
});

it("rejects events from a stale workspace, session, message, or generation", () => {
  expect(shouldAcceptWorkspaceEvent(CURRENT, CURRENT)).toBe(true);
  expect(shouldAcceptWorkspaceEvent(CURRENT, { ...CURRENT, sessionId: "old" })).toBe(false);
});
```

- [ ] **Step 2: Run the focused chat-policy test RED**

```powershell
npm.cmd run test -- lib/workspaceChat.test.ts
```

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement the pure request/state policy**

Create `lib/workspaceChat.ts` exporting:

```ts
export type WorkspaceRequestIdentity = {
  workspaceId: string;
  sessionId: string;
  assistantMessageId: string;
  generation: number;
};

export function buildWorkspaceMessagePair(input: {
  workspaceId: string;
  sessionId: string;
  question: string;
  contextSnapshot: WorkspaceContextSnapshot;
  skillId?: string;
  now?: string;
  createId?: () => string;
}): { user: WorkspaceMessageRecord; assistant: WorkspaceMessageRecord };

export function selectInferenceHistory(
  messages: WorkspaceMessageRecord[]
): ChatConversationMessage[];

export function shouldAcceptWorkspaceEvent(
  current: WorkspaceRequestIdentity,
  incoming: WorkspaceRequestIdentity
): boolean;
```

`selectInferenceHistory` filters empty content and `error`/`streaming` states,
limits each content string with `limitContextText(..., 3_000)`, and returns the
last 20 messages in chronological order. A cancelled assistant with partial
content remains usable history; an empty cancelled assistant does not.

The message pair stores `skillId` when a bundled Skill initiated the turn and
sets the assistant's `replyToMessageId` to the new user-message ID.

- [ ] **Step 4: Build `useWorkspaceChat` around stable record identities**

The hook interface is:

```ts
type UseWorkspaceChatOptions = {
  book: BookMetadata | null;
  readerContextBookId: string | null;
  activeAiProvider: AiProviderConfig | null;
  aiProviderUsable: boolean;
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
  readerLocator?: string;
  progressPercent?: number;
};
```

`book` is derived from the top `reading-workspace` sheet's `entityId`, falling
back to the currently open reader book for compact Ask AI. This allows a
workspace to open from Book Actions without loading the source file into the
reader. `readerContextBookId` is the actual open reader book; visible text,
selection, locator, and progress are included only when it equals `book.id`.

Track `navigator.onLine` with `online` and `offline` listeners. Return the
Boolean from the hook, disable Send while offline without clearing the draft,
and keep all repository reads, material edits, and exports available.

It returns workspace/session/message/material state plus:

```ts
{
  selectedText, setSelectedText, clearSelection,
  question, setQuestion,
  loading, error, online,
  ask, stop, retry,
  selectSession, createSession,
  loadOlderMessages,
  refreshMaterials,
}
```

On workspace-book change, abort the current controller, increment a generation counter,
clear only view state, call `ensureDefaultBookWorkspace`, load sessions, choose
the most recently updated session, and load its newest 100 messages. Do not
delete any stored record.

On Send:

1. capture selected/nearby text and reader locator into a bounded snapshot
   only when the workspace book is the active reader book;
2. build and atomically store the user/assistant pair;
3. set the session to `streaming`;
4. call the current JSON `/api/chat` with selected inference history;
5. on success update the assistant to `complete` and the session to `idle`;
6. on abort keep partial content and mark `cancelled`;
7. on failure persist `error` on both assistant and session;
8. reject stale completion with `shouldAcceptWorkspaceEvent`.

If the initial local transaction fails, expose a persistence error and do not
call `fetch`. Detect `QuotaExceededError` by DOMException name and use the
specific message `本地存储空间不足，问题尚未发送。`; other IndexedDB failures use
`无法保存对话，问题尚未发送。`.

Task 5 intentionally retains the existing complete-JSON API. Streaming is a
separate red-green change in Task 6.

- [ ] **Step 5: Share one conversation component**

Move message list, selected-text preview, provider guidance, composer, status,
Stop, and retry markup into `WorkspaceConversation.tsx`. `AskAiPanel` becomes
a small prop adapter selecting compact mode; `ReadingWorkspaceSheet` renders
the same component in full mode. Both surfaces receive the same message array
and handlers from `useWorkspaceChat`.

Use a `<textarea rows={1}>` that grows to a CSS max height. Enter sends only
when Shift is not held and `nativeEvent.isComposing` is false. While a request
is active the draft remains editable, Send becomes Stop, and the composer is
not disabled.

- [ ] **Step 6: Remove transient state and strengthen integration tests**

Replace the `useAskAi` call in `app/page.tsx` with `useWorkspaceChat`. Delete
`app/useAskAi.ts` only after `rg "useAskAi" app lib` returns no production
caller. Update the source integration test to require `ensureDefaultBookWorkspace`,
`putWorkspaceMessagePair`, stale identity checks, and no direct
`crypto.randomUUID` use.

- [ ] **Step 7: Run the persistent-chat checkpoint**

```powershell
npm.cmd run test -- lib/workspaceChat.test.ts lib/db.test.ts lib/askAiReaderContextIntegration.test.ts lib/accessibilityIntegration.test.ts lib/aiChat.test.ts lib/aiRequestSecurity.test.ts
```

Expected: all selected tests pass; closing/reopening is now a repository load,
not a message reset.

- [ ] **Step 8: Commit persistent conversations**

```powershell
git add app/useWorkspaceChat.ts app/WorkspaceConversation.tsx app/ReadingWorkspaceSheet.tsx app/AskAiPanel.tsx app/page.tsx lib/workspaceChat.ts lib/workspaceChat.test.ts lib/askAiReaderContextIntegration.test.ts lib/accessibilityIntegration.test.ts
git rm app/useAskAi.ts
git commit -m "feat: persist reading conversations"
```

### Task 6: Normalize provider streaming and truthful interruption states

**Files:**
- Create: `lib/aiStream.ts`
- Create: `lib/aiStream.test.ts`
- Modify: `lib/aiChat.ts`
- Modify: `lib/aiChat.test.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/useWorkspaceChat.ts`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `lib/aiRequestSecurity.test.ts`

- [ ] **Step 1: Write split-chunk provider stream tests RED**

Cover chunks split inside `data:` lines and inside JSON strings. The test
fixtures must include these provider events:

```ts
const OPENAI = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n';
const ANTHROPIC = 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n';
const GEMINI = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n';
```

Assert that every decoder yields exactly `{ type: "delta", text: "Hello" }`,
that `[DONE]`/message-stop/provider finish yields `{ type: "done" }`, and that
an invalid event produces one sanitized error without leaking raw headers or
API-key-like fixture text.

- [ ] **Step 2: Run the stream tests RED**

```powershell
npm.cmd run test -- lib/aiStream.test.ts
```

Expected: FAIL because the stream normalizer does not exist.

- [ ] **Step 3: Add a stream option to provider requests**

Change `buildAiProviderRequest` to accept a third argument:

```ts
export function buildAiProviderRequest(
  provider: AiProviderConfig,
  messages: ChatMessage[],
  options: { stream?: boolean } = {}
): AiProviderRequest
```

For OpenAI-compatible and Anthropic-compatible bodies add
`stream: options.stream === true`. For Gemini, when streaming, use the
`:streamGenerateContent?alt=sse` endpoint; otherwise retain
`:generateContent`. Keep API keys in headers exactly as today.

- [ ] **Step 4: Implement provider decoders and application SSE encoding**

Create `lib/aiStream.ts` with:

```ts
export type WorkspaceStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export function normalizeAiProviderStream(
  protocol: AiProviderConfig["protocol"],
  upstream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array>;

export async function* readWorkspaceEventStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<WorkspaceStreamEvent>;
```

Use `TextDecoder` with `{ stream: true }`, retain incomplete SSE frames between
chunks, parse only complete blank-line-delimited events, and emit application
events as UTF-8 `data: <json>\n\n`. Never concatenate the entire upstream body.

- [ ] **Step 5: Stream from the route through the existing request security**

Keep `readLimitedJson`, provider sanitization, question/message limits,
`fetchAiUpstream`, local-development rules, and non-2xx sanitization. Build the
provider request with `{ stream: true }`; if `upstream.body` is absent return a
502 JSON error. Otherwise return:

```ts
return new Response(normalizeAiProviderStream(resolvedProvider.protocol, upstream.body), {
  headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  },
});
```

- [ ] **Step 6: Consume events with coalesced local checkpoints**

In `useWorkspaceChat`, accumulate text in a ref. Publish visible text at most
once per animation frame. Persist a streaming checkpoint only when at least
1,000ms has elapsed since the previous checkpoint or 4,000 new characters
arrived. Always persist final `complete`, `cancelled`, or `error` state.

Stop calls `AbortController.abort()` and must not display a generic provider
failure. Retry creates a new assistant record with the same
`replyToMessageId` and leaves the previous errored attempt visible. Reloading a
session with a leftover `streaming` record marks that message `cancelled` and
the owning session `paused`, preserving partial content and exposing Retry
rather than pretending the request is still running.

- [ ] **Step 7: Run all streaming and security tests GREEN**

```powershell
npm.cmd run test -- lib/aiStream.test.ts lib/aiChat.test.ts lib/aiRequestSecurity.test.ts lib/workspaceChat.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: all selected tests pass, including deliberately split SSE chunks.

- [ ] **Step 8: Commit streaming**

```powershell
git add lib/aiStream.ts lib/aiStream.test.ts lib/aiChat.ts lib/aiChat.test.ts app/api/chat/route.ts app/useWorkspaceChat.ts app/WorkspaceConversation.tsx lib/aiRequestSecurity.test.ts
git commit -m "feat: stream workspace conversations"
```

### Task 7: Add message pagination, Markdown completion, and large-content guards

**Files:**
- Create: `app/WorkspaceMessageBody.tsx`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `app/useWorkspaceChat.ts`
- Modify: `app/page.module.css`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/workspaceChat.ts`
- Modify: `lib/workspaceChat.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`

- [ ] **Step 1: Write policy and source tests RED**

Add pure tests for these exact boundaries:

```ts
expect(getWorkspaceMessageRenderMode({ length: 7_999, streaming: true })).toBe("live");
expect(getWorkspaceMessageRenderMode({ length: 8_001, streaming: true })).toBe("live-tail");
expect(getWorkspaceMessageRenderMode({ length: 32_001, streaming: false })).toBe("collapsed");
expect(getWorkspaceMessageRenderMode({ length: 32_000, streaming: false })).toBe("markdown");
```

Require a Load Older button, an explicit Expand button, Export, and a path
that preserves scroll offset after older messages are prepended.

- [ ] **Step 2: Run policy tests RED**

```powershell
npm.cmd run test -- lib/workspaceChat.test.ts lib/accessibilityIntegration.test.ts
```

Expected: FAIL on missing render policy and controls.

- [ ] **Step 3: Install completed-message Markdown dependencies**

```powershell
npm.cmd install react-markdown remark-gfm
```

Expected: `package.json` and `package-lock.json` contain both direct
dependencies. Immediately run `npm.cmd audit --omit=dev --audit-level=high`;
stop and report rather than accepting a high-severity production advisory.

- [ ] **Step 4: Implement the render policy**

Add to `lib/workspaceChat.ts`:

```ts
export type WorkspaceMessageRenderMode = "live" | "live-tail" | "markdown" | "collapsed";

export function getWorkspaceMessageRenderMode({
  length,
  streaming,
}: {
  length: number;
  streaming: boolean;
}): WorkspaceMessageRenderMode {
  if (streaming && length > WORKSPACE_LIVE_DEGRADE_CHARS) return "live-tail";
  if (streaming) return "live";
  if (length > WORKSPACE_LARGE_MESSAGE_CHARS) return "collapsed";
  return "markdown";
}
```

`WorkspaceMessageBody` renders live content with `white-space: pre-wrap`, a
4,000-character tail plus a concise live notice in `live-tail`, ReactMarkdown
with `remarkGfm` only for frozen content, and an 8,000-character preview in
`collapsed`. Expand renders the complete Markdown only after an explicit user
action. Export creates a `text/markdown` Blob and uses the existing local
download pattern; it never slices the stored content.

- [ ] **Step 5: Preserve scroll ownership during pagination**

Before loading 50 older messages, record the scroll container's `scrollHeight`
and `scrollTop`. After React commits prepended records, set:

```ts
thread.scrollTop = thread.scrollHeight - previousScrollHeight + previousScrollTop;
```

Auto-follow only when the reader was within 48px of the bottom before a
published delta. Do not write near-bottom state on every scroll frame; store it
in a ref and update React state only when the Boolean changes.

- [ ] **Step 6: Run focused rendering tests GREEN**

```powershell
npm.cmd run test -- lib/workspaceChat.test.ts lib/accessibilityIntegration.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: all selected tests pass; streaming does not invoke ReactMarkdown.

- [ ] **Step 7: Commit long-content resilience**

```powershell
git add app/WorkspaceMessageBody.tsx app/WorkspaceConversation.tsx app/useWorkspaceChat.ts app/page.module.css lib/workspaceChat.ts lib/workspaceChat.test.ts lib/accessibilityIntegration.test.ts package.json package-lock.json
git commit -m "perf: bound workspace conversation rendering"
```

### Task 8: Add four bounded reading Skills and semantic artifacts

**Files:**
- Create: `lib/readingSkills.ts`
- Create: `lib/readingSkills.test.ts`
- Create: `app/WorkspaceArtifactPreview.tsx`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `app/WorkspaceMaterials.tsx`
- Modify: `app/ReadingWorkspaceSheet.tsx`
- Modify: `app/useWorkspaceChat.ts`
- Modify: `app/AppOverlays.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/uiText.ts`
- Modify: `lib/db.test.ts`
- Modify: `lib/accessibilityIntegration.test.ts`

- [ ] **Step 1: Write Skill eligibility and prompt tests RED**

Create `lib/readingSkills.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  READING_SKILLS,
  buildReadingSkillQuestion,
  listEligibleReadingSkills,
} from "./readingSkills";

it("bundles exactly four reading Skills", () => {
  expect(READING_SKILLS.map((skill) => skill.id)).toEqual([
    "explain-selection",
    "translate-selection",
    "summarize-nearby",
    "extract-key-points",
  ]);
});

it("hides selection Skills when no selected text exists", () => {
  expect(listEligibleReadingSkills({ selectedText: "", nearbyText: "page" }).map((skill) => skill.id)).toEqual([
    "summarize-nearby",
    "extract-key-points",
  ]);
});

it("builds a bounded question without duplicating passage text", () => {
  const question = buildReadingSkillQuestion("explain-selection", {
    selectedText: "passage",
    nearbyText: "nearby",
    locale: "zh-CN",
  });
  expect(question).toContain("解释");
  expect(question).not.toContain("passage");
  expect(question).not.toContain("nearby");
});
```

The last assertion is important: passages travel in the existing context
snapshot, not duplicated inside prompt-template text.

- [ ] **Step 2: Run Skill tests RED**

```powershell
npm.cmd run test -- lib/readingSkills.test.ts
```

Expected: FAIL because the Skill registry does not exist.

- [ ] **Step 3: Implement metadata-first Skill descriptors**

Create `lib/readingSkills.ts`:

```ts
export type ReadingSkillId =
  | "explain-selection"
  | "translate-selection"
  | "summarize-nearby"
  | "extract-key-points";

export type ReadingSkill = {
  id: ReadingSkillId;
  name: string;
  description: string;
  requiredContext: "selection" | "nearby";
  artifactKind: WorkspaceArtifactKind;
};

export const READING_SKILLS: readonly ReadingSkill[] = [
  { id: "explain-selection", name: "解释选中内容", description: "解释含义、语境和难点", requiredContext: "selection", artifactKind: "explanation" },
  { id: "translate-selection", name: "翻译选中内容", description: "忠实翻译并保留语气", requiredContext: "selection", artifactKind: "explanation" },
  { id: "summarize-nearby", name: "总结当前内容", description: "概括当前可见内容", requiredContext: "nearby", artifactKind: "summary" },
  { id: "extract-key-points", name: "提炼要点", description: "提取简洁、有层次的要点", requiredContext: "nearby", artifactKind: "outline" },
] as const;

export function listEligibleReadingSkills(context: {
  selectedText?: string;
  nearbyText?: string;
}): ReadingSkill[];

export function buildReadingSkillQuestion(
  id: ReadingSkillId,
  context: { selectedText?: string; nearbyText?: string; locale: string }
): string;
```

`buildReadingSkillQuestion` returns only the instruction and output contract.
It throws when required context is absent and never interpolates passage text.

- [ ] **Step 4: Render Skills only where they reduce effort**

In compact and full conversation views, show eligible Skills above the empty
composer or when a fresh selection exists. Use horizontally scrolling native
buttons with visible text, 44px minimum targets, and no colorful icon grid.
Invoking a Skill sets the generated instruction as the next question and sends
through the same `ask` path; it does not create a tool loop.

- [ ] **Step 5: Add explicit Save to Materials**

For each complete assistant message, add a message overflow action
`保存到资料`. Create a `WorkspaceArtifactRecord` using:

```ts
{
  id: createLocalId(),
  workspaceId,
  sessionId,
  sourceMessageIds: [message.id],
  kind: READING_SKILLS.find((skill) => skill.id === message.skillId)?.artifactKind ?? "note",
  title: createArtifactTitle(message.content, book.title),
  content: message.content,
  mediaType: "text/markdown",
  createdAt: now,
  updatedAt: now,
}
```

`createArtifactTitle` uses the first non-empty Markdown heading or first text
line, strips Markdown punctuation, caps at 60 characters, and falls back to
`<book title> 资料`. Saving the same source message twice is prevented by an
existing-source lookup, not by title matching.

- [ ] **Step 6: Implement materials list and artifact preview**

`WorkspaceMaterials` reads existing bookmarks/highlights from the reader
annotation controller without copying them. It lists artifacts by `updatedAt`
descending and shows kind, title, and date.

`WorkspaceArtifactPreview` renders completed Markdown and exposes Copy,
Export, Rename, and Delete. Rename trims the title and rejects empty input.
Delete uses a destructive confirmation. Export writes the complete content to
a Markdown Blob using a filesystem-safe filename; no server request is made.

- [ ] **Step 7: Test storage, semantics, and accessibility GREEN**

```powershell
npm.cmd run test -- lib/readingSkills.test.ts lib/db.test.ts lib/accessibilityIntegration.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: all selected tests pass; no artifact exists until Save to Materials
is activated.

- [ ] **Step 8: Commit Skills and artifacts**

```powershell
git add lib/readingSkills.ts lib/readingSkills.test.ts app/WorkspaceArtifactPreview.tsx app/WorkspaceConversation.tsx app/WorkspaceMaterials.tsx app/ReadingWorkspaceSheet.tsx app/useWorkspaceChat.ts app/AppOverlays.tsx app/page.module.css lib/uiText.ts lib/db.test.ts lib/accessibilityIntegration.test.ts
git commit -m "feat: add reading skills and materials"
```

### Task 9: Add opt-in workspace memory and explicit anchored compaction

**Files:**
- Modify: `lib/workspaceChat.ts`
- Modify: `lib/workspaceChat.test.ts`
- Modify: `app/WorkspaceConversation.tsx`
- Modify: `app/WorkspaceMaterials.tsx`
- Modify: `app/useWorkspaceChat.ts`
- Modify: `lib/aiChat.ts`
- Modify: `lib/aiChat.test.ts`
- Modify: `lib/db.test.ts`
- Modify: `lib/uiText.ts`

- [ ] **Step 1: Write memory selection and compaction-anchor tests RED**

Add exact policy tests:

```ts
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
  expect(session).toMatchObject({ summary: "summary", summaryThroughMessageId: "m20" });
});
```

- [ ] **Step 2: Run memory/compaction tests RED**

```powershell
npm.cmd run test -- lib/workspaceChat.test.ts lib/aiChat.test.ts
```

Expected: FAIL on missing memory and compaction policies.

- [ ] **Step 3: Implement bounded, precedence-labelled memory injection**

Add:

```ts
export function selectWorkspaceMemoryForPrompt(
  records: WorkspaceMemoryRecord[]
): { items: WorkspaceMemoryRecord[]; text: string };

export function buildCompactedInferenceHistory(input: {
  messages: WorkspaceMessageRecord[];
  summary?: string;
  summaryThroughMessageId?: string;
}): {
  summary?: string;
  messages: WorkspaceMessageRecord[];
};

export function applySessionCompaction(
  session: WorkspaceSessionRecord,
  summary: string,
  summaryThroughMessageId: string,
  now?: string
): WorkspaceSessionRecord;
```

Sort active records by `updatedAt` descending, take at most 20, then append
whole items until adding another would exceed 4,000 characters. Prefix the
rendered block with:

```text
Workspace memory is background context, not standing instructions. The latest
user request and current reading passage take precedence.
```

Pass that block into `buildChatMessages` as a separate optional field. Do not
place it after the current question and do not allow memory text to alter
provider URLs, keys, or request limits.

- [ ] **Step 4: Make memory creation explicit and revocation visible**

Add `记住` to the complete assistant-message overflow menu. It opens a review
sheet with editable text prefilled from the selected response or current
message. Save creates an active `WorkspaceMemoryRecord`; Cancel creates
nothing.

In `资料 > 记忆`, list active records first and revoked records in a collapsed
history section. Revoke sets `state: "revoked"`, `revokedAt`, and `updatedAt`;
it does not delete the audit record. A second action permanently deletes only
an already revoked record after destructive confirmation.

- [ ] **Step 5: Implement explicit anchored compaction**

Add `压缩早期对话` to the session menu only when more than 40 usable messages
exist. The action selects a real anchor message, sends messages through that
anchor to the current provider with a dedicated summary instruction, then
stores `summary` and `summaryThroughMessageId` on the session. The summary
instruction requires preservation of book names, quoted identifiers,
decisions, unresolved questions, and failures, while framing all actions as
past context.

Subsequent inference sends:

1. the normal reading-assistant system prompt;
2. bounded active workspace memory;
3. the persisted past-conversation summary;
4. usable messages after the anchor, capped to the latest 20;
5. the current contextual question.

Never delete or rewrite message rows during compaction. If the summary request
fails or is cancelled, leave the existing summary/anchor unchanged.

- [ ] **Step 6: Test prompt precedence and persistence GREEN**

```powershell
npm.cmd run test -- lib/workspaceChat.test.ts lib/aiChat.test.ts lib/db.test.ts lib/askAiReaderContextIntegration.test.ts
```

Expected: all selected tests pass; revoked memory and pre-anchor messages are
excluded from inference but remain queryable locally.

- [ ] **Step 7: Commit memory and compaction**

```powershell
git add lib/workspaceChat.ts lib/workspaceChat.test.ts app/WorkspaceConversation.tsx app/WorkspaceMaterials.tsx app/useWorkspaceChat.ts lib/aiChat.ts lib/aiChat.test.ts lib/db.test.ts lib/uiText.ts
git commit -m "feat: add visible workspace memory"
```

### Task 10: Add browser acceptance, offline, accessibility, and performance evidence

**Files:**
- Create: `e2e/reading-workspace.spec.ts`
- Modify after a demonstrated failure: `app/ReadingWorkspaceSheet.tsx`
- Modify after a demonstrated failure: `app/WorkspaceConversation.tsx`
- Modify after a demonstrated failure: `app/WorkspaceMaterials.tsx`
- Modify after a demonstrated failure: `app/page.module.css`
- Modify after a demonstrated harness defect: `e2e/reading-workspace.spec.ts`

- [ ] **Step 1: Add a deterministic local stream fixture to Playwright**

In `e2e/reading-workspace.spec.ts`, install a `page.addInitScript` wrapper
around `window.fetch` before navigation. For `/api/chat`, return a real
`ReadableStream` that enqueues three encoded application SSE events on
separate timer turns and then closes:

```ts
await page.addInitScript(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
    if (!url.endsWith("/api/chat")) return originalFetch(input, init);
    const encoder = new TextEncoder();
    const signal = init?.signal;
    const events = [
      { type: "delta", text: "第一段" },
      { type: "delta", text: "第二段" },
      { type: "delta", text: "第三段" },
      { type: "done" },
    ];
    return new Response(new ReadableStream({
      start(controller) {
        let index = 0;
        let timer = 0;
        signal?.addEventListener("abort", () => {
          window.clearTimeout(timer);
          controller.error(new DOMException("Aborted", "AbortError"));
        }, { once: true });
        const publish = () => {
          if (signal?.aborted) return;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(events[index])}\n\n`)
          );
          index += 1;
          if (index === events.length) controller.close();
          else timer = window.setTimeout(publish, 30);
        };
        publish();
      },
    }), { headers: { "Content-Type": "text/event-stream" } });
  };
});
```

Never call a real AI provider or include an API key in browser fixtures.

- [ ] **Step 2: Test the reader-to-workspace happy path**

Import `e2e/fixtures/sample.txt`, open it, select or inject a deterministic
selection through the existing reader fixture path, open Ask AI, send a
question, wait for the completed response, close the sheet, reopen it, and
assert the response remains. Expand to Reading Workspace and assert the same
message IDs/text are present rather than a copied transcript.

- [ ] **Step 3: Test book isolation and deletion lifecycle**

Import two TXT books. Create a conversation and saved artifact in book A.
Open book B and assert neither appears. Delete book A, export backup v3, and
assert no workspace association/session/message/artifact for book A remains.

- [ ] **Step 4: Test Stop, reload, retry, and offline truthfulness**

Use a route that never emits done, stop after two deltas, reload, and assert the
partial answer is labelled interrupted/paused. Retry with the successful
fixture and assert both attempts remain visible. Set the browser context
offline, confirm stored conversations/materials remain readable, and confirm
Send is disabled with network status rather than losing the draft.

- [ ] **Step 5: Test long-session and long-message behavior**

Seed 330 messages through IndexedDB in `page.evaluate`, open the workspace,
and assert only the newest 100 render initially. Activate Load Older and assert
150 render while the first visible pre-load message keeps the same top offset
within 1px.

Seed a 33,000-character complete message and assert an 8,000-character preview,
Expand, and Export. Stream past 8,000 characters and assert the bounded live
tail appears while the composer accepts typing without input loss.

- [ ] **Step 6: Test accessibility and visual constraints separately**

At iPhone 14 and iPhone 15 Pro Max sizes, verify:

- no horizontal document overflow beyond 1px;
- the sheet stays above top and bottom safe areas;
- both segmented buttons expose selected state;
- every icon-only action has an accessible name;
- status/error regions do not announce individual tokens;
- 200% root font size preserves access to composer, Stop, Close, and materials;
- reduced motion removes spatial message entrances;
- Light, Dark, Sepia, and system-dark screenshots contain no clipped content.

- [ ] **Step 7: Measure one cold workspace-open path per profile**

Capture click-to-sheet-visible, maximum long task, layout shift, and frame
intervals for the real Book Actions → Reading Workspace path. Use one trace-off
run per profile and retain unfavorable samples. Initial architecture budgets:

- click to visible workspace shell: at most 100ms;
- cumulative layout shift: 0;
- no main-thread long task at or above 50ms;
- no animated `filter`, `backdrop-filter`, width, height, or layout position.

These Chromium measurements are regression evidence, not proof of physical
120fps.

- [ ] **Step 8: Run the focused browser suite once per profile**

```powershell
npx.cmd playwright test e2e/reading-workspace.spec.ts --project=iphone-14 --workers=1 --retries=0 --trace=off
npx.cmd playwright test e2e/reading-workspace.spec.ts --project=iphone-15-pro-max --workers=1 --retries=0 --trace=off
```

Expected: all reading-workspace scenarios pass. Report any failure and retain
its screenshot/metrics; do not relax thresholds after seeing results.

- [ ] **Step 9: Commit only evidence-backed hardening**

```powershell
git add e2e/reading-workspace.spec.ts app/ReadingWorkspaceSheet.tsx app/WorkspaceConversation.tsx app/WorkspaceMaterials.tsx app/page.module.css
git commit -m "test: cover reading workspace journeys"
```

Omit unchanged production files from `git add`. If browser evidence required
no production correction, commit only the new test.

### Task 11: Complete repository verification and handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the complete local gate**

```powershell
npm.cmd audit --omit=dev --audit-level=high
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
git status -sb
```

Expected: zero high-severity production advisories, all Vitest tests pass,
ESLint exits zero, the Next production build succeeds, no whitespace errors
exist, and only intentional handoff changes remain.

- [ ] **Step 2: Run related existing mobile regressions**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts e2e/reader-annotations.spec.ts e2e/accessibility-hardening.spec.ts e2e/reading-workspace.spec.ts --project=iphone-14 --workers=1 --retries=0 --trace=off
npx.cmd playwright test e2e/native-navigation.spec.ts e2e/reader-annotations.spec.ts e2e/accessibility-hardening.spec.ts e2e/reading-workspace.spec.ts --project=iphone-15-pro-max --workers=1 --retries=0 --trace=off
```

Expected: all selected browser tests pass. Preserve exact failure evidence and
do not classify a failure as unrelated without reproducing it against the
pre-change commit.

- [ ] **Step 3: Perform the physical iPhone follow-up when available**

On Safari and the installed home-screen PWA, verify keyboard avoidance,
selection → Ask AI → Workspace flow, background/foreground interruption,
large-message expansion/export, offline reload, VoiceOver labels, reduced
motion, and repeated cold/warm workspace opening. Record device/iOS version
and observed failures. If no physical device is available, state that this
gate remains unrun; Chromium does not substitute for it.

- [ ] **Step 4: Update the handoff with factual evidence**

Record:

- completed milestone and commit IDs;
- Dexie and backup schema versions;
- red/green focused-test commands;
- full Vitest/lint/build/audit results;
- Playwright profile results and retained metrics/screenshots;
- physical-device status;
- remaining deferred milestones or risks;
- the GPL clean-room boundary and absence of copied OpenMinis code.

- [ ] **Step 5: Commit the handoff**

```powershell
git add HANDOFF.md
git commit -m "docs: record reading workspace delivery"
```

- [ ] **Step 6: Confirm the final repository state**

```powershell
git status -sb
git log -8 --oneline --decorate
```

Do not push, merge another branch, deploy, or publish a release without fresh
explicit user authorization.

## Requirement Coverage Matrix

| Design requirement | Implementation task |
|---|---|
| Per-book default workspace with future multi-book ownership | Tasks 1–2 |
| Atomic deletion, clear, and restore lifecycle | Tasks 2–3 |
| Backup v3 with v1/v2 compatibility and privacy disclosure | Task 3 |
| No fourth root tab; book and reader entry to one surface | Task 4 |
| Persistent isolated sessions/messages | Task 5 |
| Stop, retry, paused/error persistence, normalized streaming | Task 6 |
| Tail pagination, stable scroll, Markdown, large-content fallback | Task 7 |
| Four bounded metadata-first reading Skills | Task 8 |
| Explicit semantic artifacts with local preview/export | Task 8 |
| Visible, opt-in, bounded, revocable workspace memory | Task 9 |
| Explicit summary anchored without deleting history | Task 9 |
| Offline, accessibility, themes, text scaling, reduced motion | Task 10 |
| Full repository and physical-device verification | Task 11 |

## Known Risks and Containment

- **Provider stream variance:** normalize three protocols behind fixture-tested
  decoders and keep raw provider bodies out of UI errors.
- **IndexedDB write amplification:** checkpoint active streams no more than
  once per second or per 4,000 new characters; always finalize once.
- **Backup growth:** retain a 1,000,000-character per-record restore ceiling,
  validate before replacement, and state clearly that conversations/passages
  are included.
- **Long-message rendering:** do not run Markdown parsing on an unbounded live
  buffer; tail-degrade at 8,000 and collapse frozen content above 32,000.
- **Navigation conflicts:** implement Workspace as an existing routed sheet,
  not a new root/navigation kind, and close the prior sheet before presenting
  it.
- **Context leakage:** derive every request from the active workspace/session
  identity and reject stale events on all four identity fields.
- **Memory surprise:** never activate memory from model output without a user
  review/save action; make revoke visible.
- **Scope expansion:** arbitrary Skills, tools, browser automation, shell,
  global Workspace index, and cloud sync remain separate future projects.
- **License contamination:** use official OpenMinis sources only as behavioral
  research and write independent MIT-compatible TypeScript/React code.
