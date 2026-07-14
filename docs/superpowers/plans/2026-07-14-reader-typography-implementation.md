# Reader Typography and Unobstructed Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove forced TXT justification and replace the obstructive reader menu bubble with a reliable but visually quiet edge affordance, then verify the result across text scripts, reading modes, iPhone viewports, and production.

**Architecture:** Keep `ReaderPreferences` and EPUB behavior unchanged. Make `ReadingSession` apply an explicit `start | justify` TXT alignment, and make `ReaderControls` expose collapsed versus expanded styling on the existing single 48px button. Lock the behavior with source-contract tests and real-browser computed-style and screenshot coverage.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Motion, Vitest, Playwright, OpenNext for Cloudflare Workers.

**Execution:** Inline execution is pre-authorized by the user. Do not pause for an execution-mode choice or intermediate design approval.

---

## File Structure

- Create `lib/readerTypography.test.ts`: focused source contract for alignment fallback, explicit preference branch, semantic paragraphs, and final-content clearance.
- Modify `lib/readerMenuIntegration.test.ts`: lock the single-button state classes, 48px target, quiet collapsed material, and expanded state.
- Create `e2e/reader-typography.spec.ts`: import English, Chinese, and mixed TXT samples, assert computed alignment and button geometry, and emit iPhone screenshots.
- Modify `app/ReadingSession.tsx`: apply explicit TXT alignment, expose a stable test locator, and add final-content clearance.
- Modify `app/ReaderControls.tsx`: derive collapsed/expanded visual classes from the existing `visible` prop.
- Modify `app/page.module.css`: remove unconditional paragraph justification and implement the edge affordance without shrinking its hit target.
- Modify `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md`: add E2E coverage to the Phase 1 file map and check items only after evidence exists.
- Modify `HANDOFF.md`: record the deployed commit, Worker version, verification evidence, and remaining real-device risk.

## Task 1: Add failing typography and menu regression coverage

**Files:**

- Create: `lib/readerTypography.test.ts`
- Modify: `lib/readerMenuIntegration.test.ts`
- Create: `e2e/reader-typography.spec.ts`

- [ ] **Step 1: Create the failing TXT typography contract test**

Create `lib/readerTypography.test.ts` with helpers that extract a CSS rule and the inline style block, then assert the approved behavior:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssRule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

describe("TXT reader typography", () => {
  it("uses start alignment unless the explicit justify preference is enabled", () => {
    const paragraphRule = cssRule(".paragraph");

    expect(paragraphRule).toContain("text-align: start");
    expect(paragraphRule).not.toContain("text-align: justify");
    expect(sessionSource).toMatch(
      /preferences\.customLayoutEnabled\s*&&\s*preferences\.justifyText[\s\S]*\?\s*"justify"[\s\S]*:\s*"start"/
    );
  });

  it("keeps imported text as semantic paragraphs without script heuristics", () => {
    expect(sessionSource).toContain("<p");
    expect(sessionSource).toContain("className={styles.paragraph}");
    expect(sessionSource).not.toContain("detectParagraphLanguage");
    expect(sessionSource).not.toContain("isLikelyHeading");
  });

  it("lets final content clear the menu affordance and safe area", () => {
    expect(sessionSource).toContain(
      "calc(var(--safe-bottom) + 96px)"
    );
    expect(sessionSource).toContain('data-txt-reader="true"');
  });
});
```

- [ ] **Step 2: Extend the existing menu integration contract**

In the existing `keeps a chrome-owned menu button tappable for both opening and closing` test, replace the exact single-class assertion and add state/material assertions:

```ts
const collapsedRule = cssRule(".readerMenuWakeButtonCollapsed::before");
const expandedRule = cssRule(".readerMenuWakeButtonExpanded::before");

expect(controlsSource).toContain("styles.readerMenuWakeButtonCollapsed");
expect(controlsSource).toContain("styles.readerMenuWakeButtonExpanded");
expect(controlsSource).toContain('aria-expanded={visible}');
expect(wakeRule).toContain("width: 48px");
expect(wakeRule).toContain("height: 48px");
expect(wakeRule).toContain("pointer-events: auto");
expect(collapsedRule).toContain("box-shadow: none");
expect(collapsedRule).toContain("right: -10px");
expect(expandedRule).toContain("box-shadow:");
```

Keep the existing ordering assertion that the wake button appears before `readerChromeAnimated` and the assertion that `onWakeMenu` remains the one click path.

- [ ] **Step 3: Add real-browser script fixtures and assertions**

Create `e2e/reader-typography.spec.ts`. Use three inline samples so encoding and expected text stay local to the test:

```ts
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';
const samples = [
  {
    id: "english",
    text: "A quiet room waits beside the window. The reader returns to the same line after every interruption.\n\nA second paragraph keeps ordinary English word spacing on narrow screens.",
  },
  {
    id: "chinese",
    text: "窗边的书页安静地展开，读者每次回来都能找到刚才的位置。\n\n第二段继续验证中文正文在窄屏上的自然节奏。",
  },
  {
    id: "mixed",
    text: "AI Reader 会保留 reading progress，也会让中英文混排保持自然间距。\n\nThe second 段落 verifies a predictable alignment choice.",
  },
] as const;

