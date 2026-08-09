# Dark Reader Black Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the complete reading interface on pure black in effective dark mode while preserving Light, Sepia, media content, and all non-reader application surfaces.

**Architecture:** Introduce a reader-scoped `--reader-canvas-background` theme token whose effective value is transparent outside dark reading and `#000000` in explicit or system dark. Pass that computed token through the existing EPUB preference and canvas-helper paths so the host, epub.js view layers, iframe document, publisher elements, and newly rendered chapters use one policy.

**Tech Stack:** React 19, TypeScript, CSS Modules/global theme tokens, epub.js, Vitest, Playwright, Git/GitHub CLI.

---

### Task 1: Lock the effective canvas contract

**Files:**
- Modify: `lib/epubReaderPreferences.test.ts`
- Modify: `lib/epubAmbientCanvas.test.ts`
- Modify: `lib/epubAmbientIntegration.test.ts`

- [ ] **Step 1: Add failing EPUB theme tests**

Add assertions that dark preferences with `{ background: "#000000" }` register `#000000 !important` on `html, body`, `body`, non-media descendants, and pseudo-elements. Retain a separate Light assertion requiring `transparent !important`.

```ts
expect(rules?.["html, body"]).toMatchObject({
  background: "#000000 !important",
  "background-color": "#000000 !important",
});
expect(rules?.["body *:not(img):not(svg):not(video):not(canvas):not(picture)"])
  .toMatchObject({ background: "#000000 !important" });
```

- [ ] **Step 2: Add failing canvas-helper tests**

Call both helpers with `"#000000"` and require root/view/non-media layers to receive black while media nodes remain untouched. Keep the current default-transparent and null-safety tests.

```ts
applyEpubAmbientCanvas({ document }, "#000000");
applyEpubViewTransparency(view, "#000000");
expect(document.documentElement.style.setProperty)
  .toHaveBeenCalledWith("background", "#000000", "important");
expect(image.style.setProperty).not.toHaveBeenCalled();
```

- [ ] **Step 3: Add failing integration contracts**

Require a reader-scoped `--reader-canvas-background`, pure-black explicit and system-dark values, host-layer use of the token, and propagation from `EpubReader` into both existing canvas helpers. Also require Light and Sepia to set the token back to transparent.

- [ ] **Step 4: Run the focused RED suite**

Run:

```powershell
npm.cmd test -- lib/epubReaderPreferences.test.ts lib/epubAmbientCanvas.test.ts lib/epubAmbientIntegration.test.ts
```

Expected: failures describing the missing black canvas token and helper arguments.

- [ ] **Step 5: Commit the RED tests**

```powershell
git add -- lib/epubReaderPreferences.test.ts lib/epubAmbientCanvas.test.ts lib/epubAmbientIntegration.test.ts
git commit -m "test: define dark reader black canvas"
```

### Task 2: Implement one reader canvas policy

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Modify: `lib/epubReaderPreferences.ts`
- Modify: `lib/epubAmbientCanvas.ts`
- Modify: `app/EpubReader.tsx`

- [ ] **Step 1: Add the reader-scoped theme token**

Declare transparent by default, black in system dark, transparent in explicit Light/Sepia, and black in explicit Dark.

```css
:root { --reader-canvas-background: transparent; }
@media (prefers-color-scheme: dark) {
  :root { --reader-canvas-background: #000000; }
}
[data-reader-theme="light"],
[data-reader-theme="sepia"] { --reader-canvas-background: transparent; }
[data-reader-theme="dark"] { --reader-canvas-background: #000000; }
```

- [ ] **Step 2: Apply the token to reader host layers**

Use `background: var(--reader-canvas-background)` for `.readerPresentationContent`, `.readerShell`, `.readerStage`, `.epubReaderViewport`, epub.js container/view, and iframe. Do not modify global cards, sheets, Dock, Library, Settings, or dashboard selectors.

- [ ] **Step 3: Generalize the EPUB canvas helpers**

Keep their current default behavior but accept a canvas background parameter.

