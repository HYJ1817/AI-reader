# Native Navigation and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full native-style navigation and motion system across AI Reader, including root tabs, pushed pages, shared book-cover reader presentation, interactive sheets, gesture arbitration, and coordinated application-wide state motion.

**Architecture:** Keep business data in the existing Home orchestration and add a typed navigation reducer plus History adapter as the single spatial state model. Render that state through Motion-powered root, push, reader, and sheet layers; migrate existing surfaces incrementally while preserving EPUB/TXT gesture ownership and reduced-motion behavior.

**Tech Stack:** Next.js 16, React 19, TypeScript, motion/react with LazyMotion, CSS Modules, Vitest, Playwright, epub.js, Cloudflare OpenNext.

---

## File Map

New domain files:

- `lib/motionSystem.ts`: durations, springs, variants, and reduced-motion policy.
- `lib/appNavigation.ts`: navigation types, reducer, and recovery helpers.
- `lib/navigationHistory.ts`: versioned browser History payloads.
- `lib/navigationGestures.ts`: edge-back and sheet gesture decisions.
- Matching `*.test.ts` files for each domain module.

New rendering files:

- `app/AppMotionRoot.tsx`: LazyMotion, MotionConfig, and LayoutGroup.
- `app/NavigationProvider.tsx`: navigation command context.
- `app/NavigationStack.tsx`: persistent roots and pushed pages.
- `app/useAppNavigation.ts`: reducer, History, and command serialization.
- `app/SharedBookTransition.tsx`: shared cover and fallback presentation.
- `app/MotionBookCover.tsx`: stable cover layout identity.
- `app/MotionSheet.tsx`: interruptible sheet presence and drag.
- `app/AiSettingsSurface.tsx`: pushed AI provider settings.
- `app/AppPushSurfaces.tsx`: pushed route registry.
- `app/AnimatedNumber.tsx`: reading-statistic crossfade.

Primary modified files:

- `app/page.tsx`, `app/page.module.css`, and `app/AppNavigation.tsx`
- `app/LibrarySurface.tsx`, `app/SettingsSurface.tsx`, and `app/ReadingDashboard.tsx`
- `app/ReadingSession.tsx`, `app/ReaderControls.tsx`, and `app/EpubReader.tsx`
- `app/BottomSheet.tsx`, `app/AppOverlays.tsx`, and all current sheet consumers
- `app/AskAiPanel.tsx` and `app/AmbientBookBackground.tsx`
- `package.json`, `package-lock.json`, `HANDOFF.md`

## Task 1: Install Motion and Establish the Motion Contract

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `lib/motionSystem.ts`
- Create: `lib/motionSystem.test.ts`
- Create: `app/AppMotionRoot.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Install Motion**

Run:

```powershell
npm.cmd install motion
```

Expected: `motion` is added to dependencies without React 19 peer errors.

- [ ] **Step 2: Write the failing token test**

Create `lib/motionSystem.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MOTION_DURATION, MOTION_SPRING, getMotionPolicy } from "./motionSystem";

describe("motion system", () => {
  it("keeps exits faster than entrances", () => {
    expect(MOTION_DURATION.pushExit).toBeLessThan(MOTION_DURATION.pushEnter);
    expect(MOTION_DURATION.readerExit).toBeLessThan(MOTION_DURATION.readerEnter);
    expect(MOTION_DURATION.sheetExit).toBeLessThan(MOTION_DURATION.sheetEnter);
  });

  it("uses positive non-oscillating springs", () => {
    for (const spring of Object.values(MOTION_SPRING)) {
      expect(spring.stiffness).toBeGreaterThan(0);
      expect(spring.damping).toBeGreaterThan(30);
      expect(spring.mass).toBeGreaterThan(0);
      expect(spring.bounce).toBe(0);
    }
  });

  it("reduces motion for either preference", () => {
    expect(getMotionPolicy(false, false)).toBe("full");
    expect(getMotionPolicy(true, false)).toBe("reduced");
    expect(getMotionPolicy(false, true)).toBe("reduced");
  });
});
```

- [ ] **Step 3: Run the test and verify failure**

Run: `npm.cmd test -- --run lib/motionSystem.test.ts`

Expected: FAIL because `lib/motionSystem.ts` does not exist.

- [ ] **Step 4: Implement typed motion tokens**

Create `lib/motionSystem.ts`:

```ts
export const MOTION_DURATION = {
  press: 0.12,
  state: 0.2,
  tab: 0.26,
  pushEnter: 0.36,
  pushExit: 0.27,
  readerEnter: 0.46,
  readerExit: 0.34,
  sheetEnter: 0.34,
  sheetExit: 0.25,
  reduced: 0.12,
} as const;

export const MOTION_SPRING = {
  navigation: { type: "spring" as const, stiffness: 380, damping: 38, mass: 0.9, bounce: 0 },
  sheet: { type: "spring" as const, stiffness: 420, damping: 42, mass: 0.92, bounce: 0 },
  sharedBook: { type: "spring" as const, stiffness: 360, damping: 36, mass: 0.95, bounce: 0 },
} as const;

export type MotionPolicy = "full" | "reduced";

export function getMotionPolicy(appPreference: boolean, systemPreference: boolean): MotionPolicy {
  return appPreference || systemPreference ? "reduced" : "full";
}
```

- [ ] **Step 5: Add the Motion runtime root**

Create `app/AppMotionRoot.tsx`:

```tsx
"use client";