async function importAndOpen(page: Page, name: string, text: string) {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: `${name}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  const cover = page
    .locator(`${libraryRoot} [data-book-cover-origin]`)
    .first();
  await expect(cover).toBeVisible();
  await cover.click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
}

for (const sample of samples) {
  test(`${sample.id} TXT keeps natural default alignment`, async ({ page }, testInfo: TestInfo) => {
    await importAndOpen(page, sample.id, sample.text);
    const reader = page.locator('[data-txt-reader="true"]');
    await expect(reader).toHaveCSS("text-align", "start");
    await page.screenshot({
      path: testInfo.outputPath(`${sample.id}-default.png`),
      fullPage: false,
    });
  });
}

test("explicit justification and the menu wake target remain available", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ai-reader-preferences",
      JSON.stringify({
        theme: "system",
        fontSizePx: 18,
        lineHeight: 1.75,
        contentWidth: 720,
        fontFamily: "default",
        boldText: false,
        customLayoutEnabled: true,
        letterSpacingPercent: 0,
        wordSpacingPercent: 0,
        pageMarginPx: 0,
        justifyText: true,
      })
    );
  });
  await importAndOpen(page, "explicit-justify", samples[0].text);
  await expect(page.locator('[data-txt-reader="true"]')).toHaveCSS(
    "text-align",
    "justify"
  );

  const wake = page.locator('[data-reader-menu-toggle="true"]');
  await expect(wake).toHaveAttribute("aria-expanded", "false");
  expect(await wake.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  })).toEqual({ width: 48, height: 48 });
  await page.screenshot({
    path: testInfo.outputPath("menu-collapsed.png"),
    fullPage: false,
  });
  await wake.click();
  await expect(wake).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({
    path: testInfo.outputPath("menu-expanded.png"),
    fullPage: false,
  });
});
```

- [ ] **Step 4: Run the focused tests and confirm RED**

Run:

```powershell
npm.cmd test -- lib/readerTypography.test.ts lib/readerMenuIntegration.test.ts
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
```

Expected: Vitest fails because `.paragraph` is still justified, the `start` branch and state classes do not exist, and bottom clearance is still 36px. Playwright fails because `[data-txt-reader="true"]` does not exist. Treat any syntax or server error as a test error to fix before implementation, not as the expected red state.

## Task 2: Implement explicit alignment and the state-aware edge affordance

**Files:**

- Modify: `app/ReadingSession.tsx`
- Modify: `app/ReaderControls.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Implement the minimal TXT alignment and clearance change**

In `ReadingSession.tsx`, add the locator and make both branches explicit:

```tsx
<div
  ref={textReaderRef}
  data-txt-reader="true"
  className={`${styles.readerBody} ${
    mode === "paged" ? styles.readerBodyPaged : ""
  }`}
```

Use the approved bottom clearance and alignment in the existing style object:

```tsx
padding: `20px ${
  24 + (preferences.customLayoutEnabled ? preferences.pageMarginPx : 0)
}px calc(var(--safe-bottom) + 96px)`,
textAlign:
  preferences.customLayoutEnabled && preferences.justifyText
    ? "justify"
    : "start",
```

- [ ] **Step 2: Derive visual button state without adding interaction state**

Replace the wake button's single class in `ReaderControls.tsx` with:

```tsx
className={`${styles.readerMenuWakeButton} ${
  visible
    ? styles.readerMenuWakeButtonExpanded
    : styles.readerMenuWakeButtonCollapsed
}`}
```

Do not change `onClick`, `aria-label`, `aria-expanded`, `data-reader-menu-toggle`, DOM ordering, or the `controlsInert` animation lifecycle.

- [ ] **Step 3: Implement the CSS fallback and material states**

Change `.paragraph` to:

```css
.paragraph {
  color: var(--foreground);
  margin: 0 0 1.05em 0;
  text-align: start;
  text-wrap: pretty;
  overflow-wrap: break-word;
}
```

Replace the wake-button material styling while retaining a 48px button:

```css
.readerMenuWakeButton {
  position: absolute;
  right: 10px;
  bottom: calc(var(--safe-bottom) + 18px);
  z-index: 25;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  visibility: visible;
  pointer-events: auto;
  opacity: 1;
  color: color-mix(in srgb, var(--foreground) 82%, transparent);
  background: transparent;
  border: 0;
  border-radius: 999px;
  box-shadow: none;
  transform: translateY(0) scale(1);
  transition: transform var(--motion-fast) var(--ease-emphasized);
}

.readerMenuWakeButton::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 0.5px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--background) 74%, transparent);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.12);
}

