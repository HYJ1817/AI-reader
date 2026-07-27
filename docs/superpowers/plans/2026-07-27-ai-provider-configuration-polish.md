# AI Provider Configuration Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact iOS-style AI provider configuration page and a compositor-safe provider push transition designed around an 8.33ms main-thread frame budget.

**Architecture:** Keep the existing provider data and navigation reducers unchanged. Restructure only `AiSettingsSurface` presentation into a compact preset picker, grouped labeled connection fields, model group, and sticky action region; replace navigation brightness filters with a dedicated pointer-inert native-opacity depth layer shared by root and push surfaces. Lock both changes with source contracts and a real-click cold-route Playwright performance test before implementation.

**Tech Stack:** React 19, TypeScript, CSS Modules, Motion, Vitest, Playwright, Next.js 16.

---

## File Structure

- Modify `lib/aiSettingsSheetIntegration.test.ts`: source-level UI and accessibility contract for the configure page.
- Create `lib/pushSurfaceMotionIntegration.test.ts`: source/CSS contract for transform plus native-opacity navigation layers and reduced motion.
- Modify `e2e/native-navigation.spec.ts`: real AI provider list-to-configure visual, behavior, text-size, and cold transition budget.
- Modify `app/AiSettingsSurface.tsx`: compact picker, grouped fields, model section, and sticky action region.
- Modify `app/NavigationStack.tsx`: remove animated brightness filters and drive dedicated depth-overlay opacity during normal and edge-back transitions.
- Modify `app/page.module.css`: provider layout, themes, focus, responsive text behavior, sticky action material, and depth overlay.
- Update `HANDOFF.md`: final evidence, commit, publication state, and physical-device acceptance boundary.

### Task 1: Lock the provider configure information architecture

**Files:**
- Modify: `lib/aiSettingsSheetIntegration.test.ts`
- Test: `lib/aiSettingsSheetIntegration.test.ts`

- [ ] **Step 1: Write the failing structure test**

Add a CSS fixture and assertions that describe the approved surface without testing incidental copy formatting:

```ts
const pageCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

it("uses a compact picker and one labeled connection group", () => {
  expect(aiSettingsSource).toContain("data-provider-preset-grid");
  expect(aiSettingsSource).toContain("providerConnectionCard");
  expect(aiSettingsSource).toContain("providerFieldLabel");
  expect(aiSettingsSource).toContain('>名称</span>');
  expect(aiSettingsSource).toContain('>API Key</span>');
  expect(aiSettingsSource).toContain('>API 地址</span>');
  expect(aiSettingsSource).toContain("providerStickyActions");
  expect(pageCss).toMatch(/\.providerPresetGrid\s*\{[\s\S]*?display:\s*grid/);
  expect(pageCss).toMatch(/\.providerStickyActions\s*\{[\s\S]*?position:\s*sticky/);
});

it("keeps native provider and model selection semantics", () => {
  expect(aiSettingsSource).toContain(
    'aria-pressed={draft.kind === preset.kind}'
  );
  expect(aiSettingsSource).toContain(
    'aria-pressed={draft.model === model.id}'
  );
  expect(aiSettingsSource).toContain('aria-busy={refreshingModels}');
  expect(aiSettingsSource).toContain('role="status"');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/aiSettingsSheetIntegration.test.ts
```

Expected: FAIL because `data-provider-preset-grid`, `providerConnectionCard`,
`providerFieldLabel`, and `providerStickyActions` do not exist.

- [ ] **Step 3: Commit the red test**

```powershell
git add lib/aiSettingsSheetIntegration.test.ts
git commit -m "test: define polished provider configuration"
```

### Task 2: Lock the compositor-safe push contract

**Files:**
- Create: `lib/pushSurfaceMotionIntegration.test.ts`
- Test: `lib/pushSurfaceMotionIntegration.test.ts`

- [ ] **Step 1: Write the failing navigation motion test**

Create the following contract test:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navigationSource = readFileSync(
  new URL("../app/NavigationStack.tsx", import.meta.url),
  "utf8"
);
const pageCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

