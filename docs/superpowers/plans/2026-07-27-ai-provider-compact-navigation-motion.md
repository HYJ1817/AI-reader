# AI Provider Compact Navigation Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI provider list/configuration transition use the same compact fade-slide and navigation spring as root navigation without changing unrelated push routes or the edge-back gesture.

**Architecture:** Add a pure route-to-motion-profile selector and shared compact offsets in `lib/navigationMotion.ts`. `NavigationStack` will use the pushed route's own profile for enter/exit, the covering route's profile for the previous surface, and a data attribute for the one CSS exception (removing the generic push shadow). Interactive edge-back remains driven by the existing viewport-width MotionValue; compact previous surfaces additionally fade with gesture progress.

**Tech Stack:** TypeScript, React 19, Motion for React, CSS Modules, Vitest, Playwright, Next.js 16

---

## File Map

- Modify `lib/navigationMotion.ts`: own the typed push motion profile and the 22 px/12 px compact geometry.
- Modify `lib/navigationMotion.test.ts`: verify route classification, immutable geometry, and unchanged root-tab offsets.
- Modify `app/NavigationStack.tsx`: apply compact enter/covered/exit states and preserve interactive edge-back behavior.
- Modify `app/page.module.css`: suppress the generic edge shadow only for compact pushes.
- Modify `lib/pushSurfaceMotionIntegration.test.ts`: protect stack wiring, CSS scoping, shared spring use, and absence of filter-based effects.
- Modify `e2e/native-navigation.spec.ts`: record real transition geometry and verify forward, reverse, reduced-motion, and frame-budget behavior.

### Task 1: Define the Route-Scoped Motion Policy

**Files:**
- Modify: `lib/navigationMotion.test.ts`
- Modify: `lib/navigationMotion.ts`

- [ ] **Step 1: Write failing policy tests**

Add imports and assertions that describe the public policy:

```ts
import {
  COMPACT_PUSH_OFFSETS,
  getPushMotionProfile,
  getRootTabOffsets,
  getNavigationSurfaceState,
  getNavigationTabIndex,
} from "./navigationMotion";

it("uses compact navigation motion only for provider configuration", () => {
  expect(getPushMotionProfile("ai-provider-configure")).toBe("compact");
  expect(getPushMotionProfile("ai-providers")).toBe("depth");
  expect(getPushMotionProfile("collections")).toBe("depth");
  expect(getPushMotionProfile("custom-background")).toBe("depth");
});

it("shares root navigation travel distances with compact pushes", () => {
  expect(COMPACT_PUSH_OFFSETS).toEqual({ incoming: 22, covered: -12 });
  expect(getRootTabOffsets("library", "settings")).toEqual({
    outgoing: COMPACT_PUSH_OFFSETS.covered,
    incoming: COMPACT_PUSH_OFFSETS.incoming,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm red**

Run:

```bash
npx vitest run lib/navigationMotion.test.ts
```

Expected: FAIL because `COMPACT_PUSH_OFFSETS` and `getPushMotionProfile` are not exported.

- [ ] **Step 3: Implement the minimal pure policy**

Add the following declarations without importing `appNavigation`, which already depends on `NavigationTab` from this file:

```ts
export const COMPACT_PUSH_OFFSETS = {
  incoming: 22,
  covered: -12,
} as const;

export type PushMotionProfile = "depth" | "compact";

