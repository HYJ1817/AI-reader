# Shared Sheet Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shared bottom-sheet entrance compositor-friendly by isolating backdrop opacity from the panel transform, with a real Library More-button performance regression test.

**Architecture:** Keep `MotionSheet` as the single interruptible motion owner. Replace the inherited per-frame backdrop CSS variable and parent opacity animation with an explicit backdrop sibling whose native opacity is driven by the existing progress MotionValue; keep the panel on its existing `y` transform and scope compositing hints to those two mounted elements.

**Tech Stack:** Next.js 16, React 19, TypeScript, Motion for React, CSS Modules, Vitest, Playwright Chromium mobile profiles.

---

## File Map

- Modify `app/MotionSheet.tsx`: render the static overlay, explicit Motion
  backdrop, and transform-only panel while preserving focus, inert, viewport,
  drag, interruption, and reduced-motion behavior.
- Modify `app/page.module.css`: replace the pseudo-element backdrop with a real
  backdrop rule and add two narrowly scoped compositing hints.
- Modify `lib/overlayMotionIntegration.test.ts`: lock the DOM/data-flow contract
  so inherited per-frame custom properties and parent opacity cannot return.
- Modify `lib/motionCss.test.ts`: lock the exact compositor-hint budget and
  prohibit layout/filter animation on the shared sheet.
- Modify `e2e/native-navigation.spec.ts`: add real More-button frame metrics and
  representative theme screenshots while retaining the existing all-route,
  drag, interruption, Escape, and reduced-motion coverage.
- Modify `HANDOFF.md`: record the final local evidence, exact limits, and the
  unresolved physical-iPhone 120Hz acceptance boundary.

No new production component is needed. Sheet-specific content remains untouched.

### Task 1: Lock the compositor-only shared-sheet contract

**Files:**

- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `lib/motionCss.test.ts`
- Test: `lib/overlayMotionIntegration.test.ts`
- Test: `lib/motionCss.test.ts`

- [ ] **Step 1: Add the failing DOM/data-flow contract test**

Add this case inside `describe("overlay and nested view motion", ...)` in
`lib/overlayMotionIntegration.test.ts`:

```ts
it("isolates sheet backdrop opacity from the transform-only panel", () => {
  expect(motionSheetSource).toContain(
    "className={styles.motionSheetBackdrop}"
  );
  expect(motionSheetSource).toContain("style={{ opacity: progress }}");
  expect(motionSheetSource).toContain('data-motion-sheet="backdrop"');
  expect(motionSheetSource).not.toContain('"--sheet-backdrop-opacity"');
  expect(motionSheetSource).not.toContain("initial={{ opacity: 0 }}");
  expect(motionSheetSource).not.toContain("animate={{ opacity: 1 }}");
  expect(motionSheetSource).not.toContain("exit={{ opacity: 0 }}");
  expect(motionSheetSource).toContain("const interruptClose");
  expect(motionSheetSource).toContain("activeAnimationRef.current?.stop()");
});
```

- [ ] **Step 2: Add the failing CSS compositor-budget test**

In `lib/motionCss.test.ts`, replace the old exact single-`will-change` assertion
inside `"removes superseded keyframes, visual timers, and idle compositing hints"`
with:

```ts
const willChangeDeclarations = css.match(/will-change:\s*[^;]+;/g) ?? [];
expect([...willChangeDeclarations].sort()).toEqual(
  [
    "will-change: opacity;",
    "will-change: transform;",
    "will-change: transform;",
  ].sort()
);
```

Then add this focused test after the sheet-shadow test:

```ts
it("keeps shared sheet entrance on bounded compositor properties", () => {
  const backdropStart = css.indexOf(".motionSheetBackdrop {");
  const backdropEnd = css.indexOf("}", backdropStart);
  const backdropRule = css.slice(backdropStart, backdropEnd);
  expect(backdropRule).toContain("will-change: opacity;");
  expect(backdropRule).not.toMatch(/(?:filter|backdrop-filter|transform):/);

  const panelStart = css.indexOf(".motionSheetPanel {");
  const panelEnd = css.indexOf("}", panelStart);
  const panelRule = css.slice(panelStart, panelEnd);
  expect(panelRule).toContain("will-change: transform;");
  expect(panelRule).not.toMatch(
    /(?:top|left|right|bottom|width|height|filter|backdrop-filter):/
  );

  expect(css).not.toContain("--sheet-backdrop-opacity");
  expect(css).not.toContain(".sheetOverlay::before");
  expect(css).not.toContain(".motionSheetOverlay::before");
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- lib\overlayMotionIntegration.test.ts lib\motionCss.test.ts
```

Expected: the new tests fail because `MotionSheet` still sets
`--sheet-backdrop-opacity`, animates overlay opacity, uses the pseudo-element
backdrop, and lacks the two scoped compositor hints. Existing assertions should
remain green.

- [ ] **Step 4: Commit the red tests**

```powershell
git add -- lib\overlayMotionIntegration.test.ts lib\motionCss.test.ts
git commit -m "test: define shared sheet compositor contract"
```

### Task 2: Split backdrop opacity from panel transform

**Files:**

- Modify: `app/MotionSheet.tsx:145-168`
- Modify: `app/MotionSheet.tsx:391-452`
- Modify: `app/page.module.css:3700-3748`
- Test: `lib/overlayMotionIntegration.test.ts`
- Test: `lib/motionCss.test.ts`

- [ ] **Step 1: Stop publishing a per-frame inherited CSS variable**

Change `overlayStyle` in `app/MotionSheet.tsx` to contain viewport geometry only:

```ts
const overlayStyle = {
  ...(visualViewportFrame
    ? {
        left: visualViewportFrame.offsetLeft,
        top: visualViewportFrame.offsetTop,
        right: "auto",
        bottom: "auto",
        width: visualViewportFrame.width,
        height: visualViewportFrame.height,
      }
    : {}),
} satisfies CSSProperties;
```

Keep `progress`, `scale`, `borderRadius`, and `brightness` intact because they are
part of the current shared presentation context; do not refactor unrelated
motion state in this task.

- [ ] **Step 2: Make the overlay static and render an explicit backdrop**

Replace the overlay's opacity variants in `app/MotionSheet.tsx` with a static
Motion container and add the backdrop immediately before the panel:

```tsx
<m.div
  key="motion-sheet"
  className={`${styles.sheetOverlay} ${styles.motionSheetOverlay}`}
  style={overlayStyle}
  data-motion-sheet="overlay"
  data-sheet-closing={closeRequest ? "true" : undefined}
  onClick={(event) => {
    if (event.target === event.currentTarget) close();
  }}
>
  <m.div
    className={styles.motionSheetBackdrop}
    style={{ opacity: progress }}
    data-motion-sheet="backdrop"
    aria-hidden="true"
  />
  <m.div
    ref={panelRef}
    className={panelClassName}
    style={{ y }}
    role="dialog"
    aria-modal="true"
    aria-label={ariaLabel}
    tabIndex={-1}
    drag="y"
    dragControls={dragControls}
    dragListener={false}
    dragConstraints={{ top: 0, bottom: sheetHeight }}
    dragElastic={{ top: 0, bottom: 0.08 }}
    dragMomentum={false}
    onPointerDownCapture={handleDragPointerDown}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onDragEnd={(_, info) => {
      const offsetY = Math.max(0, y.get(), info.offset.y);
      if (
        shouldCompleteSheetDismiss(offsetY, info.velocity.y, sheetHeight)
      ) {
        close();
        return;
      }
      setCloseRequest(null);
      runAnimation(0, "settle");
    }}
    data-motion-sheet="panel"
    data-navigation-gesture-owner="sheet"
  >
    {showGrabber && (
      <div
        className={styles.sheetDragHandle}
        data-sheet-drag-handle="true"
      >
        <div className={styles.sheetGrabber} />
      </div>
    )}
    {typeof children === "function" ? children(close) : children}
  </m.div>
</m.div>
```

Do not add a backdrop click handler. Its `pointer-events: none` rule lets the
overlay remain the outside-tap target, preserving current dismissal behavior.