describe("push surface motion integration", () => {
  it("uses transform and a dedicated native-opacity depth layer", () => {
    expect(navigationSource).toContain("pushDepthOverlay");
    expect(navigationSource).toContain("edgePreviousOverlayOpacity");
    expect(navigationSource).not.toContain("edgePreviousBrightness");
    expect(navigationSource).not.toMatch(/\bfilter\s*:/);
    expect(pageCss).toMatch(
      /\.pushDepthOverlay\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?background:/
    );
  });

  it("removes depth interpolation for reduced motion", () => {
    expect(navigationSource).toContain(
      "reduceMotion || pushDepth === 0 ? 0 : PUSH_DEPTH_OPACITY"
    );
    expect(pageCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.pushDepthOverlay\s*\{[\s\S]*?transition:\s*none/
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/pushSurfaceMotionIntegration.test.ts
```

Expected: FAIL because navigation still animates brightness filters and has no
dedicated opacity layer.

- [ ] **Step 3: Commit the red test**

```powershell
git add lib/pushSurfaceMotionIntegration.test.ts
git commit -m "test: define compositor safe push depth"
```

### Task 3: Add the real provider-transition browser regression and baseline

**Files:**
- Modify: `e2e/native-navigation.spec.ts`
- Test: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Add a cold real-click performance helper**

Add a helper beside the existing frame probes. It installs capture and
performance observers before the real click, starts its clock from the actual
button click, observes the destination mount, and resolves after 700ms:

```ts
type ProviderTransitionMetrics = {
  clickToMount: number;
  frames: number;
  p95: number;
  maxInterval: number;
  maxLongTask: number;
  layoutShift: number;
};

async function collectProviderTransitionMetrics(
  page: Page
): Promise<ProviderTransitionMetrics> {
  return page.evaluate(
    () =>
      new Promise<ProviderTransitionMetrics>((resolve, reject) => {
        const intervals: number[] = [];
        const longTasks: number[] = [];
        let layoutShift = 0;
        let clickedAt: number | null = null;
        let mountedAt: number | null = null;
        let previous = performance.now();

        if (
          !PerformanceObserver.supportedEntryTypes.includes("longtask") ||
          !PerformanceObserver.supportedEntryTypes.includes("layout-shift")
        ) {
          reject(new Error("Required PerformanceObserver entry type is unavailable"));
          return;
        }

        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration);
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });

        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            layoutShift += (entry as PerformanceEntry & { value: number }).value;
          }
        });
        layoutShiftObserver.observe({ entryTypes: ["layout-shift"] });

        const mountObserver = new MutationObserver(() => {
          if (
            clickedAt !== null &&
            mountedAt === null &&
            document.querySelector('[data-provider-configure="true"]')
          ) {
            mountedAt = performance.now();
          }
        });
        mountObserver.observe(document.body, { childList: true, subtree: true });

        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error("Provider transition did not finish within 1500ms"));
        }, 1500);

        function cleanup() {
          window.clearTimeout(timeout);
          document.removeEventListener("click", handleClick, true);
          mountObserver.disconnect();
          longTaskObserver.disconnect();
          layoutShiftObserver.disconnect();
        }

        function handleClick(event: MouseEvent) {
          const target = event.target;
          if (
            clickedAt !== null ||
            !(target instanceof Element) ||
            !target.closest('[data-open-provider-configure="true"]')
          ) {
            return;
          }
          clickedAt = performance.now();
          previous = clickedAt;

          const sample = (now: number) => {
            intervals.push(now - previous);
            previous = now;
            if (now - clickedAt! < 700) {
              requestAnimationFrame(sample);
              return;
            }

            cleanup();
            if (mountedAt === null) {
              reject(new Error("Provider configure surface never mounted"));
              return;
            }
            const sorted = [...intervals].sort((a, b) => a - b);
            const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
            resolve({
              clickToMount: mountedAt - clickedAt!,
              frames: intervals.length,
              p95: sorted[p95Index] ?? 0,
              maxInterval: Math.max(...intervals),
              maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
              layoutShift,
            });
          };
          requestAnimationFrame(sample);
        }

        document.addEventListener("click", handleClick, true);
      })
  );
}
```

- [ ] **Step 2: Write the provider transition test**

Add one test that navigates through visible controls:

```ts
test("AI provider configure transition stays within mobile frame budgets", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("button", { name: /AI 服务商/ }).click();
  const add = page.getByRole("button", { name: "添加 AI 服务商" });
  await expect(add).toBeVisible();

  const metricsPromise = collectProviderTransitionMetrics(page);
  await page.waitForTimeout(40);
  await add.click();
  const metrics = await metricsPromise;

  await expect(page.locator('[data-provider-configure="true"]')).toBeVisible();
  await expect(page.locator('[data-provider-preset-grid="true"]')).toBeVisible();
  await testInfo.attach("ai-provider-transition.json", {
    body: JSON.stringify({ project: testInfo.project.name, ...metrics }, null, 2),
    contentType: "application/json",
  });

  expect(metrics.clickToMount).toBeLessThanOrEqual(34);
  expect(metrics.frames).toBeGreaterThanOrEqual(40);
  expect(metrics.p95).toBeLessThanOrEqual(20);
  expect(metrics.maxInterval).toBeLessThanOrEqual(34);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
});
```

- [ ] **Step 3: Add a separate layout and accessibility test**

Use a fresh Playwright context for a second test. Navigate through the same
visible settings/provider/add controls, then assert exactly five preset
buttons, every preset inside the horizontal viewport, persistent `名称`, `API
Key`, and `API 地址` labels, a sticky save region, and `aria-pressed`. Add
`html { font-size: 200% !important; }`, verify both root and body overflow are
at most one pixel, and attach the 200% screenshot. Keep this separate from the
cold timing case so text-scale inspection cannot warm its destination.

- [ ] **Step 4: Run the focused browser test and retain the RED baseline**

Run once, without retry or Playwright trace recording:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "AI provider configure transition" --workers=1 --retries=0 --trace=off
```

