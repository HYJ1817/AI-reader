# Transparent Bottom Navigation Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the opaque violet root-tab square with a theme-aware translucent full-tab pill while preserving the existing navigation behavior and transform-only 420ms motion.

**Architecture:** Keep the single persistent Motion indicator in `AppNavigation` and change only its theme tokens and CSS geometry/material. Test the static contract first, then extend the mobile browser assertions to cover computed geometry, four theme variants, rapid retargeting, reduced motion, layout stability, and long-task budgets.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Motion, Vitest, Playwright Chromium mobile profiles.

---

## File Structure

- Modify `app/globals.css`: replace the violet indicator token with explicit translucent active-fill and black/white active-icon tokens for Light, Sepia, Dark, and system-dark.
- Modify `app/page.module.css`: expand the existing indicator slot to 60px and render one inset 30px-radius translucent pill without shadow or blur.
- Modify `lib/navigationChrome.test.ts`: test-drive the token and CSS contract before implementation.
- Modify `e2e/native-navigation.spec.ts`: verify computed geometry, theme colors, unchanged labels, transform retargeting, reduced motion, and performance evidence in the browser.

No component, state, persistence, or navigation-handler file changes are required.

### Task 1: Test-drive the translucent indicator material

**Files:**
- Modify: `lib/navigationChrome.test.ts:90-145`
- Modify: `app/globals.css:26-31,74-77,177-182,221-224,263-266`
- Modify: `app/page.module.css:1503-1525`

- [ ] **Step 1: Replace the focused static contract with failing translucent-pill assertions**

In `lib/navigationChrome.test.ts`, replace the existing violet-backing test with:

```ts
it("uses a theme-aware frosted pill with a translucent active backing", () => {
  const barRule = cssRule(".tabBar");
  const indicatorRule = cssRule(".tabIndicator");
  const backingRule = cssRule(".tabIndicator::after");
  const solidIconRule = cssRule(".tabIconSolid");

  expect(barRule).toContain("border-radius: 33px");
  expect(barRule).toContain("padding: 3px 16px 5px");
  expect(barRule).toContain("background: var(--root-tab-fill)");
  expect(barRule).toContain("backdrop-filter: blur(14px) saturate(112%)");
  expect(barRule).toContain("border: 0.5px solid var(--root-tab-border)");
  expect(barRule).toContain("box-shadow: var(--root-tab-shadow)");
  expect(indicatorRule).toContain("top: 8px");
  expect(indicatorRule).toContain("width: calc((100% - 32px) / 3)");
  expect(indicatorRule).toContain("height: 60px");
  expect(backingRule).toContain("inset: 0 4px");
  expect(backingRule).toContain("border-radius: 30px");
  expect(backingRule).toContain("background: var(--root-tab-active-fill)");
  expect(backingRule).not.toContain("box-shadow");
  expect(backingRule).not.toContain("filter");
  expect(backingRule).not.toContain("backdrop-filter");
  expect(backingRule).not.toContain("var(--root-tab-accent)");
  expect(solidIconRule).toContain("fill: currentColor");
});
```

Replace the theme-token assertions with:

```ts
it("defines theme-specific root-tab material and selection tokens", () => {
  const rootRule = globalRule(":root");
  const lightRule = globalRule('[data-reader-theme="light"]');
  const sepiaRule = globalRule('[data-reader-theme="sepia"]');
  const darkRule = globalRule('[data-reader-theme="dark"]');

  for (const rule of [rootRule, lightRule, sepiaRule, darkRule]) {
    expect(rule).toContain("--root-tab-fill:");
    expect(rule).toContain("--root-tab-border:");
    expect(rule).toContain("--root-tab-shadow:");
    expect(rule).toContain("--root-tab-content:");
    expect(rule).toContain("--root-tab-active-fill:");
    expect(rule).toContain("--root-tab-active-icon:");
  }
  expect(rootRule).toContain(
    "--root-tab-active-fill: rgba(118, 118, 128, 0.12)"
  );
  expect(rootRule).toContain("--root-tab-active-icon: #000000");
  expect(rootRule).not.toContain("--root-tab-accent");
  expect(lightRule).toContain(
    "--root-tab-active-fill: rgba(118, 118, 128, 0.12)"
  );
  expect(lightRule).toContain("--root-tab-active-icon: #000000");
  expect(sepiaRule).toContain(
    "--root-tab-active-fill: rgba(130, 105, 66, 0.14)"
  );
  expect(sepiaRule).toContain("--root-tab-active-icon: #000000");
  expect(sepiaRule).toContain("--root-tab-content: #776953");
  expect(darkRule).toContain(
    "--root-tab-active-fill: rgba(255, 255, 255, 0.12)"
  );
  expect(darkRule).toContain("--root-tab-active-icon: #ffffff");
});
```

Extend the existing system-dark test with:

```ts
expect(systemDarkRule).toContain(
  "--root-tab-active-fill: rgba(255, 255, 255, 0.12)"
);
expect(systemDarkRule).toContain("--root-tab-active-icon: #ffffff");
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run: `npm.cmd test -- lib/navigationChrome.test.ts`

Expected: FAIL because the current CSS still has a 31px, 10px-radius violet backing, a violet shadow, and white active icons in Light.

- [ ] **Step 3: Replace the root-tab theme tokens**

In the top-level `:root` and `[data-reader-theme="light"]` blocks, replace the old accent/icon pair with:

```css
--root-tab-active-fill: rgba(118, 118, 128, 0.12);
--root-tab-active-icon: #000000;
```

In `[data-reader-theme="sepia"]`, add after `--root-tab-content`:

```css
--root-tab-active-fill: rgba(130, 105, 66, 0.14);
--root-tab-active-icon: #000000;
```

In both the system-dark `:root` block and `[data-reader-theme="dark"]`, add after `--root-tab-content`:

```css
--root-tab-active-fill: rgba(255, 255, 255, 0.12);
--root-tab-active-icon: #ffffff;
```

Remove every `--root-tab-accent` declaration. Do not change the parent navigation fill, border, shadow, content, or blur tokens.

- [ ] **Step 4: Implement the full-region transform-only indicator CSS**

Replace the indicator rules in `app/page.module.css` with:

```css
.tabIndicator {
  position: absolute;
  z-index: 0;
  top: 8px;
  left: 16px;
  width: calc((100% - 32px) / 3);
  height: 60px;
  background: transparent;
  pointer-events: none;
}

.tabIndicator::after {
  content: "";
  position: absolute;
  inset: 0 4px;
  border-radius: 30px;
  background: var(--root-tab-active-fill);
}
```

Do not add `filter`, `backdrop-filter`, `box-shadow`, `transition`, `will-change`, or an animated layout property. Keep `AppNavigation.tsx` and `ROOT_TAB_TRANSITION` unchanged so Motion continues to animate only `x`.

- [ ] **Step 5: Run focused navigation and motion tests**

Run: `npm.cmd test -- lib/navigationChrome.test.ts lib/navigationMotion.test.ts lib/motionCss.test.ts`

Expected: all selected Vitest files and tests PASS; the navigation test proves the new token/material contract and the motion tests preserve the 420ms transform tween.

- [ ] **Step 6: Check the implementation diff and commit**

Run these commands in order:

```powershell
git diff --check
git diff -- app/globals.css app/page.module.css lib/navigationChrome.test.ts
git status -sb
git add -- app/globals.css app/page.module.css lib/navigationChrome.test.ts
git commit -m "style: use translucent root tab selection"
```

Expected: no whitespace errors; only the three intended files are committed.

### Task 2: Lock browser geometry, themes, and 120Hz-oriented motion evidence

**Files:**
- Modify: `e2e/native-navigation.spec.ts:419-615`
- Verify: `e2e/native-navigation.spec.ts:617-714,951-1048`

- [ ] **Step 1: Update Light computed-style and indicator geometry assertions**

In `root chrome stays compact, semantic, and safely tappable`, change the three selected SVG expectations from white to black:

```ts
await expect(libraryTab.locator("svg")).toHaveCSS("color", "rgb(0, 0, 0)");
await expect(readingTab.locator("svg")).toHaveCSS("color", "rgb(0, 0, 0)");
await expect(settingsTab.locator("svg")).toHaveCSS("color", "rgb(0, 0, 0)");
```

Extend the geometry result with static-material checks:

```ts
backingBoxShadow: backing.boxShadow,
backingFilter: backing.filter,
backingBackdropFilter:
  backing.getPropertyValue("backdrop-filter") ||
  backing.getPropertyValue("-webkit-backdrop-filter"),
