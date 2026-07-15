# Reader Menu Affordance Quieting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the closed reader menu toggle recede into a narrow right-edge cue while preserving its 48px target, single-button behavior, accessibility, and clear expanded state.

**Architecture:** Keep `ReaderControls` behavior and markup unchanged. Tighten only the collapsed pseudo-element and SVG styling in the existing CSS module, then lock the visual and interaction contracts in the existing Vitest and Playwright suites. Deploy with the established Windows OpenNext standalone flow and record the new code/deployment state in `HANDOFF.md`.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest, Playwright, Next.js 16 webpack build, OpenNext for Cloudflare Workers.

---

## File Map

- Modify `lib/readerMenuIntegration.test.ts`: lock the quieter collapsed geometry, paint, glyph, and existing interaction/accessibility invariants.
- Modify `app/page.module.css`: implement the narrower, lower-contrast collapsed cue and state transitions without changing the button box.
- Modify `e2e/reader-typography.spec.ts`: verify computed collapsed/expanded styles and capture light/dark evidence on both phone projects.
- Create/update `test-results/native-navigation/**`: generated, gitignored Playwright evidence only; never stage it.
- Modify `HANDOFF.md`: record the implementation commit, verification totals, production evidence, and Worker version after deployment.

### Task 1: Lock the quiet collapsed-state contract

**Files:**
- Modify: `lib/readerMenuIntegration.test.ts`
- Test: `lib/readerMenuIntegration.test.ts`

- [ ] **Step 1: Extend the focused contract test before changing CSS**

Inside `keeps a chrome-owned menu button tappable for both opening and closing`, add the collapsed SVG rule and replace the current geometry assertions with the approved quiet-state contract:

```ts
const collapsedIconRule = cssRule(".readerMenuWakeButtonCollapsed svg");

expect(collapsedRule).toContain("top: 9px");
expect(collapsedRule).toContain("right: -6px");
expect(collapsedRule).toContain("bottom: 9px");
expect(collapsedRule).toContain("left: 32px");
expect(collapsedRule).toContain(
  "border-color: color-mix(in srgb, var(--foreground) 7%, transparent)"
);
expect(collapsedRule).toContain(
  "background: color-mix(in srgb, var(--background) 44%, transparent)"
);
expect(collapsedRule).toContain("box-shadow: none");
expect(collapsedIconRule).toContain("opacity: 0.38");
expect(collapsedIconRule).toContain("translateX(10px) scale(0.7)");
```

Keep the existing assertions for `width: 48px`, `height: 48px`, `pointer-events: auto`, `visibility: visible`, `aria-expanded`, the single `onWakeMenu` path, and the stronger expanded shadow.

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

```powershell
npm.cmd run test -- lib\readerMenuIntegration.test.ts
```

Expected: FAIL because the current CSS still uses `top/bottom: 6px`, `right: -10px`, `left: 24px`, `58%` background, `0.58` opacity, and `scale(0.82)`.

### Task 2: Implement the minimum CSS refinement

**Files:**
- Modify: `app/page.module.css`
- Test: `lib/readerMenuIntegration.test.ts`
- Test: `lib/motionCss.test.ts`

- [ ] **Step 1: Add state-transition coverage to the existing visual layers**

Extend the base pseudo-element and SVG rules without changing the button dimensions or position:

```css
.readerMenuWakeButton::before {
  content: "";
  position: absolute;
  inset: 0;
  border: 0.5px solid color-mix(in srgb, var(--foreground) 10%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--background) 74%, transparent);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.12);
  transition:
    background var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard);
}

.readerMenuWakeButton svg {
  position: relative;
  z-index: 1;
  opacity: 1;
  transform: translateX(0) scale(1);
  transition:
    opacity var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-emphasized);
}
```

- [ ] **Step 2: Replace only the collapsed visual values**

Use the approved narrow edge cue:

```css
.readerMenuWakeButtonCollapsed::before {
  top: 9px;
  right: -6px;
  bottom: 9px;
  left: 32px;
  border-color: color-mix(in srgb, var(--foreground) 7%, transparent);
  border-right: 0;
  border-radius: 999px 0 0 999px;
  background: color-mix(in srgb, var(--background) 44%, transparent);
  box-shadow: none;
}

.readerMenuWakeButtonCollapsed svg {
  opacity: 0.38;
  transform: translateX(10px) scale(0.7);
}
```