Expected: FAIL because the destination lacks the approved picker/configure
locators. Preserve and report any timing metrics the red run produces; do not
rerun merely to replace an unfavorable sample.

- [ ] **Step 5: Commit the browser regression**

```powershell
git add e2e/native-navigation.spec.ts
git commit -m "test: cover provider configuration transition"
```

### Task 4: Implement the compact provider configuration surface

**Files:**
- Modify: `app/AiSettingsSurface.tsx`
- Modify: `app/page.module.css`
- Test: `lib/aiSettingsSheetIntegration.test.ts`

- [ ] **Step 1: Add compact labels and destination metadata**

At module scope add a typed display-name map without changing provider data:

```ts
const PROVIDER_COMPACT_LABEL: Record<Exclude<AiProviderKind, "custom">, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  xai: "xAI",
};
```

Mark the configure root:

```tsx
<div
  className={styles.providerPushedSurface}
  data-provider-configure={mode === "configure" ? "true" : undefined}
>
```

- [ ] **Step 2: Replace tall preset rows with the compact picker**

Render the presets in a native-button grid:

```tsx
<div
  className={styles.providerPresetGrid}
  data-provider-preset-grid="true"
>
  {AI_PROVIDER_PRESETS.map((preset) => {
    const selected = draft.kind === preset.kind;
    return (
      <button
        key={preset.kind}
        type="button"
        className={styles.providerPresetButton}
        aria-pressed={selected}
        data-selected={selected ? "true" : undefined}
        onClick={() => changeProviderKind(preset.kind)}
      >
        <span className={`${styles.providerChoiceIcon} ${styles[`providerIcon${preset.kind}`]}`}>
          {preset.iconLabel}
        </span>
        <span className={styles.providerPresetName}>
          {PROVIDER_COMPACT_LABEL[preset.kind]}
        </span>
        <span className={styles.providerPresetCheck} aria-hidden="true">
          {selected ? "✓" : ""}
        </span>
      </button>
    );
  })}
</div>
```

- [ ] **Step 3: Group the connection fields with persistent labels**

Use one `providerConnectionCard`. Each wrapping label contains a visible
`providerFieldLabel` span and the existing controlled input. Keep the current
input types, values, handlers, placeholders, and path switch/static row exactly
on their existing data paths.

```tsx
<div className={styles.providerConnectionCard}>
  <label className={styles.providerField}>
    <span className={styles.providerFieldLabel}>名称</span>
    <input
      value={draft.label}
      onChange={(event) => updateDraft({ label: event.target.value })}
      placeholder="例如：DeepSeek"
    />
  </label>
  <label className={styles.providerField}>
    <span className={styles.providerFieldLabel}>API Key</span>
    <input
      value={draft.apiKey}
      onChange={(event) => updateDraft({ apiKey: event.target.value })}
      placeholder="sk-..."
      type="password"
      autoComplete="off"
    />
  </label>
  <label className={styles.providerField}>
    <span className={styles.providerFieldLabel}>API 地址</span>
    <input
      value={draft.baseUrl}
      onChange={(event) => updateDraft({ baseUrl: event.target.value })}
      placeholder="https://api.example.com"
      inputMode="url"
    />
  </label>
  {draft.protocol ? (
    <label className={styles.providerSwitchRow}>
      <span>自动附加 {draft.defaultPath}</span>
      <input
        type="checkbox"
        className={styles.iosSwitch}
        checked={draft.appendDefaultPath}
        onChange={(event) => toggleAppendDefaultPath(event.target.checked)}
      />
    </label>
  ) : (
    <div className={styles.providerStaticRow}>
      <strong>路径</strong>
      <span>选择服务商后设置</span>
    </div>
  )}
</div>
```