```

Replace the old 31px violet assertions with:

```ts
expect(
  Math.abs(geometry.backingWidth - (geometry.tabs[0].width - 8))
).toBeLessThanOrEqual(0.5);
expect(geometry.backingHeight).toBe(60);
expect(geometry.backingRadius).toBe("30px");
expect(geometry.backingColor).toBe("rgba(118, 118, 128, 0.12)");
expect(geometry.backingBoxShadow).toBe("none");
expect(geometry.backingFilter).toBe("none");
expect(geometry.backingBackdropFilter).toBe("none");
```

- [ ] **Step 2: Extend the four-theme browser contract**

In `root navigation follows light, sepia, and dark frosted materials`, resolve the indicator backing and active icon inside the loop:

```ts
const indicator = element.querySelector<HTMLElement>(
  '[data-root-tab-indicator="true"]'
);
const activeTab = element.querySelector<HTMLElement>('[aria-current="page"]');
const activeIcon = activeTab?.querySelector<SVGElement>("svg");
const activeLabel = activeTab?.querySelector<HTMLElement>("span");
if (!indicator || !activeIcon || !activeLabel) {
  throw new Error("Root navigation selection material is missing");
}
return {
  backgroundColor: style.backgroundColor,
  content: style.color,
  activeFill: getComputedStyle(indicator, "::after").backgroundColor,
  activeIcon: getComputedStyle(activeIcon).color,
  activeLabel: getComputedStyle(activeLabel).color,
};
```

After the existing parent-material expectation, add:

```ts
const expectedSelection = {
  light: {
    fill: "rgba(118, 118, 128, 0.12)",
    icon: "rgb(0, 0, 0)",
    label: "rgb(5, 5, 5)",
  },
  sepia: {
    fill: "rgba(130, 105, 66, 0.14)",
    icon: "rgb(0, 0, 0)",
    label: "rgb(51, 39, 25)",
  },
  dark: {
    fill: "rgba(255, 255, 255, 0.12)",
    icon: "rgb(255, 255, 255)",
    label: "rgb(255, 255, 255)",
  },
}[theme];
expect(material.activeFill).toBe(expectedSelection.fill);
expect(material.activeIcon).toBe(expectedSelection.icon);
expect(material.activeLabel).toBe(expectedSelection.label);
```

Replace the `systemDarkMaterial` evaluation with:

```ts
const systemDarkMaterial = await navigation.evaluate((element) => {
  const style = getComputedStyle(element);
  const indicator = element.querySelector<HTMLElement>(
    '[data-root-tab-indicator="true"]'
  );
  const activeTab = element.querySelector<HTMLElement>('[aria-current="page"]');
  const activeIcon = activeTab?.querySelector<SVGElement>("svg");
  const activeLabel = activeTab?.querySelector<HTMLElement>("span");
  if (!indicator || !activeIcon || !activeLabel) {
    throw new Error("System-dark root navigation selection material is missing");
  }
  return {
    backgroundColor: style.backgroundColor,
    color: style.color,
    activeFill: getComputedStyle(indicator, "::after").backgroundColor,
    activeIcon: getComputedStyle(activeIcon).color,
    activeLabel: getComputedStyle(activeLabel).color,
  };
});
```

Keep the existing parent material assertions and add:

```ts
expect(systemDarkMaterial.activeFill).toBe("rgba(255, 255, 255, 0.12)");
expect(systemDarkMaterial.activeIcon).toBe("rgb(255, 255, 255)");
expect(systemDarkMaterial.activeLabel).toBe("rgb(255, 255, 255)");
```

Keep all screenshot captures and the existing Sepia inactive-content contrast gate.

- [ ] **Step 3: Run the focused browser contract on iPhone 14**

Run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14 --grep "root chrome stays compact|root navigation follows|root tab indicator retargets|root tab retargeting stays"
```

