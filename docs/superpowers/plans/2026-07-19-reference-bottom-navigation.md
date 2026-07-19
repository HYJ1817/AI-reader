# Reference Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wide root tab bar with the approved 302 px theme-aware frosted pill, violet moving icon backing, solid gear icon, and a transform-only 420 ms selection transition.

**Architecture:** Preserve `AppNavigation` as the only root-navigation component and keep the existing navigation reducer, handlers, visibility rules, and persistent Motion indicator. Add dedicated root-tab appearance tokens to the existing theme definitions and a dedicated TypeScript transition token so the slower indicator does not alter page, reader, or sheet motion. Extend the existing chrome unit tests and mobile navigation Playwright coverage rather than creating a second navigation system.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Motion 12, Vitest, Playwright.

---

## File Map

- Modify `lib/motionSystem.ts`: own the 420 ms root-tab transition token.
- Modify `lib/motionSystem.test.ts`: lock the duration, easing, and zero-bounce tween contract.
- Modify `app/globals.css`: define Light, Sepia, and Dark root-tab material tokens.
- Modify `app/page.module.css`: implement centered geometry, frosted material, violet backing, icon sizing, press feedback, hiding, focus, and reduced-motion rules.
- Modify `app/AppNavigation.tsx`: consume the dedicated transition, expose stable test hooks, and replace Settings sliders with the filled gear SVG.
- Modify `lib/navigationChrome.test.ts`: lock geometry, theme tokens, active backing, gear, semantics, and non-animated material.
- Modify `lib/motionCss.test.ts`: assert that the root indicator uses its dedicated transition rather than the shared page-navigation spring.
- Modify `lib/persistentSurfaces.test.ts`: preserve the one-indicator assertion while expecting the dedicated root-tab transition.
- Modify `e2e/native-navigation.spec.ts`: verify both iPhone profiles, themes, exact geometry, gear/selection states, rapid retargeting, reduced motion, and frame/long-task/layout-shift budgets.
- Modify `HANDOFF.md`: record implementation commits, verification, and the physical 120 Hz non-blocking acceptance item.

### Task 1: Add the Dedicated Root-Tab Motion Contract

**Files:**
- Modify: `lib/motionSystem.test.ts`
- Modify: `lib/motionSystem.ts`

- [ ] **Step 1: Write the failing transition-token test**

Add `ROOT_TAB_TRANSITION` to the import and extend the duration table assertion:

```ts
import {
  MOTION_DURATION,
  MOTION_SPRING,
  REDUCED_MOTION_QUERY,
  ROOT_TAB_TRANSITION,
  createSystemMotionPreferenceStore,
  getMotionPolicy,
  getReaderTransitionTiming,
} from "./motionSystem";

expect(MOTION_DURATION).toMatchObject({
  press: 0.12,
  state: 0.2,
  rootTab: 0.42,
  pushEnter: 0.34,
  pushExit: 0.24,
  readerEnter: 0.3,
  readerExit: 0.22,
  sheetEnter: 0.3,
  sheetExit: 0.25,
  chromeEnter: 0.2,
  chromeExit: 0.16,
  gestureSettle: 0.22,
  reduced: 0.12,
});
```

Add a focused test below the duration table test:

```ts
it("uses a slow zero-bounce transform tween for the root tab indicator", () => {
  expect(ROOT_TAB_TRANSITION).toEqual({
    type: "tween",
    duration: 0.42,
    ease: [0.22, 1, 0.36, 1],
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```powershell
npm.cmd run test -- lib/motionSystem.test.ts
```

Expected: FAIL because `ROOT_TAB_TRANSITION` and `MOTION_DURATION.rootTab` do not exist.

- [ ] **Step 3: Implement the motion token**

Add the duration to `MOTION_DURATION` after `tab`:

```ts
export const MOTION_DURATION = {
  press: 0.12,
  state: 0.2,
  tab: 0.26,
  rootTab: 0.42,
  pushEnter: 0.34,
  // existing roles remain unchanged
} as const;
```

Add this export before `MOTION_SPRING`:

```ts
export const ROOT_TAB_TRANSITION = {
  type: "tween" as const,
  duration: MOTION_DURATION.rootTab,
  ease: [0.22, 1, 0.36, 1] as const,
} as const;
```

Do not modify `MOTION_SPRING.navigation`; page and stack transitions still use it.

- [ ] **Step 4: Run the focused test and verify green**

Run:

```powershell
npm.cmd run test -- lib/motionSystem.test.ts
```

Expected: the complete `motionSystem.test.ts` file passes.

- [ ] **Step 5: Commit the isolated motion contract**

```powershell
git add -- lib/motionSystem.ts lib/motionSystem.test.ts
git commit -m "feat: add root tab motion timing"
```

### Task 2: Reshape the Frosted Navigation and Replace Settings with the Gear

**Files:**
- Modify: `lib/navigationChrome.test.ts`
- Modify: `lib/motionCss.test.ts`
- Modify: `lib/persistentSurfaces.test.ts`
- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Modify: `app/AppNavigation.tsx`

- [ ] **Step 1: Expand the chrome tests with the approved contract**

Read `app/globals.css` in `navigationChrome.test.ts`:

```ts
const globalsCss = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);