- [ ] **Step 4: Add the sticky primary action region**

Keep delete in normal document flow, then render:

```tsx
<div className={styles.providerStickyActions}>
  <button
    type="button"
    className={styles.providerPrimaryButton}
    onClick={saveDraft}
    disabled={!canSave}
  >
    保存并使用
  </button>
</div>
```

- [ ] **Step 5: Implement the approved CSS**

Implement these core declarations, then retain the existing provider theme
icon colors and model-row styles:

```css
.providerConfigureStack {
  display: grid;
  gap: 24px;
}

.providerPresetGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.providerPresetButton {
  min-width: 0;
  min-height: 58px;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 13px;
  color: var(--text-primary);
  background: var(--surface-primary);
  transform: translate3d(0, 0, 0);
  transition: background var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.providerPresetButton[data-selected="true"] {
  border-color: color-mix(in srgb, var(--tint) 32%, transparent);
  background: color-mix(in srgb, var(--tint) 9%, var(--surface-primary));
}

.providerPresetName {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.9375rem;
  line-height: 1.2;
  font-weight: 600;
  text-align: left;
}

.providerConnectionCard {
  overflow: hidden;
  border-radius: var(--list-radius);
  background: var(--surface-primary);
}

.providerField {
  min-height: 68px;
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 9px 16px;
  border-bottom: 0.5px solid var(--hairline);
}

.providerFieldLabel {
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.2;
  font-weight: 600;
}

.providerField input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text-primary);
  background: transparent;
  font-size: 1rem;
  line-height: 1.35;
}

.providerStickyActions {
  position: sticky;
  z-index: 3;
  bottom: calc(-24px - var(--safe-bottom));
  margin: 28px -20px calc(-24px - var(--safe-bottom));
  padding: 12px 20px calc(12px + var(--safe-bottom));
  border-top: 0.5px solid var(--hairline);
  background: var(--app-bg);
}

.providerStickyActions .providerPrimaryButton {
  margin-top: 0;
}

@media (max-width: 340px) {
  .providerPresetGrid {
    grid-template-columns: 1fr;
  }
}
```

Add press transforms only to `providerPresetButton` and its icon/check, and
set those transitions to `none` in the existing reduced-motion media query.

- [ ] **Step 6: Run the focused unit test GREEN**

```powershell
npm.cmd run test -- lib/aiSettingsSheetIntegration.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit the provider surface**

```powershell
git add app/AiSettingsSurface.tsx app/page.module.css lib/aiSettingsSheetIntegration.test.ts
git commit -m "style: polish AI provider configuration"
```

### Task 5: Replace navigation brightness filters with an opacity depth layer

**Files:**
- Modify: `app/NavigationStack.tsx`
- Modify: `app/page.module.css`
- Test: `lib/pushSurfaceMotionIntegration.test.ts`

- [ ] **Step 1: Introduce one depth opacity constant and edge transform**

Add:

```ts
const PUSH_DEPTH_OPACITY = 0.06;
```

Replace each `edgePreviousBrightness` with:

```ts
const edgePreviousOverlayOpacity = useTransform(
  edgeBackProgress,
  [0, 1],
  [PUSH_DEPTH_OPACITY, 0]
);
```

- [ ] **Step 2: Remove every push/root `filter` animation**

Keep the existing `x` values and spring/gesture-settle timing. Remove filter
from normal, tracking, and settling `animate`/`style` objects in both
`NavigationRoot` and `PushLayer`.

- [ ] **Step 3: Render the dedicated overlay in both depth-capable layers**

Inside the root parallax layer and every push surface, render a pointer-inert
motion div:

```tsx
<m.div
  className={styles.pushDepthOverlay}
  aria-hidden="true"
  initial={false}
  animate={{
    opacity: reduceMotion || pushDepth === 0 ? 0 : PUSH_DEPTH_OPACITY,
  }}
  transition={reduceMotion ? { duration: 0 } : MOTION_SPRING.navigation}
