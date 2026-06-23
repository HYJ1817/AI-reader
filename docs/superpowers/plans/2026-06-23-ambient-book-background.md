# Ambient Book Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one cover-derived ambient background shared by the three primary tabs and EPUB/TXT reading surfaces.

**Architecture:** Mount one `AmbientBookBackground` component in `Home`, sourced from the existing featured-book selector. The component owns only cover URL lifecycle and fallback styling; CSS owns theme veils and compositing, while the EPUB theme helper makes the iframe canvas transparent so the root ambience remains visible.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, epub.js, Vitest

---

## File Structure

- Create `app/AmbientBookBackground.tsx`: shared fixed background component and Blob URL lifecycle.
- Create `lib/ambientBookBackground.test.ts`: source-level integration and CSS contract tests.
- Modify `app/page.tsx`: mount one ambient component using `latestBook`.
- Modify `app/page.module.css`: ambient layers, theme veil tokens, transparent application/reader surfaces, reduced-motion behavior.
- Modify `app/globals.css`: define theme-specific ambient veil and fallback tokens.
- Modify `lib/epubReaderPreferences.ts`: make EPUB iframe canvas transparent while preserving foreground enforcement.
- Modify `lib/epubReaderPreferences.test.ts`: verify transparent EPUB canvas behavior.
- Preserve and separately commit the existing EPUB tap fix before ambient work.

### Task 0: Preserve Existing EPUB Tap Fix

**Files:**
- Existing modifications: `app/EpubReader.tsx`
- Existing modifications: `app/page.tsx`
- Existing modifications: `lib/readerChromeIntegration.test.ts`
- Existing additions: `lib/epubTapInteractions.ts`
- Existing additions: `lib/epubTapInteractions.test.ts`

- [ ] **Step 1: Run the focused regression tests**

Run:

```powershell
npm.cmd run test -- lib/epubTapInteractions.test.ts lib/readerChromeIntegration.test.ts
```

Expected: both files pass.

- [ ] **Step 2: Run the full suite before preserving the existing work**

Run:

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 3: Commit only the existing EPUB tap work**

```powershell
git add app/EpubReader.tsx app/page.tsx lib/readerChromeIntegration.test.ts lib/epubTapInteractions.ts lib/epubTapInteractions.test.ts
git commit -m "fix: stabilize epub tap menu toggles"
```

Expected: the ambient feature starts from a clean code worktree and the documentation commits remain separate.

### Task 1: Define The Ambient Component Contract

**Files:**
- Create: `lib/ambientBookBackground.test.ts`
- Create: `app/AmbientBookBackground.tsx`

- [ ] **Step 1: Write the failing component contract test**

Create a source-level test that requires one focused component with the shared
cache and deterministic fallback:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/AmbientBookBackground.tsx", import.meta.url),
  "utf8"
);