function globalRule(selector: string): string {
  const start = globalsCss.indexOf(`${selector} {`);
  const end = globalsCss.indexOf("}", start);
  return start < 0 || end < 0 ? "" : globalsCss.slice(start, end);
}
```

Update the safe-area test to require the new dimensions:

```ts
expect(appRule).toContain("--root-tab-height: 76px");
expect(appRule).toContain("--root-tab-offset: 8px");
expect(barRule).toContain("width: min(302px, calc(100vw - 32px))");
expect(barRule).toContain("left: 50%");
expect(barRule).toContain("right: auto");
expect(barRule).toContain("bottom: calc(var(--safe-bottom) + var(--root-tab-offset))");
expect(barRule).toContain("height: var(--root-tab-height)");
expect(barRule).toContain("transform: translate3d(-50%, 0, 0)");
```

Replace the obsolete “small moving line” test with:

```ts
it("uses one theme-aware frosted pill and one violet icon backing", () => {
  const barRule = cssRule(".tabBar");
  const trackRule = cssRule(".tabIndicator");
  const backingRule = cssRule(".tabIndicator::after");
  const solidIconRule = cssRule(".tabIconSolid");

  expect(barRule).toContain("border-radius: 33px");
  expect(barRule).toContain("padding: 3px 16px 5px");
  expect(barRule).toContain("background: var(--root-tab-fill)");
  expect(barRule).toContain("backdrop-filter: blur(14px) saturate(112%)");
  expect(barRule).toContain("border: 0.5px solid var(--root-tab-border)");
  expect(barRule).toContain("box-shadow: var(--root-tab-shadow)");
  expect(trackRule).toContain("width: calc((100% - 32px) / 3)");
  expect(trackRule).toContain("height: 31px");
  expect(backingRule).toContain("width: 31px");
  expect(backingRule).toContain("height: 31px");
  expect(backingRule).toContain("border-radius: 10px");
  expect(backingRule).toContain("background: var(--root-tab-accent)");
  expect(backingRule).not.toContain("height: 2px");
  expect(solidIconRule).toContain("fill: currentColor");
});
```

Add theme token assertions:

```ts
it("defines readable frosted materials for every explicit appearance", () => {
  for (const selector of [
    ":root",
    '[data-reader-theme="light"]',
    '[data-reader-theme="sepia"]',
    '[data-reader-theme="dark"]',
  ]) {
    const rule = globalRule(selector);
    expect(rule).toContain("--root-tab-fill:");
    expect(rule).toContain("--root-tab-border:");
    expect(rule).toContain("--root-tab-shadow:");
    expect(rule).toContain("--root-tab-content:");
  }
  expect(globalRule(":root")).toContain("--root-tab-accent: #7d55e7");
  expect(globalRule(":root")).toContain("--root-tab-active-icon: #ffffff");
});
```

Extend the source contract:

```ts
expect(navigationSource).toContain("ROOT_TAB_TRANSITION");
expect(navigationSource).toContain('data-root-tab-indicator="true"');
expect(navigationSource).toContain('data-root-tab-gear="true"');
expect(navigationSource).toContain("fillRule=\"evenodd\"");
expect(navigationSource).toContain("clipRule=\"evenodd\"");
expect(navigationSource).toContain("styles.tabIconSolid");
expect(navigationSource).not.toContain("MOTION_SPRING.navigation");
```

In `motionCss.test.ts`, replace the root-tab source assertion with:

```ts
expect(appNavigationSource).toContain("ROOT_TAB_TRANSITION");
expect(appNavigationSource).not.toContain("MOTION_SPRING.navigation");
```

In `persistentSurfaces.test.ts`, replace the corresponding root-tab assertion with:

```ts
expect(navigationSource).toContain("ROOT_TAB_TRANSITION");
expect(navigationSource).not.toContain("MOTION_SPRING.navigation");
```

Leave every `NavigationStack` and page-transition spring assertion unchanged.

- [ ] **Step 2: Run the focused contract tests and verify red**

Run:

```powershell
npm.cmd run test -- lib/navigationChrome.test.ts lib/motionCss.test.ts lib/persistentSurfaces.test.ts
```

Expected: FAIL on the old 60 px/full-width geometry, missing theme tokens, old line indicator, missing gear marker, and shared spring use.

- [ ] **Step 3: Add root-tab material tokens to every appearance**

Add these tokens to `:root` and `[data-reader-theme="light"]`:

```css
--root-tab-fill: rgba(255, 255, 255, 0.68);
--root-tab-border: rgba(60, 60, 67, 0.14);
--root-tab-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
--root-tab-content: #6e6e73;
--root-tab-accent: #7d55e7;
--root-tab-active-icon: #ffffff;
```

Add these tokens to Sepia:

```css
--root-tab-fill: rgba(244, 236, 216, 0.68);
--root-tab-border: rgba(92, 74, 46, 0.16);
--root-tab-shadow: 0 3px 8px rgba(72, 52, 24, 0.11);
--root-tab-content: #786a55;
```

Add these tokens to Dark:

```css
--root-tab-fill: rgba(44, 44, 46, 0.72);
--root-tab-border: rgba(255, 255, 255, 0.1);
--root-tab-shadow: 0 3px 8px rgba(0, 0, 0, 0.24);
--root-tab-content: #aeaeb2;
```

Sepia and Dark inherit the violet accent and white active icon from `:root`.

- [ ] **Step 4: Implement the exact pill, backing, and state CSS**

Change `--root-tab-height` to `76px`, then replace the root tab rules with the following contract while preserving the existing z-index and visibility semantics:

```css
.tabBar {
  display: flex;
  position: fixed;
  left: 50%;
  right: auto;
  bottom: calc(var(--safe-bottom) + var(--root-tab-offset));
  width: min(302px, calc(100vw - 32px));
  height: var(--root-tab-height);
  box-sizing: border-box;
  padding: 3px 16px 5px;
  border-radius: 33px;
  overflow: hidden;
  isolation: isolate;
  background: var(--root-tab-fill);
  backdrop-filter: blur(14px) saturate(112%);
  -webkit-backdrop-filter: blur(14px) saturate(112%);
  border: 0.5px solid var(--root-tab-border);
  box-shadow: var(--root-tab-shadow);
  color: var(--root-tab-content);
  z-index: 10;
  transform: translate3d(-50%, 0, 0);
  transition:
    opacity var(--motion-standard) var(--ease-standard),
    transform var(--motion-sheet) var(--ease-emphasized);
}

.tabIndicator {
  position: absolute;
  z-index: 0;
  top: 13px;
  left: 16px;
  width: calc((100% - 32px) / 3);
  height: 31px;
  background: transparent;
  pointer-events: none;
}

.tabIndicator::after {
  content: "";
  position: absolute;
  inset: 0 auto auto 50%;
  width: 31px;
  height: 31px;
  border-radius: 10px;
  background: var(--root-tab-accent);
  box-shadow: 0 2px 5px rgba(70, 38, 158, 0.38);
  transform: translateX(-50%);
}