import { domAnimation, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export default function AppMotionRoot({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <LayoutGroup id="ai-reader-app">{children}</LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
```

Wrap the existing `.app` return tree in `AppMotionRoot`, passing
`appPrefs.reduceMotion`.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/motionSystem.test.ts lib/motionCss.test.ts
npm.cmd exec -- eslint app/AppMotionRoot.tsx app/page.tsx lib/motionSystem.ts lib/motionSystem.test.ts
```

Commit:

```powershell
git add package.json package-lock.json app/AppMotionRoot.tsx app/page.tsx lib/motionSystem.ts lib/motionSystem.test.ts
git commit -m "feat: add application motion runtime"
```

## Task 2: Build the Navigation Reducer

**Files:**

- Create: `lib/appNavigation.ts`
- Create: `lib/appNavigation.test.ts`

- [ ] **Step 1: Write reducer tests**

Create `lib/appNavigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAppNavigationState, reduceAppNavigation } from "./appNavigation";

describe("app navigation", () => {
  it("selects a root without pushing", () => {
    const state = reduceAppNavigation(createAppNavigationState(), { type: "select-tab", tab: "settings" });
    expect(state.activeTab).toBe("settings");
    expect(state.pushes).toEqual([]);
  });

  it("pushes and pops with direction", () => {
    const pushed = reduceAppNavigation(createAppNavigationState(), {
      type: "push",
      entry: { key: "push-1", kind: "push", route: "collections" },
    });
    expect(pushed.direction).toBe("forward");
    expect(reduceAppNavigation(pushed, { type: "pop" }).pushes).toEqual([]);
  });

  it("keeps reader and sheets in separate layers", () => {
    const reader = reduceAppNavigation(createAppNavigationState(), {
      type: "present-reader",
      entry: { key: "reader-1", kind: "reader", bookId: "book-1" },
    });
    const sheet = reduceAppNavigation(reader, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "ask-ai" },
    });
    expect(sheet.reader?.bookId).toBe("book-1");
    expect(sheet.sheets.at(-1)?.route).toBe("ask-ai");
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm.cmd test -- --run lib/appNavigation.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement navigation types and reducer**

Create `lib/appNavigation.ts`:

```ts
import type { NavigationTab } from "./navigationMotion";

export type PushRoute = "collections" | "ai-providers" | "ai-provider-configure" | "custom-background";
export type SheetRoute =
  | "reader-settings" | "reader-custom-settings" | "toc" | "ask-ai" | "reading-goal"
  | "book-actions" | "book-delete" | "book-groups" | "batch-groups"
  | "batch-delete" | "collection-create";

export type PushEntry = { key: string; kind: "push"; route: PushRoute; entityId?: string; restoreFocusId?: string; scrollTop?: number };
export type ReaderEntry = { key: string; kind: "reader"; bookId: string; originId?: string };
export type SheetEntry = { key: string; kind: "sheet"; route: SheetRoute; entityId?: string; restoreFocusId?: string };
export type NavigationDirection = "forward" | "backward" | "replace";

export type AppNavigationState = {
  activeTab: NavigationTab;
  pushes: PushEntry[];
  reader: ReaderEntry | null;
  sheets: SheetEntry[];
  direction: NavigationDirection;
  revision: number;
};

export type AppNavigationAction =
  | { type: "select-tab"; tab: NavigationTab }
  | { type: "push"; entry: PushEntry }
  | { type: "pop" }
  | { type: "present-reader"; entry: ReaderEntry }
  | { type: "dismiss-reader" }
  | { type: "present-sheet"; entry: SheetEntry }
  | { type: "dismiss-sheet" }
  | { type: "restore"; state: AppNavigationState }
  | { type: "remove-invalid"; key: string };

export function createAppNavigationState(): AppNavigationState {
  return { activeTab: "library", pushes: [], reader: null, sheets: [], direction: "replace", revision: 0 };
}

function next(state: AppNavigationState, patch: Partial<AppNavigationState>, direction: NavigationDirection): AppNavigationState {
  return { ...state, ...patch, direction, revision: state.revision + 1 };
}

export function reduceAppNavigation(state: AppNavigationState, action: AppNavigationAction): AppNavigationState {
  switch (action.type) {
    case "select-tab": return next(state, { activeTab: action.tab, pushes: [] }, "replace");
    case "push": return next(state, { pushes: [...state.pushes, action.entry] }, "forward");
    case "pop":
      if (state.sheets.length) return next(state, { sheets: state.sheets.slice(0, -1) }, "backward");
      if (state.reader) return next(state, { reader: null }, "backward");
      return next(state, { pushes: state.pushes.slice(0, -1) }, "backward");
    case "present-reader": return next(state, { reader: action.entry, sheets: [] }, "forward");
    case "dismiss-reader": return next(state, { reader: null, sheets: [] }, "backward");
    case "present-sheet": return next(state, { sheets: [...state.sheets, action.entry] }, "forward");
    case "dismiss-sheet": return next(state, { sheets: state.sheets.slice(0, -1) }, "backward");
    case "restore": return { ...action.state, direction: "backward", revision: state.revision + 1 };
    case "remove-invalid":
      return next(state, {
        pushes: state.pushes.filter((entry) => entry.key !== action.key),
        reader: state.reader?.key === action.key ? null : state.reader,
        sheets: state.sheets.filter((entry) => entry.key !== action.key),
      }, "backward");
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm.cmd test -- --run lib/appNavigation.test.ts`

Commit:

```powershell
git add lib/appNavigation.ts lib/appNavigation.test.ts
git commit -m "feat: add typed app navigation reducer"
```

## Task 3: Synchronize Browser History

**Files:**

- Create: `lib/navigationHistory.ts`
- Create: `lib/navigationHistory.test.ts`
- Create: `app/useAppNavigation.ts`
- Create: `app/NavigationProvider.tsx`

- [ ] **Step 1: Write History tests**

Create `lib/navigationHistory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAppNavigationState } from "./appNavigation";
import { decodeNavigationHistory, encodeNavigationHistory } from "./navigationHistory";

describe("navigation history", () => {
  it("round-trips application navigation state", () => {
    const state = { ...createAppNavigationState(), activeTab: "settings" as const };
    expect(decodeNavigationHistory(encodeNavigationHistory(state))).toEqual(state);
  });

  it("rejects unrelated and unsupported payloads", () => {
    expect(decodeNavigationHistory(null)).toBeNull();
    expect(decodeNavigationHistory({ app: "other", version: 1 })).toBeNull();
    expect(decodeNavigationHistory({ app: "ai-reader", version: 99 })).toBeNull();
  });
});
```

- [ ] **Step 2: Implement the versioned payload**

Create `lib/navigationHistory.ts`:

```ts
import type { AppNavigationState } from "./appNavigation";

type HistoryV1 = { app: "ai-reader"; version: 1; state: AppNavigationState };

export function encodeNavigationHistory(state: AppNavigationState): HistoryV1 {
  return { app: "ai-reader", version: 1, state };
}

export function decodeNavigationHistory(value: unknown): AppNavigationState | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<HistoryV1>;
  if (payload.app !== "ai-reader" || payload.version !== 1 || !payload.state) return null;
  if (!Array.isArray(payload.state.pushes) || !Array.isArray(payload.state.sheets)) return null;
  if (!(["library", "reading", "settings"] as const).includes(payload.state.activeTab)) return null;
  return payload.state;
}
```

- [ ] **Step 3: Implement `useAppNavigation`**

Export this complete public type from `app/useAppNavigation.ts`:

```ts
type PushOptions = Omit<PushEntry, "key" | "kind" | "route">;
type ReaderOptions = Omit<ReaderEntry, "key" | "kind" | "bookId">;
type SheetOptions = Omit<SheetEntry, "key" | "kind" | "route">;

export type UseAppNavigationResult = {
  state: AppNavigationState;
  selectTab: (tab: NavigationTab) => void;
  push: (route: PushRoute, options?: PushOptions) => void;
  pop: () => void;
  presentReader: (bookId: string, options?: ReaderOptions) => void;
  dismissReader: () => void;
  presentSheet: (route: SheetRoute, options?: SheetOptions) => void;
  dismissSheet: () => void;
  removeInvalid: (key: string) => void;
};
```

Use `useReducer`, a monotonic key ref, and a state ref. Expose typed commands
`selectTab`, `push`, `pop`, `presentReader`, `dismissReader`, `presentSheet`,
and `dismissSheet`. Project each action through `reduceAppNavigation` before
calling `history.pushState`, preventing stale History payloads. Install one
`popstate` listener that dispatches `restore` for valid state and recovers to
`createAppNavigationState()` for invalid state.

- [ ] **Step 4: Add command context**

Create `app/NavigationProvider.tsx`:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UseAppNavigationResult } from "./useAppNavigation";

const NavigationContext = createContext<UseAppNavigationResult | null>(null);

export function NavigationProvider({ value, children }: { value: UseAppNavigationResult; children: ReactNode }) {
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): UseAppNavigationResult {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useNavigation requires NavigationProvider");
  return value;
}
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/navigationHistory.test.ts lib/appNavigation.test.ts
npm.cmd exec -- eslint app/useAppNavigation.ts app/NavigationProvider.tsx lib/navigationHistory.ts
```

Commit:

```powershell
git add app/useAppNavigation.ts app/NavigationProvider.tsx lib/navigationHistory.ts lib/navigationHistory.test.ts
git commit -m "feat: synchronize app navigation history"
```

## Task 4: Render Persistent Root Tabs Through NavigationStack

**Files:**

- Create: `app/NavigationStack.tsx`
- Modify: `app/page.tsx`
- Modify: `app/AppNavigation.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/navigationMotion.ts`
- Modify: `lib/navigationMotion.test.ts`
- Modify: `lib/persistentSurfaces.test.ts`

- [ ] **Step 1: Update failing root-stack tests**

Require all roots to remain unconditionally mounted inside NavigationStack.
Add a directional helper test expecting library-to-settings offsets
`{ outgoing: -12, incoming: 22 }` and the reverse signs for backward travel.

- [ ] **Step 2: Add root offsets**

```ts
export function getRootTabOffsets(from: NavigationTab, to: NavigationTab) {
  const direction = Math.sign(getNavigationTabIndex(to) - getNavigationTabIndex(from));
  return { outgoing: direction * -12, incoming: direction * 22 };
}
```

- [ ] **Step 3: Create NavigationStack**

Render three persistent `m.section` roots. Active root has opacity 1, x 0,
pointer events, and no inert attribute. Inactive roots have opacity 0, the
directional offset, pointer-events none, and `inert`. Store previous tab in a
ref so offsets do not flip during exit.

- [ ] **Step 4: Wire Home and tab indicator**

Create `navigation = useAppNavigation()` in Home, derive activeTab from its
state, wrap descendants in NavigationProvider, and pass root contents to
NavigationStack. Convert `.tabIndicator` to an `m.span` with layout ID
`root-tab-indicator` and `MOTION_SPRING.navigation`.

- [ ] **Step 5: Remove old root CSS transitions and verify**

Delete `.appSurfaceBefore` and `.appSurfaceAfter`; retain sizing, overflow, and
safe-area rules. Run:

```powershell
npm.cmd test -- --run lib/navigationMotion.test.ts lib/persistentSurfaces.test.ts lib/navigationVisibility.test.ts
npm.cmd exec -- eslint app/NavigationStack.tsx app/AppNavigation.tsx app/page.tsx
```

- [ ] **Step 6: Commit**

```powershell
git add app/NavigationStack.tsx app/AppNavigation.tsx app/page.tsx app/page.module.css lib/navigationMotion.ts lib/navigationMotion.test.ts lib/persistentSurfaces.test.ts
git commit -m "feat: move root tabs onto navigation stack"
```

## Task 5: Migrate Library and Settings Subviews to Push Entries

**Files:**

- Create: `app/AppPushSurfaces.tsx`
- Create: `app/AiSettingsSurface.tsx`
- Create: `app/LibraryCollectionsSurface.tsx`
- Create: `app/CustomBackgroundSettingsSurface.tsx`
- Modify: `app/LibrarySurface.tsx`
- Modify: `app/SettingsSurface.tsx`
- Modify: `app/AiSettingsSheet.tsx`
- Modify: `app/CustomBackgroundSettingsSheet.tsx`
- Modify: `app/NavigationStack.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/settingsSurface.test.ts`
- Modify: `lib/overlayMotionIntegration.test.ts`

- [ ] **Step 1: Write failing push-route integration assertions**

Update settings tests to require callbacks for `ai-providers` and
`custom-background` and to reject local custom-background sheet state. Update
overlay tests to reject `subviewEnterForward` and `subviewEnterBackward` in
LibrarySurface and AI settings.

- [ ] **Step 2: Extract AI settings content**

Create `app/AiSettingsSurface.tsx` by moving list/configure content and draft
state from AiSettingsSheet. Use this exact public shape:

```ts
type Props = {
  mode: "list" | "configure";
  settings: AiProviderSettings;
  providerId?: string;
  onPushConfigure: (providerId?: string) => void;
  onBack: () => void;
  onSave: (settings: AiProviderSettings) => void;
};
```

The provider list pushes `ai-provider-configure`; save pops. Preserve existing
sanitization, model refresh, and provider draft behavior. Remove local
`modeMotion` and standalone keyframe classes.

- [ ] **Step 3: Create the pushed-surface registry**

Create `app/AppPushSurfaces.tsx`:

```tsx
import type { ComponentProps } from "react";
import type { PushEntry } from "@/lib/appNavigation";

type Props = {
  entry: PushEntry;
  data: {
    collections: Omit<ComponentProps<typeof LibraryCollectionsSurface>, "onBack">;
    ai: Omit<ComponentProps<typeof AiSettingsSurface>, "mode" | "providerId" | "onBack" | "onPushConfigure">;
    background: Omit<ComponentProps<typeof CustomBackgroundSettingsSurface>, "onBack">;
  };
  actions: {
    pop: () => void;
    pushAiProvider: (providerId?: string) => void;
  };
};

export default function AppPushSurfaces({ entry, data, actions }: Props) {
  switch (entry.route) {
    case "collections":
      return <LibraryCollectionsSurface {...data.collections} onBack={actions.pop} />;
    case "ai-providers":
      return <AiSettingsSurface mode="list" {...data.ai} onPushConfigure={actions.pushAiProvider} onBack={actions.pop} />;
    case "ai-provider-configure":
      return <AiSettingsSurface mode="configure" providerId={entry.entityId} {...data.ai} onPushConfigure={actions.pushAiProvider} onBack={actions.pop} />;
    case "custom-background":
      return <CustomBackgroundSettingsSurface {...data.background} onBack={actions.pop} />;
  }
}
```

Export each new surface's Props type, extract the existing collections branch
and custom-background body into those components, and keep the compatibility
sheet as a wrapper around CustomBackgroundSettingsSurface until all callers
migrate.

- [ ] **Step 4: Extend NavigationStack with push presence**

Render pushed entries above roots with AnimatePresence. Incoming pages travel
from `100%` to zero; outgoing pages reverse. The previous layer travels between
zero and `-30%` with a small brightness reduction. Keep only the top two layers
interactive or visually active.

- [ ] **Step 5: Replace old local navigation states**

Replace `libraryScreen`, AI settings sheet state, and custom-background sheet
state with `navigation.push()` and `navigation.pop()`. Keep form drafts and
selected entity IDs in their existing business owners.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/settingsSurface.test.ts lib/overlayMotionIntegration.test.ts lib/surfaceArchitecture.test.ts
npm.cmd exec -- eslint app/AppPushSurfaces.tsx app/AiSettingsSurface.tsx app/LibrarySurface.tsx app/SettingsSurface.tsx app/NavigationStack.tsx app/page.tsx
```

Commit:

```powershell
git add app/AppPushSurfaces.tsx app/AiSettingsSurface.tsx app/AiSettingsSheet.tsx app/LibrarySurface.tsx app/SettingsSurface.tsx app/NavigationStack.tsx app/page.tsx lib/settingsSurface.test.ts lib/overlayMotionIntegration.test.ts
git commit -m "feat: migrate subviews to native push navigation"
```

## Task 6: Add Shared Book-Cover Reader Presentation

**Files:**

- Create: `lib/sharedBookTransition.ts`
- Create: `lib/sharedBookTransition.test.ts`
- Create: `app/MotionBookCover.tsx`
- Create: `app/SharedBookTransition.tsx`
- Modify: `app/LibrarySurface.tsx`
- Modify: `app/ReadingDashboard.tsx`
- Modify: `app/ReadingSession.tsx`
- Modify: `app/page.tsx`
- Delete: `app/useReaderPresentation.ts` after migration

- [ ] **Step 1: Write the source/fallback test**

```ts
import { describe, expect, it } from "vitest";
import { getBookTransitionMode } from "./sharedBookTransition";

describe("shared book transition", () => {
  it("uses shared motion only for a visible matching source", () => {
    expect(getBookTransitionMode(true, "book-1", "book-1")).toBe("shared");
    expect(getBookTransitionMode(false, "book-1", "book-1")).toBe("fallback");
    expect(getBookTransitionMode(true, "book-1", "book-2")).toBe("fallback");
  });
});
```

Create the pure helper with the following implementation, then run the focused
test to green.

Create `lib/sharedBookTransition.ts`:

```ts
export type BookTransitionMode = "shared" | "fallback";

export function getBookTransitionMode(
  sourceVisible: boolean,
  sourceBookId: string | null,
  activeBookId: string
): BookTransitionMode {
  return sourceVisible && sourceBookId === activeBookId ? "shared" : "fallback";
}
```

- [ ] **Step 2: Create a stable cover wrapper**

Create `app/MotionBookCover.tsx`:

```tsx
"use client";

import { m } from "motion/react";
import BookCover from "./BookCover";
import { MOTION_SPRING } from "@/lib/motionSystem";
import type { BookRecord } from "@/lib/db";

export const bookCoverLayoutId = (bookId: string) => `book-cover-${bookId}`;

export default function MotionBookCover({ book }: { book: BookRecord }) {
  return (
    <m.div layoutId={bookCoverLayoutId(book.id)} transition={MOTION_SPRING.sharedBook} data-book-cover-origin={book.id}>
      <BookCover title={book.title} format={book.format} coverImageBlob={book.coverImageBlob} />
    </m.div>
  );
}
```

- [ ] **Step 3: Build the shared transition layer**

Create SharedBookTransition with an IntersectionObserver map of visible source
IDs. Render a fixed transition cover with the same layout ID while the reader
mounts. Fade reader content in during the middle of the cover transition. On
close, reverse to a still-visible source; otherwise animate a centered cover to
`{ scale: 0.88, opacity: 0 }`. Release source snapshots on completion and
cancellation.

- [ ] **Step 4: Migrate all book entry points**

Use MotionBookCover in grid, list, and continue-reading cards. Pass origin ID to
`presentReader`. Replace two-frame reader presentation state with the navigation
reader entry and AnimatePresence completion. Keep the reader mounted through
exit and leave EPUB iframe geometry outside Motion layout projection.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/sharedBookTransition.test.ts lib/persistentSurfaces.test.ts lib/readerChromeIntegration.test.ts lib/bookCoverLoading.test.ts
npm.cmd exec -- eslint app/MotionBookCover.tsx app/SharedBookTransition.tsx app/LibrarySurface.tsx app/ReadingDashboard.tsx app/ReadingSession.tsx app/page.tsx
```

Commit:

```powershell
git add app/MotionBookCover.tsx app/SharedBookTransition.tsx app/LibrarySurface.tsx app/ReadingDashboard.tsx app/ReadingSession.tsx app/page.tsx lib/sharedBookTransition.ts lib/sharedBookTransition.test.ts lib/persistentSurfaces.test.ts
git add -u app/useReaderPresentation.ts
git commit -m "feat: add shared book reader presentation"
```

## Task 7: Coordinate Reader Chrome as One State

**Files:**

- Modify: `app/ReaderControls.tsx`
- Modify: `app/ReadingSession.tsx`
- Modify: `app/page.module.css`
- Modify: `lib/readerChromeIntegration.test.ts`
- Modify: `lib/readerMenuIntegration.test.ts`

- [ ] **Step 1: Change tests from nth-child delays to parent variants**

Require one Motion parent with `visible` and `hidden` variants, row staggering
between 30 and 40 ms, reverse exit order, and a wake button outside the hidden
subtree. Reject CSS nth-child transition delays.

- [ ] **Step 2: Implement coordinated variants**

```ts
const chromeVariants = {
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
  hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
};

const menuRowVariants = {
  visible: { opacity: 1, y: 0, scale: 1 },
  hidden: { opacity: 0, y: 14, scale: 0.96 },
};
```

Drive menu rows, page pill, and close button from the parent. Preserve the wake
button as always mounted and clickable. Use animation completion to update
inert state rather than delayed CSS visibility.

- [ ] **Step 3: Delete conflicting CSS choreography**

Remove nth-child delays and transform/opacity transitions now owned by Motion.
Retain materials, dimensions, active feedback, focus, safe-area, and pointer
rules.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/readerChromeIntegration.test.ts lib/readerMenuIntegration.test.ts lib/readerChromeState.test.ts lib/readerTapZones.test.ts
npm.cmd exec -- eslint app/ReaderControls.tsx app/ReadingSession.tsx
```

Commit:

```powershell
git add app/ReaderControls.tsx app/ReadingSession.tsx app/page.module.css lib/readerChromeIntegration.test.ts lib/readerMenuIntegration.test.ts
git commit -m "feat: coordinate reader chrome motion"
```

## Task 8: Replace BottomSheet with MotionSheet

**Files:**

- Create: `app/MotionSheet.tsx`
- Modify: `app/BottomSheet.tsx`
- Create: `lib/navigationGestures.ts`
- Create: `lib/navigationGestures.test.ts`
- Modify: `lib/motionInteractions.test.ts`
- Modify: `lib/overlayMotionIntegration.test.ts`

- [ ] **Step 1: Write sheet ownership tests**

```ts
import { describe, expect, it } from "vitest";
import { canSheetClaimGesture, shouldCompleteSheetDismiss } from "./navigationGestures";

describe("sheet gestures", () => {
  it("claims headers and top-of-scroll downward body drags", () => {
    expect(canSheetClaimGesture({ fromHeader: true, scrollTop: 80, deltaY: 12 })).toBe(true);
    expect(canSheetClaimGesture({ fromHeader: false, scrollTop: 0, deltaY: 12 })).toBe(true);
    expect(canSheetClaimGesture({ fromHeader: false, scrollTop: 20, deltaY: 12 })).toBe(false);
  });

  it("dismisses by distance or velocity", () => {
    expect(shouldCompleteSheetDismiss(180, 100, 520)).toBe(true);
    expect(shouldCompleteSheetDismiss(40, 950, 520)).toBe(true);
    expect(shouldCompleteSheetDismiss(40, 180, 520)).toBe(false);
  });
});
```

- [ ] **Step 2: Implement pure decisions**

```ts
export function canSheetClaimGesture(input: { fromHeader: boolean; scrollTop: number; deltaY: number }): boolean {
  return input.deltaY > 0 && (input.fromHeader || input.scrollTop <= 0);
}

export function shouldCompleteSheetDismiss(offsetY: number, velocityY: number, sheetHeight: number): boolean {
  const distance = Math.min(140, Math.max(1, sheetHeight) * 0.28);
  return offsetY >= distance || (velocityY >= 900 && offsetY >= 24);
}
```

- [ ] **Step 3: Build interruptible MotionSheet**

Use AnimatePresence, `m.div`, `useMotionValue`, `useTransform`, and vertical
drag. Set top constraint to zero and downward elastic to 0.08. Resolve release
with `shouldCompleteSheetDismiss`; call onClose only after exit completion,
guarded for exactly-once semantics. Provide progress through context so the
presenting surface scales to 0.98, gains an 18px radius, and dims without
animating blur.

Preserve the exact existing public contract:

```ts
type CloseSheet = (afterClose?: () => void) => void;
type MotionSheetProps = {
  onClose: () => void;
  children: ReactNode | ((close: CloseSheet) => ReactNode);
  className?: string;
  ariaLabel?: string;
  showGrabber?: boolean;
};
```

- [ ] **Step 4: Turn BottomSheet into an adapter**

```tsx
export default function BottomSheet(props: Props) {
  return <MotionSheet {...props} />;
}
```

Delete the old phase timer, pointer state, transition-end listener, and manual
style mutation.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/navigationGestures.test.ts lib/motionInteractions.test.ts lib/overlayMotionIntegration.test.ts
npm.cmd exec -- eslint app/MotionSheet.tsx app/BottomSheet.tsx lib/navigationGestures.ts
```

Commit:

```powershell
git add app/MotionSheet.tsx app/BottomSheet.tsx lib/navigationGestures.ts lib/navigationGestures.test.ts lib/motionInteractions.test.ts lib/overlayMotionIntegration.test.ts
git commit -m "feat: replace sheets with interruptible motion"
```

## Task 9: Migrate Every Overlay into the Sheet Layer

**Files:**

- Modify: `app/AppOverlays.tsx`
- Modify: `app/ReaderSettingsPanel.tsx`
- Modify: `app/ReaderCustomSettingsPanel.tsx`
- Modify: `app/TocDrawer.tsx`
- Modify: `app/ReadingGoalSheet.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `lib/readingGoalOverlayIntegration.test.ts`
- Modify: `lib/askAiReaderContextIntegration.test.ts`

- [ ] **Step 1: Require one sheet route registry**

Update tests so AppOverlays reads `navigation.state.sheets.at(-1)?.route`,
renders one top sheet, and does not conditionally mount independent sheets from
open booleans.

- [ ] **Step 2: Convert AppOverlays to a switch**

Use this route coverage:

```tsx
switch (sheet.route) {
  case "reader-settings": return <ReaderSettingsPanel {...readerSettingsProps} onClose={navigation.dismissSheet} />;
  case "reader-custom-settings": return <ReaderCustomSettingsPanel {...readerCustomProps} onClose={navigation.dismissSheet} />;
  case "toc": return <TocDrawer {...tocProps} onClose={navigation.dismissSheet} />;
  case "ask-ai": return <AskAiSheet {...askProps} onClose={navigation.dismissSheet} />;
  case "reading-goal": return <ReadingGoalSheet {...goalProps} onClose={navigation.dismissSheet} />;
  case "book-actions": return <BookActionSheet bookId={sheet.entityId} {...bookActionProps} />;
  case "book-delete": return <BookDeleteSheet bookId={sheet.entityId} {...bookActionProps} />;
  case "book-groups": return <BookGroupSheet bookId={sheet.entityId} {...groupProps} />;
  case "batch-groups": return <BatchGroupSheet {...libraryProps} />;
  case "batch-delete": return <BatchDeleteSheet {...libraryProps} />;
  case "collection-create": return <CollectionCreateSheet {...libraryProps} />;
}
```

Extract existing inline bodies into named local components so each route has a
single owner.

- [ ] **Step 3: Remove sheet-open booleans from Home**

Keep selected entity IDs and drafts. Replace open setters with
`presentSheet(route, { entityId, restoreFocusId })` and `dismissSheet()`.
Reader custom settings pushes a second sheet entry so the reader settings sheet
remains underneath and reappears on pop.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/askAiReaderContextIntegration.test.ts lib/libraryBookActionsIntegration.test.ts
npm.cmd exec -- eslint app/AppOverlays.tsx app/ReaderSettingsPanel.tsx app/ReaderCustomSettingsPanel.tsx app/TocDrawer.tsx app/ReadingGoalSheet.tsx app/page.tsx
```

Commit:

```powershell
git add app/AppOverlays.tsx app/ReaderSettingsPanel.tsx app/ReaderCustomSettingsPanel.tsx app/TocDrawer.tsx app/ReadingGoalSheet.tsx app/page.tsx lib/overlayMotionIntegration.test.ts lib/readingGoalOverlayIntegration.test.ts lib/askAiReaderContextIntegration.test.ts
git commit -m "feat: unify overlays in navigation sheet layer"
```

## Task 10: Add Edge-Back and Complete Gesture Arbitration

**Files:**

- Modify: `lib/navigationGestures.ts`
- Modify: `lib/navigationGestures.test.ts`
- Modify: `app/NavigationStack.tsx`
- Modify: `app/MotionSheet.tsx`
- Modify: `app/EpubReader.tsx`
- Modify: `app/ReadingSession.tsx`
- Modify: `lib/epubTapInteractions.test.ts`
- Modify: `lib/readerSwipe.test.ts`

- [ ] **Step 1: Write edge-back tests**

```ts
it("starts only from the left edge on a push page", () => {
  expect(canStartEdgeBack({ clientX: 18, hasPush: true, inReader: false })).toBe(true);
  expect(canStartEdgeBack({ clientX: 30, hasPush: true, inReader: false })).toBe(false);
  expect(canStartEdgeBack({ clientX: 10, hasPush: true, inReader: true })).toBe(false);
});

it("completes from distance or directional velocity", () => {
  expect(shouldCompleteEdgeBack(130, 120, 390)).toBe(true);
  expect(shouldCompleteEdgeBack(42, 720, 390)).toBe(true);
  expect(shouldCompleteEdgeBack(42, 120, 390)).toBe(false);
});
```

- [ ] **Step 2: Implement edge decisions**

```ts
export function canStartEdgeBack(input: { clientX: number; hasPush: boolean; inReader: boolean }): boolean {
  return input.hasPush && !input.inReader && input.clientX >= 0 && input.clientX <= 20;
}

export function shouldCompleteEdgeBack(offsetX: number, velocityX: number, viewportWidth: number): boolean {
  return offsetX >= viewportWidth * 0.3 || (velocityX >= 620 && offsetX >= 28);
}
```

- [ ] **Step 3: Drive interactive stack progress outside React renders**

Use a Motion x value on the top push page. Claim only after horizontal motion
exceeds 12px and dominates vertical movement by 1.25. Derive previous-page x
and brightness with useTransform. On release animate to viewport width and pop
on completion, or spring to zero.

Mark reader pointer sequences as reader-owned before parent capture. Do not add
edge-back to ReaderPresentation. Keep epub.js selection, pinch, scrolling, and
TXT/EPUB page-turn handlers authoritative.

- [ ] **Step 4: Verify conflicts and commit**

Run:

```powershell
npm.cmd test -- --run lib/navigationGestures.test.ts lib/epubTapInteractions.test.ts lib/readerSwipe.test.ts lib/motionInteractions.test.ts
npm.cmd exec -- eslint app/NavigationStack.tsx app/MotionSheet.tsx app/EpubReader.tsx app/ReadingSession.tsx
```

Commit:

```powershell
git add lib/navigationGestures.ts lib/navigationGestures.test.ts app/NavigationStack.tsx app/MotionSheet.tsx app/EpubReader.tsx app/ReadingSession.tsx lib/epubTapInteractions.test.ts lib/readerSwipe.test.ts
git commit -m "feat: add native edge back gesture"
```

## Task 11: Coordinate Lists, Ask AI, Settings, Statistics, and Ambient Motion

**Files:**

- Create: `app/AnimatedNumber.tsx`
- Modify: `app/LibrarySurface.tsx`
- Modify: `app/AskAiPanel.tsx`
- Modify: `app/SettingsSurface.tsx`
- Modify: `app/ReadingDashboard.tsx`
- Modify: `app/AmbientBookBackground.tsx`
- Modify: `app/page.module.css`
- Modify: focused integration tests for each surface

- [ ] **Step 1: Write integration assertions**

Require library items to use stable layout position and removal presence.
Require assistant messages to mount by message ID rather than streamed text.
Require statistics to use AnimatedNumber and data-keyed bars. Require ambient
transitions only when background identity changes.

- [ ] **Step 2: Implement AnimatedNumber**

Create `app/AnimatedNumber.tsx`:

```tsx
"use client";

import { AnimatePresence, m } from "motion/react";
import { MOTION_DURATION } from "@/lib/motionSystem";

export default function AnimatedNumber({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-grid", fontVariantNumeric: "tabular-nums" }}>
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={value}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: MOTION_DURATION.state }}
          style={{ gridArea: "1 / 1" }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
```

- [ ] **Step 3: Add bounded list and message motion**

Wrap book collections in LayoutGroup. Items use stable book IDs,
`layout="position"`, and exit `{ opacity: 0, scale: 0.96 }`. Limit a newly
loaded batch to the first six delays at 30ms each. Existing items do not replay
entrance after filter or route return.

User messages enter immediately. Assistant containers enter once when the
message object appears. Never key or animate by streamed text content.

- [ ] **Step 4: Coordinate settings, statistics, and ambient state**

Use layout IDs for segmented indicators and switch thumbs while preserving
native inputs. Replace week-bar entry keyframes with data-keyed scaleY changes.
Use AnimatedNumber for reading values. Wrap ambient layers in AnimatePresence,
crossfade only on background identity change, and keep blur static.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm.cmd test -- --run lib/askAiReaderContextIntegration.test.ts lib/settingsSurface.test.ts lib/readingDashboardCss.test.ts lib/ambientBookBackground.test.ts
npm.cmd exec -- eslint app/AnimatedNumber.tsx app/LibrarySurface.tsx app/AskAiPanel.tsx app/SettingsSurface.tsx app/ReadingDashboard.tsx app/AmbientBookBackground.tsx
```

Commit:

```powershell
git add app/AnimatedNumber.tsx app/LibrarySurface.tsx app/AskAiPanel.tsx app/SettingsSurface.tsx app/ReadingDashboard.tsx app/AmbientBookBackground.tsx app/page.module.css lib/askAiReaderContextIntegration.test.ts lib/settingsSurface.test.ts lib/readingDashboardCss.test.ts lib/ambientBookBackground.test.ts
git commit -m "feat: coordinate application state motion"
```

## Task 12: Remove Legacy Motion and Idle Compositing Hints

**Files:**

- Modify: `app/page.module.css`
- Modify: `app/page.tsx`
- Modify: `lib/motionCss.test.ts`
- Modify: `lib/overlayMotionIntegration.test.ts`
- Modify: `lib/navigationVisibility.test.ts`
- Modify: `lib/surfaceArchitecture.test.ts`

- [ ] **Step 1: Write cleanup assertions**

```ts
for (const legacy of [
  "subviewInForward",
  "subviewInBackward",
  "motionSheetEntering",
  "motionSheetSettling",
  "motionSheetClosing",
  "readerSessionInactive",
]) {
  expect(css + pageSource).not.toContain(legacy);
}
```

Assert `will-change` appears only in explicit active motion or dragging states.

- [ ] **Step 2: Delete superseded motion**

Remove old root transitions, subview keyframes, sheet phase classes, reader
presentation transitions, row delays, timers, manual transform style mutation,
and permanent `will-change`. Preserve layout, safe-area, material, theme,
responsive, active, focus, and pointer rules.

- [ ] **Step 3: Verify architecture and commit**

Run:

```powershell
npm.cmd test -- --run lib/motionCss.test.ts lib/overlayMotionIntegration.test.ts lib/navigationVisibility.test.ts lib/surfaceArchitecture.test.ts lib/persistentSurfaces.test.ts
npm.cmd exec -- eslint app lib
```

Commit:

```powershell
git add app/page.module.css app/page.tsx lib/motionCss.test.ts lib/overlayMotionIntegration.test.ts lib/navigationVisibility.test.ts lib/surfaceArchitecture.test.ts lib/persistentSurfaces.test.ts
git commit -m "refactor: remove legacy navigation motion"
```

## Task 13: Add Mobile Browser and Performance Verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `e2e/native-navigation.spec.ts`
- Create: `e2e/fixtures/sample.txt`

- [ ] **Step 1: Install Playwright**

Run:

```powershell
npm.cmd install --save-dev @playwright/test
npx.cmd playwright install chromium
```

- [ ] **Step 2: Configure mobile projects**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3010", trace: "retain-on-failure" },
  webServer: {
    command: "npm.cmd run dev -- --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: true,
  },
  projects: [
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
    { name: "iphone-15-pro-max", use: { ...devices["iPhone 15 Pro Max"] } },
  ],
});
```

- [ ] **Step 3: Add full navigation browser tests**

Add stable `data-navigation-tab`, `data-push-route`, `data-reader-presented`, and
`data-sheet-route` attributes in the corresponding stack components. Create a
TXT fixture containing at least 80 newline-separated paragraphs so scroll and
reader gestures have real overflow.

Start `e2e/native-navigation.spec.ts` with this executable core flow:

```ts
import { expect, test } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"][accept=".epub,.txt"]').setInputFiles(
    path.join(process.cwd(), "e2e/fixtures/sample.txt")
  );
  await expect(page.locator('[data-book-cover-origin]')).toBeVisible();
});

test("reader presentation returns to its source", async ({ page }) => {
  const source = page.locator('[data-book-cover-origin]').first();
  const sourceButton = source.locator("xpath=ancestor::button[1]");
  const sourceId = await source.getAttribute("data-book-cover-origin");
  await sourceButton.click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await page.getByRole("button", { name: /close|关闭/i }).first().click();
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await expect(sourceButton).toBeFocused();
  await expect(page.locator(`[data-book-cover-origin="${sourceId}"]`)).toBeVisible();
});

test("push and browser back resolve to the same stack", async ({ page }) => {
  await page.getByRole("button", { name: /collections|藏书集合/i }).click();
  await expect(page.locator('[data-push-route="collections"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(0);
});

test("reader swipe never becomes edge back", async ({ page }) => {
  await page.locator('[data-book-cover-origin]').first().click();
  const reader = page.locator('[data-reader-presented="true"]');
  const box = await reader.boundingBox();
  if (!box) throw new Error("reader box missing");
  await page.mouse.move(box.x + 12, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(reader).toBeVisible();
});
```

Add table-driven tests for root scroll retention; collections, AI providers,
provider configuration, and custom-background push routes; all eleven sheet
routes; visible-button versus edge-back outcomes; keyboard-open Ask AI; and
the same core paths after enabling reduced motion.

Capture start, midpoint, and completion screenshots for one root, push, reader,
and sheet transition under `test-results/native-navigation/`.

- [ ] **Step 4: Add a frame-cadence probe**

Sample requestAnimationFrame for 800ms during representative transitions.
Require at least 40 frames and no interval over 80ms in emulation. Observe long
tasks and fail over 100ms in CI; preserve 50ms as the physical-device target.

- [ ] **Step 5: Run and commit**

Run: `npx.cmd playwright test e2e/native-navigation.spec.ts`

Commit:

```powershell
git add package.json package-lock.json playwright.config.ts e2e/native-navigation.spec.ts e2e/fixtures/sample.txt
git commit -m "test: verify native navigation on mobile"
```

## Task 14: Audit, Deploy, and Refresh Handoff

**Files:**

- Modify: `HANDOFF.md`

- [ ] **Step 1: Audit every design completion criterion**

Use `docs/superpowers/specs/2026-07-12-native-navigation-motion-design.md` as
the checklist. Map each criterion to a source file, unit test, browser result,
performance result, or production asset. Continue implementation for any item
with indirect or missing evidence.

- [ ] **Step 2: Run complete verification**

Run:

```powershell
npm.cmd test -- --run
npm.cmd exec -- eslint app lib e2e playwright.config.ts
npm.cmd run build
git diff --check
git status -sb
```

Expected: all tests pass, lint is clean, webpack build passes, and no unrelated
user changes are staged.

- [ ] **Step 3: Run production-mode mobile verification**

Start `next start` on an unused local port and rerun Playwright against it.
Verify root, push, reader, sheet, History, reduced motion, keyboard, and reader
gesture paths.

- [ ] **Step 4: Deploy OpenNext on Windows**

```powershell
npm.cmd run build
node node_modules\@opennextjs\cloudflare\dist\cli\index.js build --skipNextBuild
node node_modules\@opennextjs\cloudflare\dist\cli\index.js deploy
```

Expected: Worker `ai-reader-pwa`, route `881817.xyz/*`, and a new Version ID.

- [ ] **Step 5: Verify production assets**

Fetch the cache-busted production root:

```powershell
$nonce = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$html = curl.exe -ksSL --http1.1 "https://881817.xyz/?deploy=$nonce"
```

Confirm new JS contains the navigation stack, Motion runtime, sheet routes,
and book layout identities.
Confirm production CSS has no legacy subview or sheet phase keyframes.

- [ ] **Step 6: Update HANDOFF and push**

Record the latest code commit, architecture, migrated surfaces, gesture rules,
reduced-motion behavior, all test/build/browser/performance results, production
assets, Worker Version ID, and physical-iPhone residual risk.

```powershell
git add HANDOFF.md
git commit -m "docs: sync native navigation deployment"
git push origin codex/custom-background-settings
git status -sb
```

Expected: local and origin branch match with a clean worktree.