describe("ambient book background", () => {
  it("uses the shared cover URL cache and deterministic fallback palette", () => {
    expect(source).toContain("acquireBlobUrl");
    expect(source).toContain("releaseBlobUrl");
    expect(source).toContain("createFallbackCoverStyle");
    expect(source).not.toContain("URL.createObjectURL");
  });

  it("is decorative and exposes two crossfade layers", () => {
    expect(source).toContain('aria-hidden="true"');
    expect(source).toContain("styles.ambientBookBackground");
    expect(source).toContain("styles.ambientBookLayer");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/ambientBookBackground.test.ts
```

Expected: FAIL because `app/AmbientBookBackground.tsx` does not exist.

- [ ] **Step 3: Implement the minimal component**

Implement a client component with this public API:

```tsx
type AmbientBookBackgroundProps = {
  book: BookRecord | null;
  reduceMotion: boolean;
};

export default function AmbientBookBackground({
  book,
  reduceMotion,
}: AmbientBookBackgroundProps) {
  // Acquire the current cover through blobUrlCache.
  // Keep the previous visual layer only during the opacity transition.
  // Use createFallbackCoverStyle(book.title, book.format) when no image exists.
  // Render a decorative fixed container with incoming and optional outgoing layers.
}
```

Use a visual-layer model containing:

```ts
type AmbientLayer = {
  key: string;
  imageUrl: string | null;
  paper: string;
  spine: string;
};
```

The effect cleanup must release the exact Blob it acquired. When
`reduceMotion` is true, replace the layer without retaining an outgoing layer.

- [ ] **Step 4: Run the component test and verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/ambientBookBackground.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the isolated component**

```powershell
git add app/AmbientBookBackground.tsx lib/ambientBookBackground.test.ts
git commit -m "feat: add ambient book background component"
```

### Task 2: Mount One Shared Root Background

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/ambientBookBackground.test.ts`

- [ ] **Step 1: Extend the failing integration test**

Add:

```ts
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

it("mounts one shared background from the existing featured book", () => {
  expect(pageSource.match(/<AmbientBookBackground/g)).toHaveLength(1);
  expect(pageSource).toContain("book={latestBook ?? null}");
  expect(pageSource).toContain("reduceMotion={appPrefs.reduceMotion}");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/ambientBookBackground.test.ts
```

Expected: FAIL because `Home` does not mount the component.

- [ ] **Step 3: Mount the component behind application content**

Import the component and render it as the first visual child of `.app`:

```tsx
<AmbientBookBackground
  book={latestBook ?? null}
  reduceMotion={appPrefs.reduceMotion}
/>
```

Do not alter `selectFeaturedLibraryBook`, reader presentation, or the existing
EPUB tap callbacks.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/ambientBookBackground.test.ts lib/readerChromeIntegration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the root integration**

```powershell
git add app/page.tsx lib/ambientBookBackground.test.ts
git commit -m "feat: mount shared ambient cover background"
```

### Task 3: Add Theme-Aware Strong Ambient Styling

**Files:**
- Modify: `app/globals.css`
- Modify: `app/page.module.css`
- Modify: `lib/ambientBookBackground.test.ts`

- [ ] **Step 1: Add failing CSS contract tests**

Add assertions for:

```ts
const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const moduleCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

it("defines ambient veil tokens for every reader theme", () => {
  expect(globals.match(/--ambient-veil:/g)?.length).toBeGreaterThanOrEqual(4);
  expect(globals).toContain("--ambient-strength:");
});

it("keeps the ambient layer fixed, decorative, and bounded", () => {
  expect(moduleCss).toMatch(
    /\.ambientBookBackground\s*\{[^}]*position:\s*fixed[^}]*pointer-events:\s*none/s
  );
  expect(moduleCss).toMatch(
    /\.ambientBookLayer\s*\{[^}]*filter:\s*blur\(/s
  );
});

it("lets the root and reader surfaces reveal the ambient layer", () => {
  for (const selector of [".app", ".readerShell", ".readerStage"]) {
    const start = moduleCss.indexOf(`${selector} {`);
    const end = moduleCss.indexOf("}", start);
    expect(moduleCss.slice(start, end)).toContain("transparent");
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/ambientBookBackground.test.ts
```

Expected: FAIL because the ambient CSS contracts do not exist.

- [ ] **Step 3: Define theme tokens**

Add tokens to root and explicit reader themes:

```css
--ambient-veil: color-mix(in srgb, var(--app-bg) 58%, transparent);
--ambient-strength: 0.32;
--ambient-saturate: 112%;
```

Tune dark and sepia values independently so the strong C treatment remains
visible while foreground tokens retain contrast.

- [ ] **Step 4: Add bounded fixed layers**

Implement:

```css
.ambientBookBackground {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--app-bg);
}

.ambientBookLayer {
  position: absolute;
  inset: -12%;
  opacity: var(--ambient-strength);
  transform: scale(1.08);
  filter: blur(42px) saturate(var(--ambient-saturate));
  background-position: center;
  background-size: cover;
  transition: opacity var(--motion-navigation) var(--ease-navigation);
}

.ambientBookBackground::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--ambient-veil);
}
```

Use the fallback paper/spine CSS variables to create a soft color field without
adding a decorative SVG or canvas.

- [ ] **Step 5: Reveal ambience through persistent surfaces**

Keep `.content` and navigation surfaces above the ambient layer. Change only the
root surface backgrounds that currently block it:

```css
.app,
.readerShell,
.readerStage {
  background: transparent;
}
```

Keep ordinary lists, rows, controls, sheets, and the bottom tab bar on their
existing semantic surface fills.

- [ ] **Step 6: Add reduced-motion behavior**

Disable ambient opacity transitions for both:

```css
[data-reduce-motion="true"] .ambientBookLayer,
@media (prefers-reduced-motion: reduce) {
  .ambientBookLayer {
    transition: none;
  }
}
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd run test -- lib/ambientBookBackground.test.ts lib/semanticTokens.test.ts lib/motionCss.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the visual system**

```powershell
git add app/globals.css app/page.module.css lib/ambientBookBackground.test.ts
git commit -m "feat: style cover-led ambient surfaces"
```

### Task 4: Make EPUB Canvas Transparent

**Files:**
- Modify: `lib/epubReaderPreferences.test.ts`
- Modify: `lib/epubReaderPreferences.ts`

- [ ] **Step 1: Write the failing EPUB theme assertion**

Capture the rules passed to `controller.register`:

```ts
it("keeps the epub canvas transparent for the shared ambient background", () => {
  const controller = createController();

  applyEpubReaderPreferences(
    controller,
    DEFAULT_READER_PREFERENCES,
    { foreground: "#111111", background: "#ffffff" },
    EMPTY_EPUB_PREFERENCE_STATE
  );

  const rules = vi.mocked(controller.register).mock.calls[0][1];
  expect(rules["html, body"]).toContain("background: transparent !important");
  expect(rules.body).toContain("color: #111111 !important");
  expect(rules.body).not.toContain("background: #ffffff");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd run test -- lib/epubReaderPreferences.test.ts
```

Expected: FAIL because EPUB body still receives an opaque theme background.

- [ ] **Step 3: Update the registered EPUB rules**

Change the theme rules to:

```ts
"html, body":
  "background: transparent !important; touch-action: pan-y pinch-zoom; overscroll-behavior-inline: contain; -webkit-tap-highlight-color: transparent;",
body: `color: ${colors.foreground} !important; background: transparent !important; transition: color 180ms cubic-bezier(0.25, 1, 0.5, 1);`,
```

Retain the foreground rule for text elements and retain the background color in
the theme signature so changing reader themes still reapplies foreground/theme
state consistently.

- [ ] **Step 4: Run EPUB and reader regression tests**

Run:

```powershell
npm.cmd run test -- lib/epubReaderPreferences.test.ts lib/readerChromeIntegration.test.ts lib/epubTapInteractions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the EPUB canvas change**

```powershell
git add lib/epubReaderPreferences.ts lib/epubReaderPreferences.test.ts
git commit -m "feat: reveal ambient background through epub"
```

### Task 5: Full Verification And Mobile Visual Review

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run complete automated verification**

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
git diff --check
```

Expected:

- Vitest: zero failed files and tests.
- ESLint: exit code 0.
- Next.js production build: exit code 0.
- Audit: zero vulnerabilities.
- Diff check: no whitespace errors.

- [ ] **Step 2: Start or reuse the local development server**

Run:

```powershell
npm.cmd run dev -- --hostname 0.0.0.0 --port 3042
```

If port 3042 is occupied by the current project, reuse it. Otherwise choose the
next available port.

- [ ] **Step 3: Verify at 390 x 844**

In the in-app browser:

- Open library, reading dashboard, and settings.
- Open a TXT book and an EPUB book.
- Verify the same recent-book ambience remains across all surfaces.
- Switch light, dark, and sepia reader themes.
- Confirm no text, rows, controls, or bottom navigation lose readable contrast.
- Confirm the background does not intercept taps or alter scrolling/swiping.
- Confirm a no-cover book uses the fallback color field.
- Confirm deleting the featured book selects the next recent book or clears the
  ambience.
- Inspect console warnings and errors.

- [ ] **Step 4: Review the final diff against the design**

Run:

```powershell
git status --short
git diff HEAD~4 --stat
git diff --check
```

Confirm no IndexedDB, import, backup, AI, progress, or reader gesture contracts
were changed by the ambient feature.

- [ ] **Step 5: Update handoff documentation if implementation details differ**

If the final implementation changes file ownership, verification counts, or
real-device acceptance steps, update `HANDOFF.md` in a documentation-only
commit.