export function getPushMotionProfile(route: string | undefined): PushMotionProfile {
  return route === "ai-provider-configure" ? "compact" : "depth";
}
```

Update `getRootTabOffsets` to return values from `COMPACT_PUSH_OFFSETS`, preserving its current directional behavior.

- [ ] **Step 4: Run the focused test and confirm green**

Run:

```bash
npx vitest run lib/navigationMotion.test.ts
```

Expected: all navigation motion tests PASS.

- [ ] **Step 5: Commit the pure policy**

```bash
git add lib/navigationMotion.ts lib/navigationMotion.test.ts
git commit -m "test: define compact provider push motion"
```

### Task 2: Apply Compact Motion to the Navigation Stack

**Files:**
- Modify: `lib/pushSurfaceMotionIntegration.test.ts`
- Modify: `app/NavigationStack.tsx`
- Modify: `app/page.module.css`

- [ ] **Step 1: Write failing integration contracts**

Extend `lib/pushSurfaceMotionIntegration.test.ts` with a test that verifies the route-scoped profile is used by the stack and that the CSS exception cannot affect other routes:

```ts
it("uses the compact profile only for provider configuration pushes", () => {
  expect(navigationSource).toContain("getPushMotionProfile");
  expect(navigationSource).toContain("COMPACT_PUSH_OFFSETS.incoming");
  expect(navigationSource).toContain("COMPACT_PUSH_OFFSETS.covered");
  expect(navigationSource).toContain('data-push-motion={motionProfile}');
  expect(navigationSource).toContain("MOTION_SPRING.navigation");
  expect(pageCss).toMatch(
    /\.pushSurface\[data-push-motion="compact"\]\s*\{[^}]*box-shadow:\s*none;/s
  );
  expect(pageCss).not.toMatch(/\.pushSurface\s*\{[^}]*box-shadow:\s*none;/s);
});
```

Also protect the compact profile from automatic depth overlays:

```ts
expect(navigationSource).toContain("compactCovered ? 0 : PUSH_DEPTH_OPACITY");
```

- [ ] **Step 2: Run the focused integration test and confirm red**

Run:

```bash
npx vitest run lib/pushSurfaceMotionIntegration.test.ts
```

Expected: FAIL because the compact profile is not wired into the stack and the scoped CSS rule does not exist.

- [ ] **Step 3: Pass covering-route context to each push layer**

In the `pushes.map` call, pass the route immediately above the entry:

```tsx
<PushLayer
  key={entry.key}
  entry={entry}
  coveringRoute={pushes[index + 1]?.route}
  // existing props remain unchanged
>
```

Extend `PushLayer`'s props with:

```ts
coveringRoute?: PushEntry["route"];
```

Import the shared policy:

```ts
import {
  COMPACT_PUSH_OFFSETS,
  getPushMotionProfile,
  getRootTabOffsets,
  type NavigationTab,
} from "@/lib/navigationMotion";
```

- [ ] **Step 4: Derive compact own-route and covered-route states**

Inside `PushLayer`, derive stable values from route entries rather than React state:

```ts
const motionProfile = getPushMotionProfile(entry.route);
const coveringMotionProfile = getPushMotionProfile(coveringRoute);
const compactPush = motionProfile === "compact";
const compactCovered =
  distanceFromTop === 1 && coveringMotionProfile === "compact";
