"use client";

import { AnimatePresence, m, useIsPresent } from "motion/react";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { NavigationDirection, SheetEntry } from "@/lib/appNavigation";
import { getRoleTransition } from "@/lib/motionSystem";
import {
  getSheetPageBoundary,
  getSheetPageTarget,
  getSheetViewportHeight,
} from "@/lib/sheetStackMotion";
import { useAppReducedMotion } from "./AppMotionRoot";
import type { CloseSheet } from "./BottomSheet";
import styles from "./page.module.css";

export type SheetPageRenderControls = {
  back: CloseSheet;
  dismiss: CloseSheet;
  depth: number;
  isRoot: boolean;
};

export type SheetPageStackProps = {
  entries: SheetEntry[];
  direction: NavigationDirection;
  renderPage: (
    entry: SheetEntry,
    controls: SheetPageRenderControls
  ) => ReactNode;
  onBack: () => void;
  dismiss: CloseSheet;
};

type PresenceContext = {
  direction: NavigationDirection;
  reduceMotion: boolean;
};

type PendingBack = {
  key: string;
  generation: number;
  afterBack?: () => void;
};

type IntentSnapshot = {
  direction: NavigationDirection;
  entryKeys: string[];
  entryTokens: string[];
};

type MeasuredSheetPageProps = {
  active: boolean;
  depth: number;
  dismiss: CloseSheet;
  entry: SheetEntry;
  initialTarget: { opacity: number; x: number };
  isRoot: boolean;
  presenceContext: PresenceContext;
  renderPage: SheetPageStackProps["renderPage"];
  target: { opacity: number; x: number };
  onAnimationComplete: (entryKey: string, didExit: boolean) => void;
  onBackRequest: (entryKey: string, afterBack?: () => void) => void;
  onElementChange: (entryKey: string, element: HTMLDivElement | null) => void;
  onHeightChange: (entryKey: string, height: number | null) => void;
};

type HeightSnapshot = {
  version: number;
  values: Map<string, number>;
  lastActiveHeight: number | undefined;
};