.tabBarReadingHidden {
  opacity: 0;
  transform: translate3d(-50%, 100%, 0);
  pointer-events: none;
}

.tab {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  min-height: 44px;
  height: 68px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 0;
  border-radius: 16px;
  color: var(--root-tab-content);
  font-size: var(--type-caption);
  font-weight: 500;
  transform: translate3d(0, 0, 0);
  transition:
    color var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.tabIcon {
  width: 21px;
  height: 21px;
  display: block;
  overflow: visible;
  transform: scale(1);
  transition: transform var(--motion-fast) var(--ease-standard);
}

.tabIconSolid {
  fill: currentColor;
}

.activeTab {
  color: var(--text-primary);
  font-weight: 600;
}

.activeTab .tabIcon {
  color: var(--root-tab-active-icon);
  transform: translate3d(0, -1px, 0) scale(1.04);
}
```

Keep the existing 0.96 pressed destination scale. Update active hover to retain `var(--text-primary)` instead of the reader tint. In both the app-driven reduced-motion block and the media-query block, ensure `.tab`, `.tabIcon`, and `.tabLabel` have no transform animation and no active/pressed transform.

Use these explicit overrides:

```css
.tab.activeTab:hover {
  color: var(--text-primary);
}

.app[data-reduce-motion="true"] .tab,
.app[data-reduce-motion="true"] .tabIcon,
.app[data-reduce-motion="true"] .tabLabel,
.app[data-reduce-motion="true"] .activeTab .tabIcon,
.app[data-reduce-motion="true"] .activeTab .tabLabel,
.app[data-reduce-motion="true"] .tab:not(:disabled):active,
.app[data-reduce-motion="true"] .tab:not(:disabled):active .tabIcon,
.app[data-reduce-motion="true"] .tab:not(:disabled):active .tabLabel {
  transition: none;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .tab,
  .tabIcon,
  .tabLabel,
  .activeTab .tabIcon,
  .activeTab .tabLabel,
  .tab:not(:disabled):active,
  .tab:not(:disabled):active .tabIcon,
  .tab:not(:disabled):active .tabLabel {
    transition: none;
    transform: none;
  }
}
```

- [ ] **Step 5: Wire the dedicated transition and replace the Settings SVG**

In `AppNavigation.tsx`, import `ROOT_TAB_TRANSITION` instead of `MOTION_SPRING` for the indicator:

```ts
import {
  MOTION_DURATION,
  ROOT_TAB_TRANSITION,
} from "@/lib/motionSystem";
```

Give the indicator a stable hook and use the transition:

```tsx
<m.span
  className={styles.tabIndicator}
  data-root-tab-indicator="true"
  layoutId="root-tab-indicator"
  initial={false}
  animate={{ x: `${getNavigationTabIndex(activeTab) * 100}%` }}
  transition={reduceMotion ? { duration: 0 } : ROOT_TAB_TRANSITION}
  aria-hidden="true"
/>
```

Replace the Settings SVG contents with the approved one-path gear. Keep the existing `viewBox`, icon class, and `aria-hidden`:

```tsx
<svg
  className={styles.tabIcon}
  data-root-tab-gear="true"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <path
    className={styles.tabIconSolid}
    fillRule="evenodd"
    clipRule="evenodd"
    d="M9.55 2.3a1.55 1.55 0 0 1 1.5-1.18h1.9a1.55 1.55 0 0 1 1.5 1.18l.34 1.35c.43.18.84.42 1.22.7l1.32-.4a1.55 1.55 0 0 1 1.75.68l.95 1.65a1.55 1.55 0 0 1-.25 1.86l-.99.96c.06.47.06.94 0 1.41l.99.96c.5.49.61 1.25.25 1.86l-.95 1.65a1.55 1.55 0 0 1-1.75.68l-1.32-.4c-.38.28-.79.52-1.22.7l-.34 1.35a1.55 1.55 0 0 1-1.5 1.18h-1.9a1.55 1.55 0 0 1-1.5-1.18l-.34-1.35a7.2 7.2 0 0 1-1.22-.7l-1.32.4a1.55 1.55 0 0 1-1.75-.68l-.95-1.65a1.55 1.55 0 0 1 .25-1.86l.99-.96a5.7 5.7 0 0 1 0-1.41l-.99-.96a1.55 1.55 0 0 1-.25-1.86l.95-1.65a1.55 1.55 0 0 1 1.75-.68l1.32.4c.38-.28.79-.52 1.22-.7l.34-1.35ZM12 14.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"
  />
</svg>
```

- [ ] **Step 6: Run focused tests and correct only contract mismatches**

Run:

```powershell
npm.cmd run test -- lib/motionSystem.test.ts lib/navigationChrome.test.ts lib/motionCss.test.ts lib/persistentSurfaces.test.ts lib/navigationVisibility.test.ts lib/ambientBookBackground.test.ts
```

Expected: all listed files pass. If the CSS parser helper exposes a missing declaration, fix the selector named by the failure; do not relax the approved values.

- [ ] **Step 7: Run lint and a production type/build check**

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: ESLint exits 0; Next.js webpack compilation, TypeScript, and static generation pass.

- [ ] **Step 8: Commit the complete component change**

```powershell
git add -- app/AppNavigation.tsx app/globals.css app/page.module.css lib/navigationChrome.test.ts lib/motionCss.test.ts lib/persistentSurfaces.test.ts
git commit -m "style: match reference bottom navigation"
```

### Task 3: Extend Mobile Browser and Performance Coverage

**Files:**
- Modify: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Update the root-chrome geometry and icon assertions**

In the existing `root chrome stays compact, semantic, and safely tappable` test, replace the old line metrics with backing and bar metrics:

```ts
const geometry = await navigation.evaluate((element) => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const prefixed = style as CSSStyleDeclaration & {
    webkitBackdropFilter?: string;
  };
  const tabs = Array.from(
    element.querySelectorAll<HTMLElement>("[data-navigation-tab]")
  ).map((tab) => {
    const tabRect = tab.getBoundingClientRect();
    return { width: tabRect.width, height: tabRect.height };
  });
  const indicator = element.querySelector<HTMLElement>(
    '[data-root-tab-indicator="true"]'
  );
  const backing = indicator ? getComputedStyle(indicator, "::after") : null;
  return {
    width: rect.width,
    height: rect.height,
    centerError: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2),
    bottomGap: window.innerHeight - rect.bottom,
    borderRadius: style.borderRadius,
    backdropFilter: style.backdropFilter || prefixed.webkitBackdropFilter || "",
    tabs,
    backingWidth: backing?.width,
    backingHeight: backing?.height,
    backingRadius: backing?.borderRadius,
    backingColor: backing?.backgroundColor,
  };
});