- [ ] **Step 3: Replace the pseudo-element CSS with bounded layers**

In `app/page.module.css`, remove `.sheetOverlay::before` and
`.motionSheetOverlay::before`, then add:

```css
.motionSheetBackdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  pointer-events: none;
  will-change: opacity;
}

.motionSheetPanel {
  touch-action: pan-y;
  will-change: transform;
}
```

Leave `.sheetOverlay`, `.bottomSheet`, the sheet shadow, content containment,
safe-area padding, and every sheet-specific class unchanged.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- lib\overlayMotionIntegration.test.ts lib\motionCss.test.ts lib\motionRoleParity.test.ts
```

Expected: all focused tests pass. The duration parity test confirms the 300ms
enter and 250ms exit tokens did not change.

- [ ] **Step 5: Run focused sheet behavior coverage**

Run:

```powershell
npx.cmd playwright test e2e\native-navigation.spec.ts --project=iphone-14 --grep "all sheet routes|sheet destination|reduced motion"
```

Expected: all matched tests pass; every route mounts, focuses, and dismisses,
and reduced motion leaves no running transition.

- [ ] **Step 6: Commit the minimal rendering fix**

```powershell
git add -- app\MotionSheet.tsx app\page.module.css
git commit -m "perf: isolate shared sheet compositor layers"
```

### Task 3: Add real-click performance and theme regression coverage

**Files:**

- Modify: `e2e/native-navigation.spec.ts`
- Test: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Add a reusable Library list-mode helper**

Place this helper near `firstLibraryCover`:

```ts
async function useLibraryListMode(page: Page) {
  await page.getByRole("button", { name: "列表" }).click();
  await expect(
    page.locator(
      `${libraryRootSelector} [data-library-book-open="true"]`
    ).first()
  ).toBeVisible();
}
```

- [ ] **Step 2: Add a real More-button entrance performance test**

Add this test before the existing root-tab performance test:

```ts
test("book action sheet entrance stays within mobile frame budgets", async ({
  page,
}, testInfo) => {
  await useLibraryListMode(page);
  const more = page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first();
  await expect(more).toBeVisible();
  await page.waitForTimeout(600);

  const metricsPromise = page.evaluate(async () => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let layoutShift = 0;
    let clickAt: number | null = null;
    let mountedAt: number | null = null;
    let previous = performance.now();
    const observers: PerformanceObserver[] = [];
    const mutation = new MutationObserver(() => {
      if (
        mountedAt === null &&
        document.querySelector(
          '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
        )
      ) {
        mountedAt = performance.now();
      }
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    const clickListener = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('[data-library-book-more="true"]')
      ) {
        clickAt = performance.now();
      }
    };
    document.addEventListener("click", clickListener, true);

    const handleEntries = (entries: PerformanceEntryList) => {
      for (const entry of entries.getEntries()) {
        if (entry.entryType === "longtask") longTasks.push(entry.duration);
        if (entry.entryType === "layout-shift") {
          layoutShift += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    };
    for (const type of ["longtask", "layout-shift"] as const) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      const observer = new PerformanceObserver((list) => handleEntries(list));
      observer.observe({ entryTypes: [type] });
      observers.push(observer);
    }

    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - startedAt >= 800) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    mutation.disconnect();
    document.removeEventListener("click", clickListener, true);
    for (const observer of observers) {
      handleEntries(observer.takeRecords());
      observer.disconnect();
    }
    const sampledIntervals = intervals.slice(2);
    const sorted = [...sampledIntervals].sort((a, b) => a - b);
    return {
      clickToMount:
        clickAt === null || mountedAt === null ? null : mountedAt - clickAt,
      frames: sampledIntervals.length,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      maxFrame: Math.max(...sampledIntervals),
      maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      layoutShift,
    };
  });

  await page.waitForTimeout(40);
  await more.click();
  const panel = page.locator(
    '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
  );
  const backdrop = page.locator(
    '[data-sheet-route="book-actions"] [data-motion-sheet="backdrop"]'
  );
  await expect(panel).toBeVisible();
  await expect(backdrop).toHaveCSS("will-change", "opacity");
  await expect(panel).toHaveCSS("will-change", "transform");
  const metrics = await metricsPromise;

  console.info(
    `[book-sheet-performance] ${testInfo.project.name} ${JSON.stringify(metrics)}`
  );
  await testInfo.attach("book-sheet-performance.json", {
    body: JSON.stringify({ project: testInfo.project.name, ...metrics }, null, 2),
    contentType: "application/json",
  });

  expect(metrics.clickToMount).not.toBeNull();
  expect(metrics.clickToMount ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(34);
  expect(metrics.frames).toBeGreaterThanOrEqual(40);
  expect(metrics.p95).toBeLessThanOrEqual(20);
  expect(metrics.maxFrame).toBeLessThanOrEqual(34);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
});
```

- [ ] **Step 3: Add direct outside-tap and drag-dismiss coverage**

Add this test after the performance test:

```ts
test("shared sheet preserves outside-tap and drag dismissal", async ({ page }) => {
  await injectSheet(page, "collection-create");
  let host = page.locator('[data-sheet-route="collection-create"]');
  await expect(host.locator('[data-motion-sheet="panel"]')).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(host).toHaveCount(0);

  await injectSheet(page, "collection-create");
  host = page.locator('[data-sheet-route="collection-create"]');
  const panel = host.locator('[data-motion-sheet="panel"]');
  const handle = host.locator('[data-sheet-drag-handle="true"]');
  await waitForVerticalSettle(
    page,
    '[data-sheet-route="collection-create"] [data-motion-sheet="panel"]'
  );
  const handleBox = await handle.boundingBox();
  const viewport = page.viewportSize();
  if (!handleBox || !viewport) {
    throw new Error("Shared sheet drag geometry is unavailable");
  }
  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  await dragTouch(page, { x, y }, { x, y: viewport.height - 4 }, 16);
  await expect(host).toHaveCount(0);
  await expect(panel).toHaveCount(0);
});
```

The existing `activeAnimationRef.current?.stop()` and `interruptClose()` source
contract remains in `overlayMotionIntegration.test.ts`; together with this real
gesture path it protects interruption without introducing a timing-sensitive
second-drag browser test.

- [ ] **Step 4: Add representative theme evidence for the shared sheet**

Add this test after the performance test:

```ts
test("book action sheet preserves light, sepia, dark, and system-dark materials", async ({
  page,
}, testInfo) => {
  await useLibraryListMode(page);
  await page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first()
    .click();
  const app = page.locator('[data-app-shell="true"]');
  const sheet = page.locator('[data-sheet-route="book-actions"]');
  const panel = sheet.locator('[data-motion-sheet="panel"]');
  await expect(panel).toBeVisible();

  for (const theme of ["light", "sepia", "dark"] as const) {
    await app.evaluate((element, nextTheme) => {
      element.setAttribute("data-reader-theme", nextTheme);
    }, theme);
    await expect(panel).toHaveCSS(
      "background-color",
      {
        light: "rgba(255, 255, 255, 0.96)",
        sepia: "rgba(244, 236, 216, 0.96)",
        dark: "rgba(28, 28, 30, 0.98)",
      }[theme]
    );
    await capture(page, testInfo, `book-sheet-theme-${theme}`);
  }

  await page.emulateMedia({ colorScheme: "dark" });
  await app.evaluate((element) => {
    element.removeAttribute("data-reader-theme");
  });
  await expect(panel).toHaveCSS("background-color", "rgba(28, 28, 30, 0.98)");
  await capture(page, testInfo, "book-sheet-theme-system-dark");
});
```

- [ ] **Step 5: Run the new tests on both phone profiles**

Run:

```powershell
npx.cmd playwright test e2e\native-navigation.spec.ts --project=iphone-14 --grep "book action sheet|shared sheet preserves"
npx.cmd playwright test e2e\native-navigation.spec.ts --project=iphone-15-pro-max --grep "book action sheet|shared sheet preserves"
```

Expected: both performance tests pass their cadence, maximum-frame, long-task,
and layout-shift gates; both theme tests pass and write four screenshots per
profile under gitignored `test-results/native-navigation`.

- [ ] **Step 6: Inspect visual evidence at original resolution**

Open the eight Light/Sepia/Dark/system-dark images with the local image viewer.
Verify unchanged sheet geometry, fill, shadow, border, grabber, content, dimming,
safe-area placement, and absence of flashes or naked content. Record the file
names and inspection result in the final handoff; do not commit screenshots.

- [ ] **Step 7: Commit the browser regression coverage**

```powershell
git add -- e2e\native-navigation.spec.ts
git commit -m "test: cover shared sheet entrance performance"
```

### Task 4: Measure improvement and run full quality gates

**Files:**

- Modify: `HANDOFF.md`
- Verify: `app/MotionSheet.tsx`
- Verify: `app/page.module.css`
- Verify: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Re-run the same real-click diagnostic probe**

Use the same temporary, gitignored `test-results` probe described in the design
evidence: real More-button click, three unthrottled runs, three 4x CPU runs, and
a 700ms DevTools timeline summary for style, Layout, Paint, RasterTask, and long
tasks. Create and remove the temporary probe only with `apply_patch`.

Expected compared with the recorded baseline:

- No inherited `--sheet-backdrop-opacity` updates.
- No parent overlay opacity animation.
- Unthrottled P95 remains at one 60Hz frame or better, with no long task or
  layout shift.
- In a matched unthrottled trace, UpdateLayoutTree count is at most 42, Paint
  count is at most 56, and RasterTask count is at most 419. These are explicit
  25% reductions from the recorded 56/75/559 baseline and guard against merely
  shifting work to another animated property.

- [ ] **Step 2: Run focused and full unit verification**

```powershell
npm.cmd test -- lib\overlayMotionIntegration.test.ts lib\motionCss.test.ts lib\motionRoleParity.test.ts
npm.cmd test
```

Expected: focused tests pass, then the complete currently discovered Vitest
suite passes with zero failed files and zero failed tests.

- [ ] **Step 3: Run lint and production build**

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: configured ESLint exits 0; Next.js 16 webpack compilation, TypeScript,
and static generation all exit 0.

- [ ] **Step 4: Run the full shared navigation matrix**

```powershell
npx.cmd playwright test e2e\native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e\native-navigation.spec.ts --project=iphone-15-pro-max
```

Expected: every test passes on both phone profiles, including all sheet routes,
Escape, drag, interrupted settle, focus/inert behavior, reduced motion, real
book-action entrance, root navigation, push, and reader interactions.

- [ ] **Step 5: Run Impeccable and repository checks**

```powershell
node ..\.agents\skills\impeccable\scripts\detect.mjs --json app\MotionSheet.tsx app\page.module.css
git diff --check
git status -sb
```

Expected: detector JSON is `[]`, `git diff --check` reports no whitespace
errors, generated test/build files remain ignored, and only the intended handoff
edit is uncommitted.

- [ ] **Step 6: Update the handoff with exact evidence**

Add a dated `Shared Sheet Performance` section near the current top of
`HANDOFF.md` containing:

- Design commit `adbf38d` and the plan/implementation/test commit SHAs.
- Root cause and the final two-layer architecture.
- Before/after click-to-mount, frame, long-task, style, Paint, and RasterTask
  evidence without calling Chromium proof of 120fps.
- Focused/full Vitest, lint, build, both complete phone-profile results, theme
  screenshot inspection, detector output, and `git diff --check`.
- The explicit statement that physical 120Hz iPhone Safari/PWA verification is
  still a non-blocking device acceptance item.
- Deployment status as local-only unless the user separately authorizes push
  and deployment.

- [ ] **Step 7: Commit the verified handoff**

```powershell
git add -- HANDOFF.md
git diff --cached --check
git commit -m "docs: record shared sheet performance verification"
```

- [ ] **Step 8: Present completion state without pushing or deploying**

Run:

```powershell
git status -sb
git log -8 --oneline --decorate
```

Expected: the working tree is clean and `main` is ahead of `origin/main` by the
new local commits. Report exact verification evidence and ask before any push or
production deployment.
