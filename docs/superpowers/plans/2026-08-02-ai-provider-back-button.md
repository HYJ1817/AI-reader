# AI Provider Arrow Back Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text back controls on the AI provider list and configure surfaces with one consistent icon-only, accessible, 44px iOS-style arrow button.

**Architecture:** Keep the existing `AiSettingsSurface` navigation and route callbacks unchanged. Render one route-aware button label and inline SVG arrow from that shared component, then style it in the existing CSS module so both provider routes inherit identical geometry, feedback, focus, and reduced-motion behavior.

**Tech Stack:** Next.js/React, TypeScript, CSS Modules, Vitest source-integration tests, Playwright mobile navigation tests.

---

### Task 1: Add the failing provider back-button contract tests

**Files:**
- Create: `lib/providerBackButtonIntegration.test.ts`
- Modify: `lib/pushSurfacesIntegration.test.ts:79-86`

- [ ] **Step 1: Write the failing source and CSS assertions**

Create `lib/providerBackButtonIntegration.test.ts` with these assertions:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surfaceSource = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);
const stylesSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("AI provider arrow back button", () => {
  it("renders an icon-only route-aware accessible back button", () => {
    const buttonStart = surfaceSource.indexOf(
      'className={styles.providerNavButton}'
    );
    const buttonEnd = surfaceSource.indexOf("</button>", buttonStart);
    const buttonSource = surfaceSource.slice(buttonStart, buttonEnd);

    expect(buttonSource).toContain(
      'aria-label={mode === "list" ? "返回设置" : "返回服务商"}'
    );
    expect(buttonSource).toContain('className={styles.providerNavIcon}');
    expect(buttonSource).toContain('viewBox="0 0 24 24"');
    expect(buttonSource).toContain('aria-hidden="true"');
    expect(buttonSource).not.toContain('mode === "list" ? "设置" : "服务商"');
  });

  it("gives the arrow button a stable hit target and accessible motion states", () => {
    expect(stylesSource).toMatch(
      /\.providerNavButton\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*border-radius:\s*50%;/s
    );
    expect(stylesSource).toMatch(
      /\.providerNavButton\s*\{[^}]*border:[^;]+;[^}]*background:[^;]+;/s
    );
    expect(stylesSource).toMatch(
      /\.providerNavButton:focus-visible\s*\{[^}]*outline:[^}]*var\(--focus-ring\)/s
    );
    expect(stylesSource).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.providerNavButton,[\s\S]*?\.providerNavIcon[\s\S]*?transition:\s*none;/s
    );
  });
});
```

Update the existing pushed-surface viewport test so it checks the new contract instead of the removed text label:

```ts
expect(stylesSource).toMatch(
  /\.providerNavButton\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s
);
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
npm.cmd run test -- lib/providerBackButtonIntegration.test.ts lib/pushSurfacesIntegration.test.ts
```

Expected: FAIL because the current button contains the text label, has no SVG icon or route-aware `aria-label`, and the current CSS does not define a 44px circular control.

### Task 2: Implement the icon-only provider navigation control

**Files:**
- Modify: `app/AiSettingsSurface.tsx:500-508`
- Modify: `app/page.module.css:7337-7355`

- [ ] **Step 1: Replace the text button content with the accessible arrow SVG**

Use the existing `onBack` callback and shared `providerNavButton` class, with this exact button shape:

```tsx
<button
  type="button"
  className={styles.providerNavButton}
  aria-label={mode === "list" ? "返回设置" : "返回服务商"}
  onClick={onBack}
>
  <svg
    className={styles.providerNavIcon}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M14.5 5 7.5 12l7 7"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