expect(geometry.width).toBeLessThanOrEqual(302.5);
expect(geometry.height).toBe(76);
expect(geometry.centerError).toBeLessThanOrEqual(0.5);
expect(geometry.bottomGap).toBeGreaterThanOrEqual(8);
expect(geometry.borderRadius).toBe("33px");
expect(geometry.backdropFilter).toContain("blur(14px)");
expect(geometry.backingWidth).toBe("31px");
expect(geometry.backingHeight).toBe("31px");
expect(geometry.backingRadius).toBe("10px");
expect(geometry.backingColor).toBe("rgb(125, 85, 231)");
for (const rect of geometry.tabs) {
  expect(rect.width).toBeGreaterThanOrEqual(44);
  expect(rect.height).toBeGreaterThanOrEqual(44);
}
await expect(navigation.locator('[data-root-tab-gear="true"]')).toHaveCount(1);
```

At the start of the test, force the Light appearance so color assertions do not depend on the host operating-system preference:

```ts
await page.locator('[data-app-shell="true"]').evaluate((element) => {
  element.setAttribute("data-reader-theme", "light");
});
```

Replace each old blue `--tint` assertion with the selected label and icon contract. Use the matching destination after each click:

```ts
const activeTab = navigation.locator('[aria-current="page"]');
await expect(activeTab).toHaveCSS("color", "rgb(5, 5, 5)");
await expect(activeTab.locator("svg")).toHaveCSS("color", "rgb(255, 255, 255)");
```

Do not retain any assertion for the old 24 px by 2 px line.

- [ ] **Step 2: Add a theme-material browser case**

Add a test that sets the app theme attribute and records computed materials:

```ts
test("root navigation follows light, sepia, and dark frosted materials", async ({
  page,
}) => {
  const app = page.locator('[data-app-shell="true"]');
  const navigation = page.getByRole("navigation", { name: "主要导航" });
  const materials: Record<string, { background: string; content: string }> = {};

  for (const theme of ["light", "sepia", "dark"] as const) {
    await app.evaluate((element, value) => {
      element.setAttribute("data-reader-theme", value);
    }, theme);
    materials[theme] = await navigation.evaluate((element, value) => {
      const style = getComputedStyle(element);
      const prefixed = style as CSSStyleDeclaration & {
        webkitBackdropFilter?: string;
      };
      const backdrop = style.backdropFilter || prefixed.webkitBackdropFilter || "";
      if (!backdrop.includes("blur(14px)")) {
        throw new Error(`missing navigation blur for ${value}`);
      }
      return {
        background: style.backgroundColor,
        content: style.color,
      };
    }, theme);
  }

  expect(new Set(Object.values(materials).map((item) => item.background)).size).toBe(3);
  expect(materials.light.background).toContain("255, 255, 255");
  expect(materials.sepia.background).toContain("244, 236, 216");
  expect(materials.dark.background).toContain("44, 44, 46");
});
```

- [ ] **Step 3: Add rapid-retarget and reduced-motion assertions**

Add a focused test that confirms only one indicator exists and the final transform reaches Settings after a Library → Reading → Settings burst:

```ts
test("root tab indicator retargets one transform layer and respects reduced motion", async ({
  page,
}) => {
  const navigation = page.getByRole("navigation", { name: "主要导航" });
  const indicator = navigation.locator('[data-root-tab-indicator="true"]');
  await expect(indicator).toHaveCount(1);

  await navigation.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(100);
  const midX = await indicator.evaluate((element) =>
    new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
  );
  await navigation.locator('[data-navigation-tab="settings"]').click();
  await expect
    .poll(() =>
      indicator.evaluate((element) =>
        new DOMMatrixReadOnly(getComputedStyle(element).transform).m41
      )
    )
    .toBeGreaterThan(midX);
  await expect(
    navigation.locator('[data-navigation-tab="settings"]')
  ).toHaveAttribute("aria-current", "page");
  await expect(indicator).toHaveCount(1);

  await page.evaluate(() => {
    const raw = localStorage.getItem("ai-reader-app-preferences");
    const prefs = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      "ai-reader-app-preferences",
      JSON.stringify({ ...prefs, reduceMotion: true })
    );
  });
  await page.reload();
  const reducedNav = page.getByRole("navigation", { name: "主要导航" });
  await expect(reducedNav).toBeVisible();
  await reducedNav.locator('[data-navigation-tab="reading"]').click();
  await expect(
    reducedNav.locator('[data-navigation-tab="reading"]')
  ).toHaveAttribute("aria-current", "page");
  const reducedIndicator = reducedNav.locator(
    '[data-root-tab-indicator="true"]'
  );
  const reducedGeometry = await reducedIndicator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return {
      x: transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41,
      slotWidth: element.getBoundingClientRect().width,
    };
  });
  expect(
    Math.abs(reducedGeometry.x - reducedGeometry.slotWidth)
  ).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 4: Add a root-tab-specific performance probe**