Do not change `.readerMenuWakeButton` width, height, right/bottom position, pointer events, visibility, label, or expanded-state shadow.

- [ ] **Step 3: Disable only the new interpolation under reduced motion**

Add the visual layers to the existing reduced-motion block while preserving the static collapsed geometry:

```css
@media (prefers-reduced-motion: reduce) {
  .readerMenuWakeButton::before,
  .readerMenuWakeButton svg {
    transition: none;
  }
}
```

Do not set the collapsed SVG transform to `none`; it is static shape/placement, not an animation. The existing button press transform remains disabled by the current reduced-motion rules.

- [ ] **Step 4: Run focused reader regressions**

Run:

```powershell
npm.cmd run test -- lib\readerMenuIntegration.test.ts lib\readerChromeIntegration.test.ts lib\motionCss.test.ts lib\ambientBookBackground.test.ts lib\epubAmbientIntegration.test.ts
```

Expected: all focused files PASS, including the new quiet-state assertions and existing EPUB ambient safeguards.

- [ ] **Step 5: Commit the implementation and focused contract**

```powershell
git add -- app/page.module.css lib/readerMenuIntegration.test.ts
git commit -m "style: quiet reader menu affordance"
```

### Task 3: Strengthen browser evidence for light and dark states

**Files:**
- Modify: `e2e/reader-typography.spec.ts`
- Test: `e2e/reader-typography.spec.ts`

- [ ] **Step 1: Update the computed collapsed-style assertion**

Replace the old `{ boxShadow, right }` assertion with the complete painted geometry:

```ts
expect(
  await wake.evaluate((element) => {
    const style = getComputedStyle(element, "::before");
    const iconStyle = getComputedStyle(element.querySelector("svg")!);
    return {
      boxShadow: style.boxShadow,
      top: style.top,
      right: style.right,
      bottom: style.bottom,
      left: style.left,
      iconOpacity: iconStyle.opacity,
    };
  })
).toEqual({
  boxShadow: "none",
  top: "9px",
  right: "-6px",
  bottom: "9px",
  left: "32px",
  iconOpacity: "0.38",
});
```

Keep the 48px bounding-box assertion, `aria-expanded` checks, click-to-open behavior, non-`none` expanded shadow, and existing collapsed/expanded screenshots.

- [ ] **Step 2: Add a dark-theme collapsed screenshot case**

Add a focused test that installs dark reader preferences before import, opens a TXT book, confirms the same target and quiet computed state, and captures `menu-collapsed-dark.png`:

```ts
test("collapsed menu affordance stays quiet in dark reader theme", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ai-reader-preferences",
      JSON.stringify({
        theme: "dark",
        fontSizePx: 18,
        lineHeight: 1.75,
        contentWidth: 720,
        fontFamily: "default",
        boldText: false,
        customLayoutEnabled: false,
        letterSpacingPercent: 0,
        wordSpacingPercent: 0,
        pageMarginPx: 0,
        justifyText: false,
      })
    );
  });
  await importAndOpen(page, "menu-dark", samples[1].text);
  const wake = page.locator('[data-reader-menu-toggle="true"]');
  await expect(wake).toHaveAttribute("aria-expanded", "false");
  await expect(wake).toHaveCSS("width", "48px");
  await expect(wake).toHaveCSS("height", "48px");
  expect(
    await wake.evaluate(
      (element) => getComputedStyle(element, "::before").boxShadow
    )
  ).toBe("none");
  await page.screenshot({
    path: testInfo.outputPath("menu-collapsed-dark.png"),
    fullPage: false,
  });
});
```

- [ ] **Step 3: Run the focused Playwright file on both phone projects**

Run:

```powershell
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-15-pro-max
```

Expected: 7/7 tests PASS on each project. Inspect `menu-collapsed.png`, `menu-collapsed-dark.png`, and `menu-expanded.png` from both projects. The closed cue must remain discoverable but must not read as a floating circular control; the open control must remain clear.