```ts
export function applyEpubAmbientCanvas(
  contents: unknown,
  canvasBackground = "transparent"
): void

export function applyEpubViewTransparency(
  view: unknown,
  canvasBackground = "transparent"
): void
```

Set `background` and `background-color` to that value for host/document/non-media layers, retain media exclusions, and keep `allowtransparency="true"` for compatibility.

- [ ] **Step 4: Use the computed canvas token in EPUB themes**

Read `--reader-canvas-background` in `getThemeColors`, pass it as `colors.background`, and use that exact value for EPUB root, body, non-media, and pseudo-element background rules. The existing theme signature will force re-registration when system appearance changes.

- [ ] **Step 5: Propagate the canvas value to already-rendered and future views**

Pass the current computed canvas background to `applyEpubAmbientCanvas` and `applyEpubViewTransparency` in the rendered callback, initial contents pass, and preference/system-theme effect. Ensure callback dependencies update without re-creating the book for an appearance change.

- [ ] **Step 6: Run the focused GREEN suite**

Run:

```powershell
npm.cmd test -- lib/epubReaderPreferences.test.ts lib/epubAmbientCanvas.test.ts lib/epubAmbientIntegration.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 7: Commit the implementation**

```powershell
git add -- app/globals.css app/page.module.css app/EpubReader.tsx lib/epubReaderPreferences.ts lib/epubAmbientCanvas.ts
git commit -m "fix: use pure black reader canvas in dark mode"
```

### Task 3: Verify the product candidate and update the handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the required repository gates**

Verify local port `3097` is unused, then use the repository's
production-managed Playwright server:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
if (Get-NetTCPConnection -LocalPort 3097 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 3097 is in use' }
$env:PLAYWRIGHT_BASE_URL='http://localhost:3097'
npx.cmd playwright test e2e/native-navigation.spec.ts --workers=1 --retries=0 --trace=off
Remove-Item Env:PLAYWRIGHT_BASE_URL
git diff --check
git status -sb
```

Expected: Vitest, lint, build, and navigation tests exit 0; the diff check is clean. Record any failure exactly instead of replacing or hiding it.

- [ ] **Step 2: Update the authoritative handoff**

Add a dated section recording the pure-black reader policy, exact commits, exact verification counts, PR status, and the explicit exclusions of physical-device/PWA and APK checks. Remove the old dark-transparent EPUB issue from the current unresolved-caution wording without deleting its historical record.

- [ ] **Step 3: Commit the verification record**

```powershell
git add -- HANDOFF.md
git commit -m "docs: record dark reader black canvas verification"
```

### Task 4: Publish, merge, and reconcile GitHub

**Files:**
- Modify through GitHub: PR #5 body/state, issue state/labels, and repository metadata only where the audit finds stale current-state information.
- Modify locally only if needed: `README.md`, then rerun Task 3 gates before publishing.

- [ ] **Step 1: Audit the repository and PR**

Inspect PR #5 title/body, draft state, reviews, checks, mergeability, open issues, labels, milestones, repository description/homepage/topics, README badges/current screenshots, release list, default branch, and branch protection without changing unrelated product scope.

- [ ] **Step 2: Reconcile mature-project metadata**

Update stale PR text and only evidence-backed repository metadata. Close or update issues whose tracked defects are resolved by the merged change; retain genuine device-validation issues if still applicable but do not treat them as this change's acceptance gate. Do not invent releases, milestones, badges, or claims.

- [ ] **Step 3: Push and wait for checks**

```powershell
git push origin feat/pwa-interaction-fluidity
gh pr checks 5 --watch
```

Expected: every required check passes on the pushed head.

- [ ] **Step 4: Merge PR #5 normally**

Mark the PR ready if it remains a draft, then perform a regular merge to preserve the documented commit history. Do not force-push, reset, clean, or deploy production.

```powershell
gh pr ready 5
gh pr merge 5 --merge
```

- [ ] **Step 5: Verify the merged GitHub state**

Confirm PR #5 is merged, `origin/main` contains the merge, required checks are green, repository metadata is coherent, and the feature worktree has no uncommitted changes. Preserve the worktree unless safe cleanup is separately warranted.