const edgePreviousOpacity = useTransform(edgeBackProgress, [0, 1], [0, 1]);
```

Use the compact own-route profile for automatic enter/exit:

```tsx
initial={
  reduceMotion
    ? { opacity: 0, x: 0 }
    : compactPush
      ? { opacity: 0, x: COMPACT_PUSH_OFFSETS.incoming }
      : { opacity: 1, x: "100%" }
}
exit={
  reduceMotion
    ? { opacity: 0, x: 0 }
    : compactPush
      ? { opacity: 0, x: COMPACT_PUSH_OFFSETS.incoming }
      : { opacity: 1, x: "100%" }
}
data-push-motion={motionProfile}
```

- [ ] **Step 5: Apply the compact previous-surface choreography**

For a surface covered by the compact route:

- automatic resting state is `{ opacity: 0, x: COMPACT_PUSH_OFFSETS.covered }`;
- complete edge-back settle targets `{ opacity: 1, x: 0 }`;
- cancelled edge-back settle returns to `{ opacity: 0, x: COMPACT_PUSH_OFFSETS.covered }`;
- active gesture uses the existing `edgePreviousX` (`-30%` to `0%`) plus `edgePreviousOpacity` (`0` to `1`);
- depth overlay opacity is always zero for the compact covering route;
- all depth-profile branches remain byte-for-byte equivalent in behavior.

Keep the top interactive surface driven by `edgeBackX`, so the finger still controls a viewport-width return gesture. Continue using `MOTION_SPRING.navigation` for non-reduced automatic transitions and existing `gestureSettle` timing after a completed gesture.

- [ ] **Step 6: Scope the shadow removal to compact pushes**

Add immediately after `.pushSurface` in `app/page.module.css`:

```css
.pushSurface[data-push-motion="compact"] {
  box-shadow: none;
}
```

- [ ] **Step 7: Run focused unit and integration tests**

Run:

```bash
npx vitest run lib/navigationMotion.test.ts lib/pushSurfaceMotionIntegration.test.ts lib/pushSurfacesIntegration.test.ts
```

Expected: all focused tests PASS and the existing generic-push assertions still find `"100%"`, `"-30%"`, and `pushDepthOverlay`.

- [ ] **Step 8: Commit stack integration**

```bash
git add app/NavigationStack.tsx app/page.module.css lib/pushSurfaceMotionIntegration.test.ts
git commit -m "feat: align provider push with navigation motion"
```

### Task 3: Verify Perceptual Geometry in a Real Browser

**Files:**
- Modify: `e2e/native-navigation.spec.ts`

- [ ] **Step 1: Add a transition snapshot helper**

Add a helper that installs a `MutationObserver` before the click and resolves in the observer microtask when the route mounts. It must return computed x/opacity for the incoming configure layer and the existing provider-list layer, plus the compact layer's shadow and motion attribute:

```ts
type MotionSnapshot = {
  incomingX: number;
  incomingOpacity: number;
  previousX: number;
  previousOpacity: number;
  shadow: string;
  profile: string | null;
};
```

Parse x with `new DOMMatrixReadOnly(getComputedStyle(element).transform).m41`. Reject with a descriptive error if either layer is missing.

- [ ] **Step 2: Add a failing forward-motion assertion**

Extend the provider transition test so the real Add button click is captured by the helper and assert:

```ts
expect(snapshot.profile).toBe("compact");
expect(snapshot.incomingX).toBeGreaterThanOrEqual(20);
expect(snapshot.incomingX).toBeLessThanOrEqual(23);
expect(snapshot.incomingOpacity).toBeLessThanOrEqual(0.05);
expect(snapshot.previousX).toBeGreaterThanOrEqual(-13);
expect(snapshot.previousX).toBeLessThanOrEqual(0);
expect(snapshot.shadow).toBe("none");
```

Retain the existing click-to-mount, frame interval, long-task, and layout-shift assertions.

- [ ] **Step 3: Run the single browser test and confirm red before stack implementation (or validate the regression if Task 2 is already green)**

Run:

```bash
npx playwright test e2e/native-navigation.spec.ts --grep "AI provider configure transition" --project=iphone-14
```

Expected before Task 2: FAIL with a viewport-width incoming x or missing compact profile. Expected after Task 2: PASS. If Task 2 has already been implemented, temporarily verify the helper fails against the pre-change expectation by asserting profile `depth`, then restore the intended assertion before continuing.

- [ ] **Step 4: Add reverse and reduced-motion coverage**

Add one test that opens the compact route, starts browser/history back, samples the exiting configuration layer before its first paint, and checks that its target direction is rightward and bounded by the compact 22 px policy. Extend the existing reduced-motion test to open the provider configuration route and assert x is within 1 px, the destination remains usable, and no viewport-width translation occurs.

- [ ] **Step 5: Run provider motion tests on both iPhone profiles**

Run:

```bash
npx playwright test e2e/native-navigation.spec.ts --grep "AI provider configure transition|provider compact back|reduced motion keeps" --project=iphone-14 --project=iphone-15-pro-max
```

Expected: all selected tests PASS for both profiles, with zero layout shift and zero long tasks in the existing metrics payload.

- [ ] **Step 6: Commit browser regression coverage**

```bash
git add e2e/native-navigation.spec.ts
git commit -m "test: cover compact provider navigation"
```

### Task 4: Full Verification and Documentation

**Files:**
- Modify only if needed: `docs/superpowers/plans/2026-07-27-ai-provider-compact-navigation-motion.md`

- [ ] **Step 1: Run the complete unit suite**

Run:

```bash
npm test
```

Expected: all Vitest tests PASS with no skipped regression introduced by this change.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: ESLint exits 0 with no errors.

- [ ] **Step 3: Run the production Next.js build**

Run:

```bash
npm run build
```

Expected: Next.js production build exits 0.

- [ ] **Step 4: Run the focused cross-device Playwright suite against the production build**

Run:

```bash
npx playwright test e2e/native-navigation.spec.ts --grep "AI provider configure transition|provider compact back|reduced motion keeps" --project=iphone-14 --project=iphone-15-pro-max
```

Expected: all selected tests PASS on both profiles.

- [ ] **Step 5: Inspect the final diff and worktree state**

Run:

```bash
git diff --check
git status -sb
git log -8 --oneline --decorate
```

Expected: no whitespace errors; only intentional changes (or a clean worktree after commits); local branch is ahead of the remote and has not been pushed.

- [ ] **Step 6: Record any verification-only plan updates**

If the checkboxes are updated with completed status, commit only the plan file:

```bash
git add docs/superpowers/plans/2026-07-27-ai-provider-compact-navigation-motion.md
git commit -m "docs: record provider motion verification"
```

Do not push, deploy, or merge without a new explicit user instruction.