Add this root-tab-specific test using the existing RAF/PerformanceObserver pattern:

```ts
test("root tab retargeting stays within frame and long-task budgets", async ({
  page,
}) => {
  await page.waitForTimeout(600);

  const metricsPromise = page.evaluate(async () => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let layoutShift = 0;
    let previous = performance.now();
    const observers: PerformanceObserver[] = [];

    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      observer.observe({ entryTypes: ["longtask"] });
      observers.push(observer);
    }
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput) layoutShift += shift.value ?? 0;
        }
      });
      observer.observe({ entryTypes: ["layout-shift"] });
      observers.push(observer);
    }

    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - startedAt >= 700) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    for (const observer of observers) observer.disconnect();

    const sorted = intervals.slice(2).sort((a, b) => a - b);
    const p95 = sorted[
      Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
    ];
    return {
      frames: intervals.length,
      p95,
      maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      layoutShift,
    };
  });

  const navigation = page.getByRole("navigation", { name: "主要导航" });
  await page.waitForTimeout(40);
  await navigation.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(100);
  await navigation.locator('[data-navigation-tab="settings"]').click();
  const metrics = await metricsPromise;

  expect(metrics.frames).toBeGreaterThanOrEqual(32);
  expect(metrics.p95).toBeLessThanOrEqual(20);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
});
```

