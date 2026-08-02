# AI Reader Closed-Grade Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicate empty-state actions, add clear recovery and save-readiness feedback, enforce mobile touch targets, and quiet a small set of copy and glyph inconsistencies without changing product architecture or persisted data.

**Architecture:** Keep orchestration in `app/page.tsx`, presentation branching in the existing surface components, and extract only provider draft validation into a pure library helper shared by button state, helper copy, and submit validation. Reuse existing CSS tokens and motion roles; introduce a tiny local SVG glyph module rather than a dependency or general icon framework.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Motion, Vitest, Playwright, OpenNext for Cloudflare Workers.

---

### Task 1: Provider Draft Requirements

**Files:**
- Create: `lib/aiProviderDraftRequirements.ts`
- Create: `lib/aiProviderDraftRequirements.test.ts`
- Modify: `app/AiSettingsSurface.tsx`

- [x] **Step 1: Write the failing pure-function tests**

Create `lib/aiProviderDraftRequirements.test.ts` with cases for complete drafts, one/two/many missing values, and model-specific guidance:

```ts
import { describe, expect, it } from "vitest";
import {
  getAiProviderDraftRequirements,
  getAiProviderSaveHint,
} from "./aiProviderDraftRequirements";

const complete = {
  protocol: "openai-chat",
  label: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-test",
};

describe("AI provider draft requirements", () => {
  it("returns no requirements for a complete draft", () => {
    expect(getAiProviderDraftRequirements(complete)).toEqual([]);
    expect(getAiProviderSaveHint(complete)).toBe("");
  });

  it("names one and two missing fields", () => {
    expect(getAiProviderSaveHint({ ...complete, apiKey: "" })).toBe(
      "填写 API Key 后即可保存"
    );
    expect(
      getAiProviderSaveHint({ ...complete, label: "", baseUrl: "" })
    ).toBe("填写名称和 API 地址后即可保存");
  });

  it("collapses three or more missing fields", () => {
    expect(
      getAiProviderSaveHint({
        ...complete,
        label: "",
        baseUrl: "",
        apiKey: "",
      })
    ).toBe("请完成必填信息后保存");
  });

  it("gives actionable guidance when only the model is missing", () => {
    expect(getAiProviderSaveHint({ ...complete, model: "" })).toBe(
      "刷新模型，或手动添加模型后即可保存"
    );
  });
});
```