- [ ] **Step 4: Commit browser coverage**

```powershell
git add -- e2e/reader-typography.spec.ts
git commit -m "test: verify quiet reader menu affordance"
```

### Task 4: Run the complete local verification gate

**Files:**
- Verify only; do not modify generated artifacts.

- [ ] **Step 1: Run the full repository checks**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
git status -sb
```

Expected: full Vitest, configured ESLint, and webpack build PASS; no whitespace errors; only intentional committed changes exist.

- [ ] **Step 2: Run the full mobile browser suites**

```powershell
npx.cmd playwright test --project=iphone-14
npx.cmd playwright test --project=iphone-15-pro-max
```

Expected: all configured suites PASS on both phone projects. If a transport error occurs before any app DOM exists, verify the local server and rerun the unchanged failed case; do not change application code without an application-level failure.

- [ ] **Step 3: Review generated evidence**

Open the newest light/dark collapsed and expanded screenshots from `test-results/native-navigation/`. Confirm safe-area placement, readable nearby text, theme contrast, 48px target behavior, and the stronger expanded state. Do not stage `test-results/`.

### Task 5: Deploy and verify production

**Files:**
- Generated only: `.next/**`, `.open-next/**`

- [ ] **Step 1: Build the standalone Next output required by OpenNext on Windows**

```powershell
$env:NEXT_PRIVATE_STANDALONE='true'
$env:NEXT_PRIVATE_OUTPUT_TRACE_ROOT=(Get-Location).Path
npm.cmd run build
```

Expected: webpack build succeeds and `.next/standalone` exists.

- [ ] **Step 2: Build and deploy the Worker**

```powershell
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected: OpenNext completes and Wrangler prints a new `ai-reader-pwa` Worker version for route `881817.xyz/*`. Record the version ID.

- [ ] **Step 3: Verify production HTTP assets**

```powershell
$html=(Invoke-WebRequest -UseBasicParsing https://881817.xyz).Content
$assets=$html | Select-String -Pattern '/_next/static/(?:chunks|css)/[^"'']+\.(?:js|css)' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique
foreach($u in $assets){ $r=Invoke-WebRequest -UseBasicParsing "https://881817.xyz$u"; "$u $($r.StatusCode) $($r.Headers['Content-Type']) len=$($r.RawContentLength)" }
```

Expected: root and every discovered JS/CSS asset return HTTP 200.

- [ ] **Step 4: Run the focused production browser evidence**

```powershell
$env:PLAYWRIGHT_BASE_URL='https://881817.xyz'
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-14 --grep "menu wake target|collapsed menu affordance"
npx.cmd playwright test e2e/reader-typography.spec.ts --project=iphone-15-pro-max --grep "menu wake target|collapsed menu affordance"
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

Expected: 2/2 focused menu tests PASS on each project with production light/dark screenshots.

### Task 6: Refresh the handoff and publish the branch

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Add the completed refinement to `HANDOFF.md`**

Use a small patch, preserving UTF-8 text. Record:

- design commit `8306ecc`;
- the implementation and browser-test commit IDs from Tasks 2 and 3;
- the exact full Vitest, ESLint, build, and Playwright results from this run;
- the new Worker version and production HTTP/browser evidence;
- that UI roadmap Phases 1 through 6 remain closed;
- that real iPhone Safari/PWA confirmation and the evidence-gated EPUB dark-canvas issue remain non-blocking risks.

- [ ] **Step 2: Verify and commit only the handoff**

```powershell
Get-Content -Raw -Encoding UTF8 HANDOFF.md
git diff --check
git add -- HANDOFF.md
git commit -m "docs: complete reader menu quieting"
git status -sb
```

Expected: the handoff renders correctly, the commit contains only `HANDOFF.md`, and the working tree is clean.

- [ ] **Step 3: Push the current branch**

```powershell
git push origin codex/custom-background-settings
git status -sb
git log -8 --oneline --decorate
```

Expected: local and `origin/codex/custom-background-settings` point to the same handoff commit and the working tree remains clean.