This checks a stable 60 Hz automation budget; do not assert 8.33 ms in Chromium.

- [ ] **Step 5: Run the focused browser file on iPhone 14**

Start the app through the existing Playwright web-server configuration and run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
```

Expected: every native-navigation case passes, including the new chrome, theme, retargeting, reduced-motion, and performance cases.

- [ ] **Step 6: Run the focused browser file on iPhone 15 Pro Max**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
```

Expected: the same file passes at the larger viewport; the bar remains capped at 302 px and centered.

- [ ] **Step 7: Inspect generated screenshots and traces**

Open the Library, Reading, and Settings screenshots created by the existing `capture` helper. Confirm:

- the pill is visually centered;
- the material changes with the theme without losing contrast;
- the violet backing sits behind only the selected icon;
- the gear remains legible at 21 px;
- no content or batch controls are obscured;
- no intermediate trace contains a second indicator or a layout jump.

If visual inspection finds a mismatch, adjust only `AppNavigation.tsx`, the root-tab CSS, or root-tab theme tokens, then rerun Steps 5 and 6.

- [ ] **Step 8: Commit browser and performance coverage**

```powershell
git add -- e2e/native-navigation.spec.ts app/AppNavigation.tsx app/globals.css app/page.module.css
git commit -m "test: cover reference bottom navigation"
```

### Task 4: Full Verification, Handoff, and PR Update

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: Run the full unit suite**

```powershell
npm.cmd test
```

Expected: all Vitest files and tests pass with zero failures.

- [ ] **Step 2: Run lint and the production build**

```powershell
npm.cmd run lint
npm.cmd run build
```

Expected: ESLint exits 0; webpack compilation, TypeScript checking, and all static pages pass.

- [ ] **Step 3: Re-run the two-device focused browser matrix**

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
```

Expected: both projects pass all navigation cases. Record exact counts in `HANDOFF.md`.

- [ ] **Step 4: Verify repository hygiene**

```powershell
git diff --check
git status -sb
git log -8 --oneline --decorate
```

Expected: no whitespace errors; only the intended `HANDOFF.md` documentation change remains before the closeout commit.

- [ ] **Step 5: Update the handoff**

Add a dated `Reference Bottom Navigation (2026-07-19)` section to `HANDOFF.md` containing:

- the approved 302 × 76 px frosted geometry and three appearance materials;
- the persistent violet 31 px indicator and solid gear;
- the dedicated 420 ms transform tween and reduced-motion behavior;
- exact Vitest, ESLint, build, and two-device Playwright results;
- the automated P95, long-task, and layout-shift results;
- the physical 120 Hz iPhone trace as a non-blocking device acceptance item;
- explicit production status: not deployed unless the user separately authorizes deployment.

- [ ] **Step 6: Commit the verification record**

```powershell
git add -- HANDOFF.md
git commit -m "docs: record bottom navigation verification"
```

- [ ] **Step 7: Perform final clean-state verification**

```powershell
git diff --check
git status -sb
git log -5 --oneline --decorate
```

Expected: clean working tree; the branch is ahead only by the intended design, plan, implementation, tests, and handoff commits.

- [ ] **Step 8: Push the current branch and update the existing PR**

```powershell
git push -u origin codex/custom-background-settings
gh pr view 1 --json number,title,state,isDraft,url,baseRefName,headRefName,mergeStateStatus,statusCheckRollup
```

Expected: the branch push succeeds, PR #1 remains open against `main`, and the new commits appear on the PR. Do not merge or deploy in this task.