- [x] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- --run lib/aiProviderDraftRequirements.test.ts
```

Expected: FAIL because `lib/aiProviderDraftRequirements.ts` does not exist.

- [x] **Step 3: Implement the pure requirement helper**

Create `lib/aiProviderDraftRequirements.ts` with a structural draft type, ordered labels, whitespace trimming, and the exact hint rules from the design:

```ts
export type AiProviderDraftRequirementInput = {
  protocol: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

const REQUIREMENTS = [
  ["protocol", "服务商类型"],
  ["label", "名称"],
  ["baseUrl", "API 地址"],
  ["apiKey", "API Key"],
  ["model", "模型"],
] as const;

export function getAiProviderDraftRequirements(
  draft: AiProviderDraftRequirementInput | null
): string[] {
  if (!draft) return REQUIREMENTS.map(([, label]) => label);
  return REQUIREMENTS.filter(([key]) => !draft[key].trim()).map(
    ([, label]) => label
  );
}

export function getAiProviderSaveHint(
  draft: AiProviderDraftRequirementInput | null
): string {
  const missing = getAiProviderDraftRequirements(draft);
  if (missing.length === 0) return "";
  if (missing.length === 1 && missing[0] === "模型") {
    return "刷新模型，或手动添加模型后即可保存";
  }
  if (missing.length === 1) {
    const spacing = /^[A-Z]/.test(missing[0]) ? " " : "";
    return `填写${spacing}${missing[0]} 后即可保存`;
  }
  if (missing.length === 2) {
    return `填写${missing[0]}和 ${missing[1]}后即可保存`;
  }
  return "请完成必填信息后保存";
}
```

- [x] **Step 4: Run the helper tests and verify GREEN**

Run the focused test command from Step 2. Expected: 4 tests pass.

- [x] **Step 5: Add failing provider-surface contract assertions**

Extend `lib/aiProviderListIntegration.test.ts` to require:

```ts
expect(surface).toContain("getAiProviderDraftRequirements(draft)");
expect(surface).toContain("getAiProviderSaveHint(draft)");
expect(surface).toContain('id="provider-save-requirements"');
expect(surface).toContain('aria-describedby={');
expect(surface).toContain("missingRequirements.length === 0");
```

Run:

```powershell
npm.cmd test -- --run lib/aiProviderListIntegration.test.ts
```

Expected: FAIL because the surface still has inline `canSave` logic and no helper text.

- [x] **Step 6: Wire the helper into configuration save**

In `app/AiSettingsSurface.tsx`:

- import both helper functions;
- derive `missingRequirements`, `saveHint`, and `canSave` from the draft;
- guard `saveDraft` with `getAiProviderDraftRequirements(draft).length > 0`;
- render `saveHint` above the sticky button with `id="provider-save-requirements"`;
- set the button's `aria-describedby` only while a hint exists.

Use this sticky action structure:

```tsx
<div className={styles.providerStickyActions} data-provider-sticky-actions="true">
  {saveHint ? (
    <p id="provider-save-requirements" className={styles.providerSaveHint}>
      {saveHint}
    </p>
  ) : null}
  <button
    type="button"
    className={styles.providerPrimaryButton}
    onClick={saveDraft}
    disabled={!canSave}
    aria-describedby={saveHint ? "provider-save-requirements" : undefined}
  >
    保存并使用
  </button>
</div>
```

Add `.providerSaveHint` beside the existing sticky-action CSS using `--text-secondary`, the caption token, centered text, and no error color.

- [x] **Step 7: Run focused tests and commit**

Run:

```powershell
npm.cmd test -- --run lib/aiProviderDraftRequirements.test.ts lib/aiProviderListIntegration.test.ts
git diff --check
```

Expected: all focused tests pass and diff check exits 0.

Commit only Task 1 files:

```powershell
git add lib/aiProviderDraftRequirements.ts lib/aiProviderDraftRequirements.test.ts lib/aiProviderListIntegration.test.ts app/AiSettingsSurface.tsx app/page.module.css
git commit -m "polish: explain provider save requirements"
```

### Task 2: Library Empty and Recovery States

**Files:**
- Create: `lib/libraryEmptyRecoveryIntegration.test.ts`
- Modify: `app/LibrarySurface.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/uiText.ts`
- Modify: `app/page.module.css`

- [x] **Step 1: Write failing library state contracts**

Create `lib/libraryEmptyRecoveryIntegration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surface = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const copy = readFileSync(new URL("./uiText.ts", import.meta.url), "utf8");
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("library empty and recovery states", () => {
  it("shows only the central import action for an empty library", () => {
    expect(surface).toContain("books.length > 0 && !editing.library");
    expect(surface).toContain("UI_TEXT.LOCAL_STORAGE_ONLY");
    expect(surface).toContain("UI_TEXT.IMPORT_BOOKS");
  });

  it("announces import errors and offers a retry label", () => {
    expect(surface).toContain('role="alert"');
    expect(surface).toContain("UI_TEXT.RESELECT_FILE");
  });

  it("recovers search and collection empty states one condition at a time", () => {
    expect(surface).toContain("actions.showAllBooks");
    expect(surface).toContain("UI_TEXT.CLEAR_SEARCH");
    expect(surface).toContain("UI_TEXT.VIEW_ALL_BOOKS");
    expect(page).toContain("showAllBooks: () => setGroupFilter(null)");
  });

  it("keeps primary touch targets at least 44px high", () => {
    expect(css).toMatch(/\.primaryButton\s*\{[^}]*min-height:\s*44px/s);
  });

  it("defines safe user-facing import errors", () => {
    expect(copy).toContain("ERROR_LOCAL_STORAGE_UNAVAILABLE");
    expect(copy).toContain("ERROR_STORAGE_FULL");
    expect(copy).toContain("ERROR_INVALID_BOOK_FILE");
  });
});
```

- [x] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- --run lib/libraryEmptyRecoveryIntegration.test.ts
```

Expected: FAIL on the new empty/recovery contracts.

- [x] **Step 3: Implement presentation actions and copy**

In `LibrarySurface`:

- add `showAllBooks: () => void` to `actions`;
- show the header import button only for `books.length > 0 && !editing.library`;
- give `importError` `role="alert"`;
- add `UI_TEXT.LOCAL_STORAGE_ONLY` before the empty-state button;
- use `UI_TEXT.IMPORT_BOOKS` normally and `UI_TEXT.RESELECT_FILE` after an error;
- when filtered count is zero, show `清除搜索` if a trimmed query exists, otherwise show `查看全部图书` if `groupFilter !== null`.

In `page.tsx`, pass:

```ts
showAllBooks: () => setGroupFilter(null),
```

Add the exact copy constants in `uiText.ts`:

```ts
CLEAR_SEARCH: "清除搜索",
VIEW_ALL_BOOKS: "查看全部图书",
RESELECT_FILE: "重新选择文件",
EMPTY_COLLECTION: "这个分组还没有图书",
ERROR_LOCAL_STORAGE_UNAVAILABLE: "无法使用本地存储。请退出无痕模式或检查 Safari 设置后重试。",
ERROR_STORAGE_FULL: "本机可用空间不足。请释放空间后重试。",
ERROR_INVALID_BOOK_FILE: "无法读取这本书。请确认文件完整且格式为 EPUB 或 TXT。",
```

Add `min-height: 44px` to `.primaryButton`. Add only a quiet `.emptyPrivacyText`/`.emptyRecoveryButton` style if existing typography/button classes cannot express the required hierarchy.

- [x] **Step 4: Add safe import error classification test**

Before changing `page.tsx` error handling, add `lib/bookImportError.test.ts` for a new pure helper:

```ts
import { describe, expect, it } from "vitest";
import { getBookImportErrorMessage } from "./bookImportError";

describe("book import error copy", () => {
  it("classifies unavailable storage", () => {
    expect(getBookImportErrorMessage(new Error("indexeddb-unavailable"))).toContain(
      "本地存储"
    );
  });

  it("classifies quota errors without exposing internals", () => {
    const error = new DOMException("secret path", "QuotaExceededError");
    const message = getBookImportErrorMessage(error);
    expect(message).toContain("空间不足");
    expect(message).not.toContain("secret path");
  });

  it("uses a safe parse fallback", () => {
    expect(getBookImportErrorMessage(new Error("zip stack trace"))).toContain(
      "EPUB 或 TXT"
    );
  });
});
```

Run the focused test and verify it fails because the helper is absent.

- [x] **Step 5: Implement safe import error classification**

Create `lib/bookImportError.ts` without returning raw exception messages:

```ts
import { UI_TEXT } from "./uiText";

export function getBookImportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "indexeddb-unavailable") {
    return UI_TEXT.ERROR_LOCAL_STORAGE_UNAVAILABLE;
  }
  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return UI_TEXT.ERROR_STORAGE_FULL;
  }
  return UI_TEXT.ERROR_INVALID_BOOK_FILE;
}
```

Update `handleImport` so the unsupported branch calls
`getBookImportErrorMessage(new Error("indexeddb-unavailable"))` and the catch
block calls `getBookImportErrorMessage(err)`.

- [x] **Step 6: Run focused tests and commit**

Run:

```powershell
npm.cmd test -- --run lib/libraryEmptyRecoveryIntegration.test.ts lib/bookImportError.test.ts lib/libraryBookFirst.test.ts lib/readerChromeIntegration.test.ts
git diff --check
```

Expected: all focused tests pass and existing library/import contracts remain green.

Commit only Task 2 files:

```powershell
git add lib/libraryEmptyRecoveryIntegration.test.ts lib/bookImportError.ts lib/bookImportError.test.ts app/LibrarySurface.tsx app/page.tsx lib/uiText.ts app/page.module.css
git commit -m "polish: make library empty states recoverable"
```

### Task 3: Provider Empty-State Action Hierarchy

**Files:**
- Modify: `lib/aiProviderListIntegration.test.ts`
- Modify: `app/AiSettingsSurface.tsx`
- Modify: `app/page.module.css`

- [x] **Step 1: Write failing empty-state provider assertions**

Add assertions that the surface derives `hasProviders`, conditionally renders header actions, exposes an inline import control, and resets edit/menu state when the list becomes empty:

```ts
expect(surface).toContain("const hasProviders = settings.providers.length > 0");
expect(surface).toContain("hasProviders ? (");
expect(surface).toContain('data-provider-empty-import="true"');
expect(surface).toContain("setProviderListEditing(false)");
expect(surface).toContain("setAddMenuOpen(false)");
```

Run the provider list integration test. Expected: FAIL because the empty-state toolbar still renders.

- [x] **Step 2: Implement the empty-state hierarchy**

In `AiSettingsSurface`:

- derive `hasProviders`;
- use an effect keyed by `hasProviders` to close editing/menu state when false;
- render header `编辑` and `+` menu only when `hasProviders`;
- retain the full-width `添加 AI 服务商` primary button;
- when empty, render a text-style `导入服务商配置` button that triggers the existing hidden input;
- keep import status and privacy copy in both states.

Add `.providerEmptyImportButton` with at least 44px height, tint text, transparent background, and no shadow.

- [x] **Step 3: Run focused tests and commit**

Run:

```powershell
npm.cmd test -- --run lib/aiProviderListIntegration.test.ts lib/aiProviderIntegration.test.ts
git diff --check
```

Expected: focused tests pass.

Commit:

```powershell
git add lib/aiProviderListIntegration.test.ts app/AiSettingsSurface.tsx app/page.module.css
git commit -m "polish: simplify empty provider actions"
```

### Task 4: Quiet Copy and Local SVG Glyphs

**Files:**
- Create: `app/UiGlyphs.tsx`
- Create: `lib/detailPolishCopyAndIcons.test.ts`
- Modify: `app/AiSettingsSurface.tsx`
- Modify: `app/ReadingWorkspaceSheet.tsx`
- Modify: `app/ReadingGoalSheet.tsx`
- Modify: `lib/uiText.ts`
- Modify: `app/page.module.css`

- [x] **Step 1: Write failing copy and glyph contracts**

Create `lib/detailPolishCopyAndIcons.test.ts` to assert:

```ts
expect(goal).toContain("今日已阅读 {todayMinutes} 分钟".replace("{todayMinutes}", "${todayMinutes}"));
expect(goal).not.toContain("继续保持阅读节奏");
expect(goal).not.toContain("你正朝着每日目标奋进");
expect(copy).toContain("设置每日阅读时长，进度仅保存在本机。");
expect(provider).toContain("<AddIcon");
expect(provider).toContain("<ImportIcon");
expect(provider).toContain("<ChevronRightIcon");
expect(provider).toContain("<CheckIcon");
expect(workspace).toContain("<MoreHorizontalIcon");
expect(provider).not.toContain('<span aria-hidden="true">↥</span>');
expect(workspace).not.toContain("•••");
```

Run the new test. Expected: FAIL on old copy and character glyphs.

- [x] **Step 2: Create the minimal SVG glyph module**

Create `app/UiGlyphs.tsx` with no external assets:

```tsx
type GlyphProps = { className?: string };

function Glyph({ className, children }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function AddIcon(props: GlyphProps) {
  return <Glyph {...props}><path d="M12 5v14M5 12h14" /></Glyph>;
}

export function ImportIcon(props: GlyphProps) {
  return <Glyph {...props}><path d="M12 15V4m0 0-4 4m4-4 4 4M5 14v5h14v-5" /></Glyph>;
}

export function ChevronRightIcon(props: GlyphProps) {
  return <Glyph {...props}><path d="m9 5 7 7-7 7" /></Glyph>;
}

export function CheckIcon(props: GlyphProps) {
  return <Glyph {...props}><path d="m5 12 4 4L19 6" /></Glyph>;
}

export function MoreHorizontalIcon(props: GlyphProps) {
  return <Glyph {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Glyph>;
}
```

- [x] **Step 3: Replace only approved character glyphs**

Use the new components for provider header/menu add, provider import, provider row chevron, provider preset/model checks, and workspace session menu. Do not change unrelated reader-setting checkmarks or library icons in this task.

Replace the goal status paragraph with:

```tsx
<p className={styles.goalStatus}>今日已阅读 {todayMinutes} 分钟</p>
```

Update `UI_TEXT.READING_GOAL_SUBTITLE` to `设置每日阅读时长，进度仅保存在本机。`.

Add only small glyph sizing/alignment rules where inherited SVG dimensions are insufficient.

- [x] **Step 4: Run focused tests and commit**

Run:

```powershell
npm.cmd test -- --run lib/detailPolishCopyAndIcons.test.ts lib/readingGoalOverlayIntegration.test.ts lib/aiProviderListIntegration.test.ts lib/readingWorkspaceSheetIntegration.test.ts
git diff --check
```

Expected: all focused tests pass.

Commit:

```powershell
git add app/UiGlyphs.tsx lib/detailPolishCopyAndIcons.test.ts app/AiSettingsSurface.tsx app/ReadingWorkspaceSheet.tsx app/ReadingGoalSheet.tsx lib/uiText.ts app/page.module.css
git commit -m "polish: quiet copy and unify utility glyphs"
```

### Task 5: Full Verification and Design Documentation

**Files:**
- Add: `docs/superpowers/specs/2026-08-02-closed-grade-detail-polish-design.md`
- Add: `docs/superpowers/plans/2026-08-02-closed-grade-detail-polish.md`

- [x] **Step 1: Run full local verification**

Run:

```powershell
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
git diff --check
```

Expected: every command exits 0. If an existing E2E expectation conflicts with the approved new behavior, update only that expectation and rerun the exact failing project.

- [x] **Step 2: Review the complete diff against the design**

Confirm:

- no settings switch hints returned;
- no reader control architecture changed;
- no IndexedDB/provider/backup schema changed;
- only the approved empty states, validation, touch target, copy, and glyphs changed;
- all untracked/modified files belong to this work.

- [x] **Step 3: Commit the design and plan**

```powershell
git add docs/superpowers/specs/2026-08-02-closed-grade-detail-polish-design.md docs/superpowers/plans/2026-08-02-closed-grade-detail-polish.md
git commit -m "docs: specify closed-grade detail polish"
```

### Task 6: Deploy, Smoke Test, Handoff, and Push

**Files:**
- Modify: `HANDOFF.md`

- [x] **Step 1: Build and deploy through the established OpenNext sequence**

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected: Cloudflare publishes a new `ai-reader-pwa` Worker version for `881817.xyz/*`.

- [x] **Step 2: Smoke test production**

Verify `https://881817.xyz/` returns 200, discover the current JS/CSS asset URLs from the HTML, verify each returns 200, and check the empty-library/provider DOM at an iPhone-sized viewport without importing user data.

- [x] **Step 3: Update handoff with exact deployment evidence**

Append the implemented scope, verification counts, commit IDs, Worker version, production smoke results, and any remaining physical-iPhone limitation to `HANDOFF.md`. Preserve existing history and instructions.

- [ ] **Step 4: Commit handoff and rerun final repository checks**

```powershell
git add HANDOFF.md
git commit -m "docs: record detail polish deployment"
npm.cmd test -- --run
npm.cmd run lint
npm.cmd run build
git diff --check
git status -sb
```

Expected: tests, lint, build, and diff check exit 0; worktree is clean before push.

- [ ] **Step 5: Confirm GitHub prerequisites and push**

```powershell
gh --version
gh auth status
git push -u origin feat/pwa-interaction-fluidity
```

Expected: authenticated GitHub CLI and `origin/feat/pwa-interaction-fluidity` advances to the final handoff commit. Do not create a duplicate PR if one already exists; report the existing PR or branch URL.