Expected: 4/4 PASS. The performance annotation reports at least 32 sampled frames, P95 at or below 20ms, zero long tasks, and zero layout shift. This is 60Hz Chromium smoke evidence, not a literal 120fps claim.

- [ ] **Step 4: Run the same focused contract on iPhone 15 Pro Max**

Run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max --grep "root chrome stays compact|root navigation follows|root tab indicator retargets|root tab retargeting stays"
```

Expected: 4/4 PASS with the same performance gates and caveat.

- [ ] **Step 5: Inspect all generated navigation evidence at original resolution**

List the screenshots:

```powershell
Get-ChildItem -LiteralPath 'test-results\native-navigation' -Recurse -File |
  Where-Object { $_.Name -like 'chrome-*.png' } |
  Select-Object -ExpandProperty FullName
```

Open the generated Library, Reading, Settings, Light, Sepia, Dark, and system-dark screenshots with the image viewer. Confirm the selected pill stays inside one tab region, has no purple residue, does not cover adjacent labels, uses black icons in Light/Sepia and white icons in Dark/system-dark, and leaves label colors unchanged.

- [ ] **Step 6: Commit the browser contract**

Run:

```powershell
git diff --check
git diff -- e2e/native-navigation.spec.ts
git add -- e2e/native-navigation.spec.ts
git commit -m "test: verify translucent root tab selection"
```

Expected: the browser test change is committed separately from the product CSS; `test-results` remains gitignored.

### Task 3: Run the complete quality gates

**Files:**
- Verify: repository-wide configured checks
- Verify: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Run the complete Vitest suite**

Run: `npm.cmd test`

Expected: exit code 0; the current baseline remains 155 files and 1449 tests passing unless Vitest reports an intentionally updated count.

- [ ] **Step 2: Run the configured lint**

Run: `npm.cmd run lint`

Expected: exit code 0 with no ESLint warnings or errors.

- [ ] **Step 3: Run the production webpack build**

Run: `npm.cmd run build`

Expected: exit code 0; Next.js compiles, TypeScript passes, and all static pages generate successfully.

- [ ] **Step 4: Run the full iPhone 14 native-navigation suite**

Run: `npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14`

Expected: 16/16 PASS, including the root-tab performance case with P95 at or below 20ms, zero long tasks, and zero layout shift.

- [ ] **Step 5: Run the full iPhone 15 Pro Max native-navigation suite**

Run: `npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max`

Expected: 16/16 PASS with the same gates. Treat isolated scheduler jitter as evidence to rerun unchanged, not permission to relax the threshold.

- [ ] **Step 6: Perform final repository checks**

Run:

```powershell
git diff --check
git status -sb
git log -6 --oneline --decorate
```

Expected: no whitespace errors, no uncommitted tracked changes, no generated
evidence staged, and the design, plan, product, and browser-test commits are
visible above the original `49fdb02` baseline.

- [ ] **Step 7: Report the physical-device limitation precisely**

In the handoff response, report the exact commands and observed results from this run. State that the implementation is transform-only and targeted at physical iPhone 120Hz, while the automated Chromium runs prove only the configured 60Hz smoke budget. Do not claim verified physical 120fps without a real iPhone Safari/PWA trace.