</button>
```

- [ ] **Step 2: Add the shared 44px circular styling and feedback**

Replace the old text-button declarations with:

```css
.providerNavButton {
  justify-self: start;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0.5px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
  border-radius: 50%;
  color: var(--text-primary);
  background: var(--surface-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  transform: translate3d(0, 0, 0) scale(1);
  transition:
    background var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    box-shadow var(--motion-fast) var(--ease-standard),
    opacity var(--motion-fast) var(--ease-standard),
    transform var(--motion-fast) var(--ease-standard);
}

.providerNavIcon {
  width: 26px;
  height: 26px;
  transform: translate3d(0, 0, 0);
  transition: transform var(--motion-fast) var(--ease-standard);
}

.providerNavButton:active {
  opacity: 0.78;
  background: var(--control-fill);
  box-shadow: none;
  transform: translate3d(0, 1px, 0) scale(0.96);
}

.providerNavButton:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .providerNavButton,
  .providerNavIcon {
    transition: none;
    transform: none;
  }

  .providerNavButton:active {
    transform: none;
  }
}
```

- [ ] **Step 3: Run the focused source tests and verify they pass**

Run:

```powershell
npm.cmd run test -- lib/providerBackButtonIntegration.test.ts lib/pushSurfacesIntegration.test.ts lib/motionCss.test.ts
```

Expected: PASS, including existing provider motion assertions.

### Task 3: Cover both provider routes in mobile navigation

**Files:**
- Modify: `e2e/native-navigation.spec.ts` after `provider compact back reverses direction and keeps edge back`

- [ ] **Step 1: Add the route-aware accessible-label journey**

Add this Playwright test:

```ts
test("provider surfaces expose icon-only route-aware back buttons", async ({
  page,
}) => {
  await openAiProviderList(page);

  const listBack = page.getByRole("button", { name: "返回设置" });
  await expect(listBack).toBeVisible();
  await expect(listBack).toHaveAttribute("aria-label", "返回设置");
  await expect(listBack).toHaveCSS("width", "44px");
  expect((await listBack.boundingBox())?.width).toBeGreaterThanOrEqual(43.5);

  await page.locator('[data-open-provider-configure="true"]').click();
  const configure = page.locator('[data-provider-configure="true"]');
  await expect(configure).toBeVisible();

  const configureBack = page.getByRole("button", { name: "返回服务商" });
  await expect(configureBack).toBeVisible();
  await expect(configureBack).toHaveAttribute("aria-label", "返回服务商");
  await expect(configureBack).toHaveCSS("width", "44px");
  expect((await configureBack.boundingBox())?.width).toBeGreaterThanOrEqual(43.5);

  await configureBack.click();
  await expect(
    page.locator('[data-push-route="ai-provider-configure"]')
  ).toHaveCount(0);
  await expect(page.locator('[data-push-route="ai-providers"]')).toBeVisible();
});
```

- [ ] **Step 2: Run the focused mobile journey**

Run:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts -g "provider surfaces expose icon-only route-aware back buttons" --trace=off
```

Expected: PASS on both configured mobile projects; the route returns to the provider list, the computed CSS width is 44px, and the measured geometry is at least 43.5px after device-pixel rounding.

### Task 4: Run the repository verification gates

**Files:**
- Verify only: `app/AiSettingsSurface.tsx`, `app/page.module.css`, `lib/providerBackButtonIntegration.test.ts`, `lib/pushSurfacesIntegration.test.ts`, `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Run provider and navigation tests**

```powershell
npm.cmd run test -- lib/providerBackButtonIntegration.test.ts lib/pushSurfacesIntegration.test.ts lib/motionCss.test.ts lib/navigationHistory.test.ts lib/navigationMotion.test.ts
```

- [ ] **Step 2: Run source lint**

```powershell
npm.cmd exec -- eslint app lib e2e
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build and whitespace check**

```powershell
npm.cmd run build
git diff --check
```

Expected: the Next.js production build and whitespace check both exit 0.

- [ ] **Step 4: Review the final diff and status**

```powershell
git diff --stat
git diff -- app/AiSettingsSurface.tsx app/page.module.css lib/providerBackButtonIntegration.test.ts lib/pushSurfacesIntegration.test.ts e2e/native-navigation.spec.ts
git status -sb
```

Expected: only the documented arrow-back-button changes are present; no reset, clean, or force operation is used.