.readerMenuWakeButton svg {
  position: relative;
  z-index: 1;
}

.readerMenuWakeButtonCollapsed::before {
  top: 6px;
  right: -10px;
  bottom: 6px;
  left: 24px;
  border-right: 0;
  border-radius: 999px 0 0 999px;
  background: color-mix(in srgb, var(--background) 58%, transparent);
  box-shadow: none;
}

.readerMenuWakeButtonCollapsed svg {
  opacity: 0.58;
  transform: translateX(7px) scale(0.82);
}

.readerMenuWakeButtonExpanded::before {
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.12);
}

.readerMenuWakeButton:active {
  transform: translateY(4px) scale(0.94);
}
```

Keep the existing reduced-motion block. Add only `transition: none` for the new pseudo-element and icon selectors so reduced-motion styling does not erase their static state:

```css
@media (prefers-reduced-motion: reduce) {
  .readerMenuWakeButton::before,
  .readerMenuWakeButton svg {
    transition: none;
  }
}
```

- [ ] **Step 4: Run the focused tests and confirm GREEN**

Run:

```powershell
npm.cmd test -- lib/readerTypography.test.ts lib/readerMenuIntegration.test.ts lib/readerChromeIntegration.test.ts lib/epubAmbientIntegration.test.ts lib/motionCss.test.ts
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
```

Expected: all focused Vitest files and all four Playwright typography cases pass. The screenshots are written under `test-results/native-navigation/reader-typography-*iphone-14/`.

- [ ] **Step 5: Review the generated screenshots before committing**

Open the English, Chinese, mixed, collapsed-menu, and expanded-menu PNG files. Confirm:

- English words have ordinary spacing in default mode.
- Chinese and mixed content have stable line breaks and no overflow.
- The collapsed visual surface occupies only the trailing edge while the 48px target remains measurable.
- Expanded controls remain readable and tappable.
- The final content can be scrolled above the affordance.

If a screenshot contradicts a criterion, add or tighten a failing assertion before changing production CSS.

- [ ] **Step 6: Commit the verified implementation**

Run:

```powershell
git diff --check
git status --short
git add -- app/ReadingSession.tsx app/ReaderControls.tsx app/page.module.css lib/readerTypography.test.ts lib/readerMenuIntegration.test.ts e2e/reader-typography.spec.ts
git commit -m "fix: polish reader typography and menu affordance"
```

Expected: the commit contains only Phase 1 implementation and regression files.

## Task 3: Run the complete local Phase 1 verification gate

**Files:**

- Modify only if verification exposes a Phase 1 defect.

- [ ] **Step 1: Run the full unit and static gates**

Run each command separately and inspect its exit code:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: Vitest reports zero failing tests, ESLint exits 0, the webpack build exits 0, and `git diff --check` produces no error.

- [ ] **Step 2: Run the full native-navigation matrix**

Run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-15-pro-max
```

Expected: every test passes. The existing reader close/reopen, focus restoration, reduced motion, sheet, and frame-cadence coverage remains green on both iPhone viewports.

- [ ] **Step 3: Confirm repository scope**

Run:

```powershell
git status -sb
git log -4 --oneline --decorate
```

Expected: generated Playwright and build artifacts remain ignored. No unrelated user files are modified.

## Task 4: Deploy, verify production, and check off Phase 1

**Files:**

- Modify: `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Build and deploy with the established Windows OpenNext sequence**

Run:

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected: OpenNext completes and Wrangler publishes a new `ai-reader-pwa` Worker version for `881817.xyz/*`. Record the Worker version ID from the deploy output.

- [ ] **Step 2: Smoke-test production assets and behavior**

Request `https://881817.xyz`, extract its current script and stylesheet asset URLs, and request each discovered asset. Expected: root and assets return HTTP 200.

Run the typography and navigation smoke tests against production:

```powershell
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "reader closes back|captures root"
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Expected: production computed styles and the reader toggle path match the local build.

- [ ] **Step 3: Refresh the roadmap and handoff with evidence**

In `docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md`:

- add `e2e/reader-typography.spec.ts` to the Phase 1 file map;
- check every Phase 1 child item only after its evidence exists;
- check the Phase 1 top-level item last.

In `HANDOFF.md`, record:

- the implementation commit hash;
- the new Worker version ID;
- focused and full test counts;
- local and production screenshot paths;
- the production URL;
- the remaining real-iPhone visual check as a non-blocking physical-device risk if no device evidence is available;
- Phase 2 as the next roadmap item.

- [ ] **Step 4: Verify and commit the closeout documentation**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md HANDOFF.md
git add -- docs/superpowers/plans/2026-07-14-ui-quality-roadmap.md HANDOFF.md docs/superpowers/plans/2026-07-14-reader-typography-implementation.md
git commit -m "docs: complete reader typography phase"
git status -sb
```

Expected: Phase 1 and all child tasks are checked, the handoff matches the deployed Worker, and the branch contains no unintended working-tree changes.