type HeightSnapshotUpdate = {
  values: Map<string, number>;
  lastActiveHeight?: number;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const pageVariants = {
  exit: (context: PresenceContext) => ({
    ...getSheetPageBoundary(context.direction, "exit", context.reduceMotion),
    transition: getRoleTransition("push-exit", context.reduceMotion),
  }),
};

function sameEntries(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function MeasuredSheetPage({
  active,
  depth,
  dismiss,
  entry,
  initialTarget,
  isRoot,
  presenceContext,
  renderPage,
  target,
  onAnimationComplete,
  onBackRequest,
  onElementChange,
  onHeightChange,
}: MeasuredSheetPageProps) {
  const entryKey = entry.key;
  const pageRef = useRef<HTMLDivElement>(null);
  const isPresent = useIsPresent();
  const isActive = active && isPresent;
  const { reduceMotion } = presenceContext;

  useLayoutEffect(() => {
    const element = pageRef.current;
    if (!element) return;

    onElementChange(entryKey, element);

    const reportHeight = (height: number) => {
      if (Number.isFinite(height) && height >= 0) {
        onHeightChange(entryKey, height);
      }
    };

    reportHeight(element.getBoundingClientRect().height);

    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((records) => {
          const record = records.find((candidate) => candidate.target === element);
          if (record) reportHeight(record.contentRect.height);
        });

    observer?.observe(element);

    return () => {
      observer?.disconnect();
      onElementChange(entryKey, null);
      onHeightChange(entryKey, null);
    };
  }, [entryKey, onElementChange, onHeightChange]);

  return (
    <m.div
      ref={pageRef}
      className={styles.sheetPage}
      custom={presenceContext}
      variants={pageVariants}
      initial={initialTarget}
      animate={target}
      exit="exit"
      transition={getRoleTransition("push-enter", reduceMotion)}
      onAnimationComplete={(definition) => {
        if (definition === "exit") {
          onAnimationComplete(entryKey, true);
          return;
        }
        if (isActive) onAnimationComplete(entryKey, false);
      }}
      data-sheet-page
      data-sheet-page-active={isActive}
      aria-hidden={isActive ? undefined : true}
      inert={isActive ? undefined : true}
      tabIndex={-1}
    >
      {renderPage(entry, {
        back: isActive
          ? (afterBack) => onBackRequest(entryKey, afterBack)
          : () => undefined,
        dismiss,
        depth,
        isRoot,
      })}
    </m.div>
  );
}

export default function SheetPageStack({
  entries,
  direction,
  renderPage,
  onBack,
  dismiss,
}: SheetPageStackProps) {
  const reduceMotion = useAppReducedMotion();
  const heightsRef = useRef(new Map<string, number>());
  const pageElementsRef = useRef(new Map<string, HTMLDivElement>());
  const [heightSnapshot, bumpHeightVersion] = useReducer(
    (snapshot: HeightSnapshot, update: HeightSnapshotUpdate): HeightSnapshot => ({
      version: snapshot.version + 1,
      values: new Map(update.values),
      lastActiveHeight:
        update.lastActiveHeight ?? snapshot.lastActiveHeight,
    }),
    {
      version: 0,
      values: new Map<string, number>(),
      lastActiveHeight: undefined,
    }
  );
  const intentGenerationRef = useRef(0);
  const pendingBackRef = useRef<PendingBack | null>(null);
  const mountedRef = useRef(true);
  const activeEntryKeyRef = useRef<string | undefined>(entries[entries.length - 1]?.key);
  const currentEntryKeysRef = useRef(new Set(entries.map((entry) => entry.key)));
  const focusGuardRef = useRef({
    key: entries[entries.length - 1]?.key ?? "",
    generation: 0,
  });
  const lastFocusedGenerationRef = useRef(-1);
  const hasMountedRef = useRef(false);
  const [emptyExitComplete, markEmptyExitComplete] = useReducer(
    (_current: boolean, next: boolean) => next,
    false
  );

  const entryKeys = useMemo(() => entries.map((entry) => entry.key), [entries]);
  const entryTokens = useMemo(
    () => entries.map((entry) => JSON.stringify(entry)),
    [entries]
  );
  const intentSignature = JSON.stringify(entryTokens);
  const activeEntryKey = entryKeys[entryKeys.length - 1];
  const previousIntentRef = useRef<IntentSnapshot>({
    direction,
    entryKeys,
    entryTokens,
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const previous = previousIntentRef.current;
    const stackChanged = !sameEntries(previous.entryTokens, entryTokens);
    const directionChanged = previous.direction !== direction;

    if (stackChanged || directionChanged) {
      const pending = pendingBackRef.current;
      const expectedTokens = previous.entryTokens.slice(0, -1);
      const previousTopKey = previous.entryKeys[previous.entryKeys.length - 1];
      const isExpectedBackRemoval = Boolean(
        pending &&
        direction === "backward" &&
        pending.key === previousTopKey &&
        sameEntries(entryTokens, expectedTokens)
      );

      if (!isExpectedBackRemoval) {
        intentGenerationRef.current += 1;
        pendingBackRef.current = null;
      }

      focusGuardRef.current = {
        key: activeEntryKey ?? "",
        generation: focusGuardRef.current.generation + 1,
      };
      lastFocusedGenerationRef.current = -1;
    }

    activeEntryKeyRef.current = activeEntryKey;
    currentEntryKeysRef.current = new Set(entryKeys);
    previousIntentRef.current = { direction, entryKeys, entryTokens };
  }, [activeEntryKey, direction, entryKeys, entryTokens, intentSignature]);

  const handleElementChange = useCallback(
    (entryKey: string, element: HTMLDivElement | null) => {
      if (element) pageElementsRef.current.set(entryKey, element);
      else pageElementsRef.current.delete(entryKey);
    },
    []
  );

  const handleHeightChange = useCallback(
    (entryKey: string, height: number | null) => {
      if (!mountedRef.current) return;
      const heights = heightsRef.current;
      if (height === null) {
        if (heights.delete(entryKey)) {
          bumpHeightVersion({ values: heights });
        }
        return;
      }
      if (heights.get(entryKey) === height) return;
      heights.set(entryKey, height);
      const measuredActivePage =
        activeEntryKeyRef.current === entryKey && height > 0;
      bumpHeightVersion({
        values: heights,
        lastActiveHeight: measuredActivePage ? height : undefined,
      });
      if (measuredActivePage) {
        markEmptyExitComplete(false);
      }
    },
    []
  );

  const focusActivePage = useCallback((entryKey: string, generation: number) => {
    const guard = focusGuardRef.current;
    if (
      guard.key !== entryKey ||
      guard.generation !== generation ||
      lastFocusedGenerationRef.current === generation
    ) {
      return;
    }

    const activePage = pageElementsRef.current.get(entryKey);
    if (!activePage || activeEntryKeyRef.current !== entryKey) return;
    if (
      typeof document !== "undefined" &&
      activePage.contains(document.activeElement)
    ) {
      lastFocusedGenerationRef.current = generation;
      return;
    }

    const autofocus = activePage.querySelector<HTMLElement>(
      '[data-sheet-autofocus="true"]'
    );
    if (autofocus) {
      autofocus.focus({ preventScroll: true });
      lastFocusedGenerationRef.current = generation;
      return;
    }

    const firstFocusable = activePage.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) {
      firstFocusable.focus({ preventScroll: true });
      lastFocusedGenerationRef.current = generation;
      return;
    }

    activePage.focus({ preventScroll: true });
    lastFocusedGenerationRef.current = generation;
  }, []);

  const finishPageAnimation = useCallback(
    (entryKey: string, didExit: boolean) => {
      if (didExit) {
        const pending = pendingBackRef.current;
        if (!pending || pending.key !== entryKey) return;
        if (pending.generation !== intentGenerationRef.current) return;
        if (currentEntryKeysRef.current.has(entryKey)) return;

        pendingBackRef.current = null;
        pending.afterBack?.();
        return;
      }

      const guard = focusGuardRef.current;
      focusActivePage(entryKey, guard.generation);
    },
    [focusActivePage]
  );

  const requestBack = useCallback(
    (entryKey: string, afterBack?: () => void) => {
      if (activeEntryKeyRef.current !== entryKey || pendingBackRef.current) return;

      intentGenerationRef.current += 1;
      pendingBackRef.current = {
        key: entryKey,
        generation: intentGenerationRef.current,
        afterBack,
      };
      if (mountedRef.current) markEmptyExitComplete(false);
      onBack();
    },
    [onBack]
  );

  const activeHeight = activeEntryKey
    ? heightSnapshot.values.get(activeEntryKey)
    : undefined;
  const viewportHeight = getSheetViewportHeight(
    activeHeight,
    heightSnapshot.lastActiveHeight,
    entries.length === 0 && !emptyExitComplete
  );
  const heightTransition = reduceMotion
    ? { type: "tween" as const, duration: 0 }
    : getRoleTransition(
        direction === "backward" ? "push-exit" : "push-enter",
        false
      );
  const presenceContext = useMemo<PresenceContext>(
    () => ({ direction, reduceMotion }),
    [direction, reduceMotion]
  );

  useLayoutEffect(() => {
    const focusImmediately = reduceMotion || !hasMountedRef.current;
    hasMountedRef.current = true;
    if (!focusImmediately || !activeEntryKey) return;
    const guard = focusGuardRef.current;
    const frame = requestAnimationFrame(() => {
      focusActivePage(activeEntryKey, guard.generation);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeEntryKey, focusActivePage, reduceMotion]);

  return (
    <m.div
      className={styles.sheetPageViewport}
      data-sheet-stack-depth={entries.length}
      data-sheet-stack-direction={direction}
      animate={{ height: viewportHeight }}
      transition={heightTransition}
    >
      <AnimatePresence
        initial={false}
        mode="sync"
        custom={presenceContext}
        onExitComplete={() => {
          if (mountedRef.current && currentEntryKeysRef.current.size === 0) {
            markEmptyExitComplete(true);
          }
        }}
      >
        {entries.map((entry, index) => {
          const isActive = index === entries.length - 1;

          return (
            <MeasuredSheetPage
              key={entry.key}
              entry={entry}
              active={isActive}
              depth={index + 1}
              dismiss={dismiss}
              isRoot={index === 0}
              presenceContext={presenceContext}
              renderPage={renderPage}
              initialTarget={getSheetPageBoundary(
                direction,
                "enter",
                reduceMotion
              )}
              target={getSheetPageTarget(
                entries.length - 1 - index,
                reduceMotion
              )}
              onAnimationComplete={finishPageAnimation}
              onBackRequest={requestBack}
              onElementChange={handleElementChange}
              onHeightChange={handleHeightChange}
            />
          );
        })}
      </AnimatePresence>
    </m.div>
  );
}
