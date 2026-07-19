# WebKit Mobile Navigation Regression Design

## Goal

Add a persistent Playwright WebKit project that exercises AI Reader's existing
mobile navigation regression suite. This provides an additional Safari-engine
signal while preserving the current Chromium mobile coverage and the explicit
requirement for final verification on a physical iPhone.

## Scope

- Add one `iphone-14-webkit` project to `playwright.config.ts`.
- Reuse Playwright's `iPhone 14` device descriptor and select WebKit explicitly.
- Run the existing navigation, history, focus, scroll retention, push route,
  sheet route, keyboard-sized viewport, reduced-motion, transition evidence,
  and frame-cadence checks in WebKit.
- Keep the existing `iphone-14` and `iphone-15-pro-max` Chromium projects and
  their names unchanged so current commands and handoff guidance remain valid.
- Do not change application behavior, production code, deployment settings, or
  the paused EPUB dark-mode transparency work.

## Gesture-Test Boundary

The two edge-swipe tests use `page.context().newCDPSession(page)` to dispatch
trusted touch input. CDP is Chromium-specific and is unavailable in Playwright
WebKit.

Those two tests will explicitly skip when `browserName` is `webkit`, with a
reason stating that trusted touch dispatch requires Chromium CDP. They will
continue to run in both Chromium mobile projects. The WebKit project will run
the other nine tests rather than replacing trusted touch with synthetic DOM
events, because untrusted events would weaken what the gesture tests prove.

## Configuration and Test Structure

`playwright.config.ts` remains the single source of project configuration. The
new project will follow the existing device-project pattern and will not alter
global timeouts, serialization, artifact output, or local/external base URL
handling.

`e2e/native-navigation.spec.ts` will make the browser limitation visible at the
two test declarations. No broad suite-level skip or hidden filtering will be
introduced. Test output must therefore show nine WebKit passes and two named
skips when the full suite succeeds.

## Failure Handling

- If the WebKit executable is absent, install the Playwright-managed WebKit
  browser for the repository's pinned Playwright version.
- Treat functional WebKit failures as real regressions to diagnose; do not
  loosen assertions solely to obtain a pass.
- Keep performance thresholds unchanged unless current evidence shows that the
  probe itself is unsupported. Any threshold change would require a separate
  design decision.
- Preserve traces and failure screenshots under the existing gitignored
  `test-results/native-navigation/` directory.

## Verification

Run the focused WebKit project locally against the development server:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14-webkit
```

Expected result: nine passed and two explicitly skipped CDP gesture tests.

Then run both existing Chromium projects to prove their trusted-touch coverage
is unchanged:

```powershell
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-14
npx.cmd playwright test e2e/native-navigation.spec.ts --project=iphone-15-pro-max
```

Finally run the relevant static checks:

```powershell
npm.cmd run lint
git diff --check
git status -sb
```

This verification improves local Safari-engine coverage but does not close the
handoff's physical-iPhone risks around gesture velocity, software keyboard
behavior, safe areas, shared-cover geometry, or tactile frame pacing.