/>
```

For `PushLayer`, derive opacity from `top`, `distanceFromTop`, tracking, and
settling state; use `edgePreviousOverlayOpacity` while edge-back tracks the
previous surface. The top interactive surface always has opacity zero.

- [ ] **Step 4: Add the static overlay CSS**

```css
.pushDepthOverlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: rgba(0, 0, 0, 1);
  opacity: 0;
}
```

Keep content interaction below the overlay only while that surface is already
inert. Ensure the edge-back gesture region remains above it. Add
`transition: none` in the existing reduced-motion media query.

- [ ] **Step 5: Run the focused motion test GREEN**

```powershell
npm.cmd run test -- lib/pushSurfaceMotionIntegration.test.ts
```

Expected: all tests pass and `NavigationStack.tsx` contains no `filter:` motion
property.

- [ ] **Step 6: Run existing navigation/motion regressions**

```powershell
npm.cmd run test -- lib/navigationMotion.test.ts lib/navigationGestures.test.ts lib/motionCss.test.ts lib/motionRoleParity.test.ts
```

Expected: all tests pass without threshold or timing changes.

- [ ] **Step 7: Commit the transition implementation**

```powershell
git add app/NavigationStack.tsx app/page.module.css lib/pushSurfaceMotionIntegration.test.ts
git commit -m "perf: remove filters from push transitions"
```

### Task 6: Verify visual quality, accessibility, and frame evidence

**Files:**
- Modify after a failing visual/accessibility assertion: `app/AiSettingsSurface.tsx`
- Modify after a failing visual/accessibility assertion: `app/page.module.css`
- Modify after a demonstrated harness defect: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Run focused unit coverage**

```powershell
npm.cmd run test -- lib/aiSettingsSheetIntegration.test.ts lib/pushSurfaceMotionIntegration.test.ts lib/navigationMotion.test.ts lib/navigationGestures.test.ts lib/motionCss.test.ts lib/motionRoleParity.test.ts
```

- [ ] **Step 2: Run the exact iPhone 14 cold path once**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "AI provider configure transition" --workers=1 --retries=0 --trace=off
```

Retain the output and attachment. Do not rerun to replace a failure.

- [ ] **Step 3: Run the exact iPhone 15 Pro Max cold path once**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max --grep "AI provider configure transition" --workers=1 --retries=0 --trace=off
```

Retain the output and attachment. Do not rerun to replace a failure.

- [ ] **Step 4: Inspect screenshots at original resolution**

Review Light, Dark, Sepia, system-dark, and 200% text evidence. Check safe-area
spacing, header centering, picker selection, field labels, URL wrapping,
software-keyboard access, sticky action occlusion, destructive-action spacing,
contrast, and horizontal overflow.

- [ ] **Step 5: Run Impeccable detection**

```powershell
node C:\aaa\.agents\skills\impeccable\scripts\detect.mjs --json app\AiSettingsSurface.tsx app\NavigationStack.tsx app\page.module.css
```

Expected: JSON `[]`. Resolve relevant findings without broad unrelated
redesign.

- [ ] **Step 6: Commit only evidence-driven corrections**

Stage the exact corrected source/tests, inspect the staged diff, and commit:

```powershell
git commit -m "fix: harden provider configuration polish"
```

Skip this commit if no correction is needed.

### Task 7: Complete repository verification and handoff

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the complete local gates**

```powershell
npm.cmd audit --omit=dev --audit-level=high
npm.cmd test
npm.cmd run lint
npm.cmd run build
git diff --check
git status -sb
```

Expected: zero production vulnerabilities, all tests pass, ESLint exits zero,
Next production build succeeds, no whitespace errors, and only intentional
handoff changes remain.

- [ ] **Step 2: Run the broader native-navigation regression once per profile**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --workers=1 --retries=0 --trace=off
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max --workers=1 --retries=0 --trace=off
```

Report every observed failure exactly; do not claim unrelatedness without
evidence and do not change thresholds after results.

- [ ] **Step 3: Update the handoff**

Record the design/plan/product commits, red-green evidence, exact performance
metrics, visual checks, full gates, any retained failures, branch publication
state, and the fact that Chromium does not prove physical 120fps.

- [ ] **Step 4: Commit the handoff**

```powershell
git add HANDOFF.md
git commit -m "docs: record provider configuration polish"
```

- [ ] **Step 5: Confirm final repository state**

```powershell
git status -sb
git log -8 --oneline --decorate
```

Do not push, merge `main`, or deploy production without explicit user
authorization for those publication actions.
