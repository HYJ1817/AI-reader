# Reading Workspace Design

## Goal

Turn AI Reader's temporary “Ask AI” sheet into a local-first reading workspace
that persists per book, remains available after restarts, and gives the reader
one restrained place for conversations, notes, generated materials, and
explicit memory.

The first product surface remains book-first. A workspace is opened from a
book or from the reader; it does not become a fourth root tab. The underlying
data model must nevertheless support a later workspace that references more
than one book.

## Research Recheck

The OpenMinis sources were rechecked on 2026-07-28 against the official public
repositories.

- The public `main` branch was at commit
  [`9cf3a85`](https://github.com/OpenMinis/OpenMinis/commit/9cf3a855fecd27bb5735b84cacbd56852a3ab8dd)
  from 2026-07-25. The repository is a mirror of a private development tree,
  and the app is GPL-3.0.
- The [README](https://github.com/OpenMinis/OpenMinis) still defines
  workspaces as separate contexts addressable through `minis://workspace/`,
  with Skills loaded on demand and persistent memory across sessions.
- The [`minis://` specification](https://github.com/OpenMinis/OpenMinis/blob/main/docs/specs/minis-url-scheme.md)
  defines session-scoped resource isolation, persistence, typed namespaces,
  and deletion with the owning session. It is explicitly marked **Draft** and
  contains unchecked implementation items, so it is evidence of architecture
  direction rather than proof that every listed enhancement ships.
- The iOS [file browser](https://github.com/OpenMinis/OpenMinis/blob/main/src/ios/Views/Rootfs/FileBrowserView.swift)
  confirms a quiet list-first presentation with preview, export, sorting,
  destructive confirmation, and a single overflow menu. It is a general Linux
  filesystem browser, not a suitable information architecture to copy into a
  reading app.
- The iOS [session Skills](https://github.com/OpenMinis/OpenMinis/blob/main/src/ios/Views/Chat/SessionSkillsView.swift)
  and [session Memory](https://github.com/OpenMinis/OpenMinis/blob/main/src/ios/Views/Chat/SessionMemoryView.swift)
  views make active context visible and controllable instead of keeping it as
  invisible model state.
- The Android [large-content guard](https://github.com/OpenMinis/OpenMinis/blob/main/src/android/app/src/main/java/com/openminis/app/ui/chat/LargeContentGuard.kt),
  iOS [message-list implementation](https://github.com/OpenMinis/OpenMinis/tree/main/src/ios/Agent/MessageList),
  and [release notes](https://github.com/OpenMinis/OpenMinis/releases) confirm
  continued work on tail-window rendering, streaming coalescing, large-content
  fallbacks, persistent error state, and responsive composition.
- The [MinisSkills repository](https://github.com/OpenMinis/MinisSkills)
  confirms progressive disclosure: metadata is always available, the skill
  body loads only after activation, and optional resources load on demand.

### Confirmed Evidence Versus Product Interpretation

Confirmed OpenMinis behavior informs principles, not a direct port. AI
Reader's implementation choices below are product interpretations:

- OpenMinis isolates resources by agent session. AI Reader will isolate them
  by reading workspace and AI session.
- OpenMinis exposes filesystem paths and a custom URL scheme because a Linux
  sandbox and native host must share files. AI Reader will use typed IndexedDB
  records and opaque IDs because it is a PWA and does not need a virtual
  filesystem.
- OpenMinis exposes a general file browser. AI Reader will expose semantic
  reading materials such as summaries and timelines, while hiding storage
  paths.
- OpenMinis can let an agent write memory. AI Reader will require an explicit
  user action before a memory becomes active.
- OpenMinis supports a broad tool loop. AI Reader will begin with bounded,
  single-turn reading Skills and will not ship a general agent loop in this
  project.

No OpenMinis source will be copied. AI Reader is MIT-licensed while OpenMinis
is GPL-3.0; this design reimplements observed principles behind independently
defined TypeScript and React interfaces.

## Current AI Reader Baseline

AI Reader is a Next.js 16 / React 19 PWA using Dexie-backed IndexedDB. Books,
files, covers, reading positions, annotations, groups, reading statistics, and
the custom background are local and included in backup version 2.

The present AI path is intentionally small:

- `app/useAskAi.ts` owns selected text, draft input, transient messages,
  request cancellation, and `/api/chat` calls in React state.
- Switching or resetting a book discards the conversation.
- `app/AskAiPanel.tsx` renders plain text in a reader bottom sheet.
- `lib/aiChat.ts` sends at most the latest 20 history messages, truncates each
  to 3,000 characters, and sends visible or selected reading text.
- `app/api/chat/route.ts` waits for a complete provider response and returns
  one JSON answer.
- The root navigation is Library / Reading / Settings. The product brief
  rejects dashboard-heavy UI and asks that reading remain central.

The workspace design therefore extends existing local-first and navigation
contracts instead of adding an unrelated application shell.

## Chosen Product Direction

Use the approved progressive hybrid model:

1. Create a real workspace domain and persistence layer now.
2. Give each book one default workspace when it is first needed.
3. Open it from the book action sheet and from the reader's Ask AI sheet.
4. Present it as a near-full-height routed sheet on iPhone, using the existing
   navigation/history and sheet architecture.
5. Keep the root navigation unchanged.
6. Allow the data model to associate multiple books with one workspace so a
   later global workspace index does not require replacing stored records.

The default workspace is created lazily, not during book import. Readers who
never use AI pay no workspace initialization cost.

## Experience Architecture

### Compact Ask AI

The reader retains the current one-handed bottom sheet for fast questions.
It uses the active book's default workspace and most recent AI session rather
than a separate transient conversation.

The compact sheet contains:

- a selected-text preview with a clear action;
- the recent message tail;
- provider configuration guidance when AI is unavailable;
- a multiline composer, Send, Stop, retry, and error state;
- a header action labelled `阅读空间` that expands to the full workspace.

Closing the sheet never clears messages. Changing books switches to that
book's isolated workspace. An in-flight request remains tied to its original
book/session and cannot append into the newly opened book.

### Full Reading Workspace

The full surface is intentionally quiet:

- a compact title bar with the book title and Close;
- a two-choice segmented control: `对话` and `资料`;
- no hero dashboard, colorful shortcut grid, AI gradient, or exposed file
  path;
- a sticky, safe-area-aware composer on the conversation view;
- native list rows and restrained grouped sections on the materials view.

The conversation view provides a session menu for New Conversation and the
existing conversations for this workspace. Session switching is secondary UI,
not a permanent sidebar on iPhone.

The materials view groups content by reader meaning:

1. `标注` links to existing highlights and bookmarks without duplicating
   those records.
2. `AI 资料` lists explicitly saved summaries, explanations, outlines,
   timelines, and character notes.
3. `记忆` lists active and revoked workspace memory with its source and a
   visible remove/revoke action.

An artifact opens in a preview sheet with Copy, Export, Rename, and Delete in
an overflow menu. The default list is ordered by `updatedAt` descending. A
first release does not add folders, move/copy, sorting controls, hidden files,
or path breadcrumbs.

### Reading Skills

The first Skills are bundled prompt templates, not arbitrary code:

- `解释选中内容` — requires selected text;
- `翻译选中内容` — requires selected text and the user's current language;
- `总结当前内容` — uses the bounded nearby reading context;
- `提炼要点` — produces a concise structured result from nearby context.

Only name, description, required context, and output kind are loaded into the
surface. The full prompt is selected when the reader invokes the Skill. This
keeps the main chat prompt small and mirrors the useful part of OpenMinis'
progressive disclosure without implementing arbitrary `SKILL.md` execution.

Skill output first appears as a normal assistant answer. The reader must choose
`保存到资料` before it becomes an artifact. The system does not silently fill
the workspace with every response.

## Data Model

Dexie version 7 adds six focused tables. All IDs are opaque locally generated
IDs; UI code never derives ownership from an ID string.

```ts
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
  status: "idle" | "streaming" | "error" | "paused";
  summary?: string;
  summaryThroughMessageId?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMessageRecord = {
  id: string;
  workspaceId: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  state: "complete" | "streaming" | "error" | "cancelled";
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
  kind: "summary" | "explanation" | "outline" | "timeline" | "characters" | "note";
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
```

`WorkspaceContextSnapshot` stores only the context actually sent for a user
turn: book ID/title/format, selected text, bounded nearby text, optional reader
locator/progress, and capture time. It does not store the whole EPUB/TXT text.

Indexes support:

- workspace-book lookup by `bookId` and `[workspaceId+bookId]`;
- session ordering by `[workspaceId+updatedAt]`;
- message pagination by `[sessionId+createdAt]`;
- materials ordering by `[workspaceId+updatedAt]`;
- active-memory lookup by workspace and state.

### Ownership and Deletion

Deleting a book removes its workspace-book association in the same transaction
as the existing book data. A workspace and all its sessions, messages,
artifacts, and memory are deleted only when no book associations remain. This
is equivalent to cascading the default one-book workspace today and remains
safe for later multi-book workspaces.

`clearAllReaderData` clears every workspace table. Backup restore replaces all
workspace tables atomically with the other reader data.

### Backup Version 3

Backup version 3 contains the six workspace arrays. Version 1 and version 2
remain accepted and restore with empty workspace arrays. Validation rejects:

- duplicate primary IDs;
- workspace-book references to missing books or workspaces;
- sessions, messages, artifacts, or memories whose owner is absent;
- invalid roles, states, kinds, timestamps, or non-string content;
- oversized individual text records beyond the documented restore ceiling.

AI provider API keys remain excluded. Context snapshots and workspace memory
are included because they are user data; the export UI must state that the
backup can contain selected book passages and AI conversations.

## Conversation and Request Flow

1. Opening Ask AI resolves or lazily creates the default workspace and active
   session for the book.
2. Sending creates a complete user message and an empty assistant record in
   `streaming` state in one local transaction.
3. The request carries the provider configuration, bounded context snapshot,
   summary if present, and recent complete/cancelled history. Failed assistant
   messages are not sent back as history.
4. `/api/chat` normalizes OpenAI-compatible, Anthropic-compatible, and Gemini
   streaming responses into one application event format.
5. The hook updates visible text at a coalesced cadence. It checkpoints a
   partial response to IndexedDB no more than once per second and always saves
   the final state.
6. Stop aborts the request, preserves partial text, and marks the message
   `cancelled`. A network/provider failure preserves the error and retry action
   across reloads.
7. Retry creates a new assistant attempt from the same user turn rather than
   mutating history invisibly.
8. Switching book or session aborts only the view-owned request and rejects
   stale events by workspace/session/message ID.

The normalized client event contract is deliberately small:

```ts
type WorkspaceStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
```

## Long Conversation and Rendering Policy

The complete conversation remains stored. Rendering and inference use bounded
views of it.

- Load the most recent 100 messages initially and load 50 older messages per
  request from the top.
- Do not force auto-scroll while the reader is browsing older content.
- Coalesce live UI updates to at most one per animation frame and provider
  chunks to a lower background cadence when away from the bottom.
- Render active streaming text as plain pre-wrapped text. After completion,
  render Markdown once.
- Above 8,000 live characters, show a bounded 4,000-character plain-text tail.
- Above 32,000 completed characters, show an 8,000-character preview with
  Expand and Export. Expansion is explicit and reversible.
- Cache or memoize completed Markdown by message ID plus `updatedAt`, not by
  an unbounded global message count.

For inference, keep full local history but send the session summary plus the
latest 20 usable messages. The existing 3,000-character per-message and
6,000-character reading-context ceilings remain until provider-aware context
budgets are separately designed and tested.

Compaction is a later milestone within this project. It inserts a persisted
summary and an anchor message ID; it does not delete the underlying messages.
The first compaction UI is explicit, not silently automatic.

## Memory Policy

Memory is scoped to a reading workspace. There is no cross-book global memory
in the first project.

- The assistant may suggest a memory candidate, but it becomes active only
  after the reader taps Save.
- Active memory is visible in `资料 > 记忆` and can be revoked.
- Revocation retains an audit record but excludes the item from prompts.
- Prompt injection includes at most 20 active items and 4,000 characters.
- Memory is labelled background context. The latest user request and current
  selected passage always take precedence.
- A memory is never treated as an authorization to browse, upload, delete, or
  change unrelated reader data.

## Error Handling and Offline Behavior

- Workspace creation, session creation, and the initial message pair are local
  transactions. A failed transaction sends no network request.
- IndexedDB-unavailable and quota errors produce a local persistence error;
  the UI does not claim a conversation was saved.
- Offline, prior conversations and materials remain readable. Send is disabled
  with a concise network status while local notes and exports remain usable.
- Provider errors are sanitized by the server and stored as user-readable
  message error state without API keys, response headers, or arbitrary
  upstream bodies.
- Restoring a backup is all-or-nothing. Invalid workspace references fail
  validation before existing data is replaced.
- Large outputs do not create a separate hidden “offloads” filesystem. The
  message record remains authoritative and export streams content on demand.

## Accessibility and Motion

- All tabs, Skills, session actions, message actions, Save to Materials, Stop,
  retry, expand, export, and revoke actions are native buttons with labels.
- The segmented control exposes selected state and does not rely on color.
- Streaming uses `aria-busy`; status/error changes use polite status and alert
  regions without announcing every token.
- The composer remains reachable above the software keyboard and supports
  multiline text and composition-safe Enter handling.
- Reduced motion removes message entrance and sheet expansion movement while
  preserving state transitions and focus.
- Light, dark, sepia, system-dark, 200% text, VoiceOver labels, safe areas, and
  horizontal overflow are explicit browser/device verification targets.

## Delivery Milestones

1. **Workspace foundation:** Dexie v7, repositories, cascade semantics,
   backup v3, and focused data tests.
2. **Workspace shell and persistence:** routed full sheet, book/reader entry
   points, persistent sessions/messages, existing non-streaming API retained.
3. **Streaming and long-content resilience:** normalized stream transport,
   Stop/retry/persisted errors, pagination, Markdown completion rendering, and
   large-content guard.
4. **Skills and artifacts:** four bounded reading Skills, explicit Save to
   Materials, preview/export/rename/delete.
5. **Visible memory and compaction:** opt-in scoped memory, revoke, bounded
   injection, explicit anchored session summary.
6. **Hardening:** backup round trips, deletion/restoration, offline/quota
   states, accessibility, browser regressions, full repository gates, and
   physical iPhone follow-up.

Every milestone leaves working, testable software. Later milestones may be
deferred without corrupting or hiding data created by earlier milestones.

## Acceptance Criteria

1. A book's Ask AI history survives sheet closure, app reload, and switching
   to another book.
2. Different books cannot see each other's sessions, messages, artifacts, or
   memory.
3. The book action sheet and reader Ask AI sheet open the same default
   workspace without adding a root tab.
4. Backup v3 round-trips all workspace data, while v1/v2 remain restorable.
5. Deleting the last associated book removes its workspace data; deleting one
   association from a multi-book workspace preserves the remaining workspace.
6. Stop, retry, provider error, and interrupted partial content remain truthful
   after reload.
7. Long sessions initially render a bounded tail and load older messages on
   demand without jumping a reader who is away from the bottom.
8. A large live answer keeps the composer responsive and a completed answer
   can be expanded or exported without silently truncating stored content.
9. Skills use only declared reading context, and artifacts are created only
   after an explicit save.
10. Memory is visible, opt-in, workspace-scoped, bounded, and revocable.
11. Existing EPUB/TXT reading, annotations, provider configuration,
    navigation history, local backup, and reduced-motion behavior continue to
    pass their regressions.

## Non-Goals

- No fourth root Workspace tab in the first project.
- No Linux shell, PRoot/iSH sandbox, arbitrary package installation, or native
  offload layer.
- No browser automation or in-app arbitrary web browser; that remains deferred
  by `ROADMAP.md` until a native iOS shell and device workflow exist.
- No arbitrary imported `SKILL.md`, scripts, MCP servers, scheduled tasks, or
  general-purpose agent loop.
- No global cross-book memory, automatic memory writes, vector database, cloud
  sync, collaboration, or account system.
- No exposed virtual folders or custom URL scheme in the PWA.
- No copying GPL-licensed OpenMinis implementation code.
- No production deployment or branch publication without explicit user
  authorization.
