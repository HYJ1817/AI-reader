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
import {
  useAppMotionLifecycle,
  useAppReducedMotion,
} from "./AppMotionRoot";
import { useSheetPresentationMotion } from "./MotionSheet";
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
  focusGeneration: number;
  renderPage: (
    entry: SheetEntry,
    controls: SheetPageRenderControls
  ) => ReactNode;
  onBack: () => void;
  dismiss: CloseSheet;
};

type PresenceContext = {
  direction: NavigationDirection;
  lifecycleEpoch: number;
  reduceMotion: boolean;
};

type PendingBack = {
  key: string;
  generation: number;
  lifecycleEpoch: number;
  afterBack?: () => void;
};

type PendingReturnFocus = {
  generation: number;
  route: string;
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
  focusGeneration: number;
  renderPage: SheetPageStackProps["renderPage"];
  target: { opacity: number; x: number };
  onAnimationComplete: (
    entryKey: string,
    didExit: boolean,
    focusGeneration: number,
    lifecycleEpoch: number
  ) => void;
  onBackRequest: (
    entryKey: string,
    returnFocusFor: string,
    afterBack?: () => void
  ) => void;
  onElementChange: (entryKey: string, element: HTMLDivElement | null) => void;
  onHeightChange: (
    entryKey: string,
    height: number | null,
    measuredActivePage: boolean
  ) => void;
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
  focusGeneration,
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
  const activeMeasurementRef = useRef(isActive);
  const animationFocusGenerationRef = useRef(focusGeneration);
  const animationEpochRef = useRef(presenceContext.lifecycleEpoch);
  const { reduceMotion } = presenceContext;

  useLayoutEffect(() => {
    activeMeasurementRef.current = isActive;
    const element = pageRef.current;
    if (isActive && element) {
      onHeightChange(
        entryKey,
        element.getBoundingClientRect().height,
        true
      );
    }
  }, [entryKey, isActive, onHeightChange]);

  useLayoutEffect(() => {
    const element = pageRef.current;
    if (!element) return;

    onElementChange(entryKey, element);

    const reportHeight = (height: number) => {
      if (Number.isFinite(height) && height >= 0) {
        onHeightChange(entryKey, height, activeMeasurementRef.current);
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
      onHeightChange(entryKey, null, false);
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
      onAnimationStart={() => {
        animationFocusGenerationRef.current = focusGeneration;
        animationEpochRef.current = presenceContext.lifecycleEpoch;
      }}
      onAnimationComplete={(definition) => {
        if (definition === "exit") {
          onAnimationComplete(
            entryKey,
            true,
            animationFocusGenerationRef.current,
            animationEpochRef.current
          );
          return;
        }
        if (isActive) {
          onAnimationComplete(
            entryKey,
            false,
            animationFocusGenerationRef.current,
            animationEpochRef.current
          );
        }
      }}
      data-sheet-page
      data-sheet-page-active={isActive}
      role="region"
      aria-hidden={isActive ? undefined : true}
      inert={isActive ? undefined : true}
      tabIndex={-1}
    >
      {renderPage(entry, {
        back: isActive
          ? (afterBack) => onBackRequest(entryKey, entry.route, afterBack)
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
  focusGeneration,
  renderPage,
  onBack,
  dismiss,
}: SheetPageStackProps) {
  const reduceMotion = useAppReducedMotion();
  const lifecycle = useAppMotionLifecycle();
  const presentationMotion = useSheetPresentationMotion();
  const keyboardVisible = presentationMotion?.keyboardVisible ?? false;
  const entryKeys = useMemo(() => entries.map((entry) => entry.key), [entries]);
  const entryTokens = useMemo(
    () => entries.map((entry) => JSON.stringify(entry)),
    [entries]
  );
  const intentSignature = JSON.stringify(entryTokens);
  const activeEntryKey = entryKeys[entryKeys.length - 1];
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
  const pendingReturnFocusRef = useRef<PendingReturnFocus | null>(null);
  const previousKeyboardVisibleRef = useRef(keyboardVisible);
  const mountedRef = useRef(true);
  const lastMeasuredActiveHeightRef = useRef<number | undefined>(undefined);
  const activeEntryKeyRef = useRef<string | undefined>(entries[entries.length - 1]?.key);
  const currentEntryKeysRef = useRef(new Set(entries.map((entry) => entry.key)));
  const focusGuardRef = useRef({
    key: activeEntryKey ?? "",
    generation: focusGeneration,
    lifecycleEpoch: lifecycle.epoch,
  });
  const lastFocusedGenerationRef = useRef(-1);
  const hasMountedRef = useRef(false);
  const [emptyExitComplete, markEmptyExitComplete] = useReducer(
    (_current: boolean, next: boolean) => next,
    false
  );

  const previousIntentRef = useRef<IntentSnapshot>({
    direction,
    entryKeys,
    entryTokens,
  });

  useLayoutEffect(() => {
    mountedRef.current = true;
    hasMountedRef.current = true;
    return () => {
      mountedRef.current = false;
      hasMountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    focusGuardRef.current = {
      ...focusGuardRef.current,
      lifecycleEpoch: lifecycle.epoch,
    };
    lastFocusedGenerationRef.current = -1;
  }, [lifecycle.epoch]);

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
        pendingReturnFocusRef.current = null;
      }

      focusGuardRef.current = {
        key: activeEntryKey ?? "",
        generation: focusGeneration,
        lifecycleEpoch: lifecycle.epoch,
      };
      lastFocusedGenerationRef.current = -1;
    }

    activeEntryKeyRef.current = activeEntryKey;
    currentEntryKeysRef.current = new Set(entryKeys);
    previousIntentRef.current = { direction, entryKeys, entryTokens };
  }, [
    activeEntryKey,
    direction,
    entryKeys,
    entryTokens,
    focusGeneration,
    intentSignature,
    lifecycle.epoch,
  ]);

  const handleElementChange = useCallback(
    (entryKey: string, element: HTMLDivElement | null) => {
      if (element) pageElementsRef.current.set(entryKey, element);
      else pageElementsRef.current.delete(entryKey);
    },
    []
  );

  const handleHeightChange = useCallback(
    (
      entryKey: string,
      height: number | null,
      measuredActivePage: boolean
    ) => {
      if (!mountedRef.current) return;
      const heights = heightsRef.current;
      if (height === null) {
        if (heights.delete(entryKey)) {
          bumpHeightVersion({ values: heights });
        }
        return;
      }
      if (
        heights.get(entryKey) === height &&
        (!measuredActivePage ||
          lastMeasuredActiveHeightRef.current === height)
      ) {
        return;
      }
      heights.set(entryKey, height);
      const shouldRememberActiveHeight = measuredActivePage && height > 0;
      if (shouldRememberActiveHeight) {
        lastMeasuredActiveHeightRef.current = height;
      }
      bumpHeightVersion({
        values: heights,
        lastActiveHeight: shouldRememberActiveHeight ? height : undefined,
      });
      if (shouldRememberActiveHeight) {
        markEmptyExitComplete(false);
      }
    },
    []
  );

  const focusActivePage = useCallback((
    entryKey: string,
    focusGeneration: number,
    lifecycleEpoch: number
  ) => {
    const guard = focusGuardRef.current;
    if (
      guard.key !== entryKey ||
      guard.generation !== focusGeneration ||
      guard.lifecycleEpoch !== lifecycleEpoch ||
      lifecycleEpoch !== lifecycle.epoch ||
      !hasMountedRef.current ||
      lastFocusedGenerationRef.current === focusGeneration
    ) {
      return;
    }

    const activePage = pageElementsRef.current.get(entryKey);
    if (!activePage || activeEntryKeyRef.current !== entryKey) return;

    const focusElement = (element: HTMLElement) => {
      element.focus({ preventScroll: true });
      if (keyboardVisible) {
        element.scrollIntoView({ block: "nearest" });
      }
      lastFocusedGenerationRef.current = focusGeneration;
    };

    const pendingReturnFocus = pendingReturnFocusRef.current;
    const returnFocusTarget = pendingReturnFocus &&
      pendingReturnFocus.generation === intentGenerationRef.current
      ? Array.from(
          activePage.querySelectorAll<HTMLElement>("[data-sheet-return-focus]")
        ).find(
          (element) =>
            element.dataset.sheetReturnFocus === pendingReturnFocus.route
        )
      : undefined;
    if (returnFocusTarget) {
      pendingReturnFocusRef.current = null;
      focusElement(returnFocusTarget);
      return;
    }

    if (
      typeof document !== "undefined" &&
      activePage.contains(document.activeElement)
    ) {
      lastFocusedGenerationRef.current = focusGeneration;
      return;
    }

    const autofocus = activePage.querySelector<HTMLElement>(
      '[data-sheet-autofocus="true"]'
    );
    if (autofocus) {
      focusElement(autofocus);
      return;
    }

    const firstFocusable = activePage.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (firstFocusable) {
      focusElement(firstFocusable);
      return;
    }

    activePage.focus({ preventScroll: true });
    if (keyboardVisible) {
      activePage.scrollIntoView({ block: "nearest" });
    }
    lastFocusedGenerationRef.current = focusGeneration;
  }, [keyboardVisible, lifecycle.epoch]);

  const completePendingBack = useCallback((pending: PendingBack) => {
    if (pendingBackRef.current !== pending) return;
    pendingBackRef.current = null;
    pending.afterBack?.();
  }, []);

  const finishPageAnimation = useCallback(
    (
      entryKey: string,
      didExit: boolean,
      animationFocusGeneration: number,
      animationLifecycleEpoch: number
    ) => {
      if (animationLifecycleEpoch !== lifecycle.epoch) {
        const pending = pendingBackRef.current;
        if (
          didExit &&
          pending?.key === entryKey &&
          pending.lifecycleEpoch !== lifecycle.epoch &&
          !currentEntryKeysRef.current.has(pending.key)
        ) {
          completePendingBack(pending);
        }
        return;
      }
      if (didExit) {
        const pending = pendingBackRef.current;
        if (!pending || pending.key !== entryKey) return;
        if (pending.generation !== intentGenerationRef.current) return;
        if (currentEntryKeysRef.current.has(entryKey)) return;

        completePendingBack(pending);
        return;
      }

      focusActivePage(
        entryKey,
        animationFocusGeneration,
        animationLifecycleEpoch
      );
    },
    [completePendingBack, focusActivePage, lifecycle.epoch]
  );

  const requestBack = useCallback(
    (entryKey: string, returnFocusFor: string, afterBack?: () => void) => {
      if (activeEntryKeyRef.current !== entryKey || pendingBackRef.current) return;

      intentGenerationRef.current += 1;
      pendingBackRef.current = {
        key: entryKey,
        generation: intentGenerationRef.current,
        lifecycleEpoch: lifecycle.epoch,
        afterBack,
      };
      pendingReturnFocusRef.current = {
        generation: intentGenerationRef.current,
        route: returnFocusFor,
      };
      if (mountedRef.current) markEmptyExitComplete(false);
      onBack();
    },
    [lifecycle.epoch, onBack]
  );

  useLayoutEffect(() => {
    const pending = pendingBackRef.current;
    if (
      pending &&
      pending.lifecycleEpoch !== lifecycle.epoch &&
      !entryKeys.includes(pending.key)
    ) {
      completePendingBack(pending);
    }
  }, [completePendingBack, entryKeys, intentSignature, lifecycle.epoch]);

  useLayoutEffect(() => {
    const keyboardBecameVisible =
      !previousKeyboardVisibleRef.current && keyboardVisible;
    previousKeyboardVisibleRef.current = keyboardVisible;
    if (!keyboardBecameVisible || !activeEntryKey) return;

    const activePage = pageElementsRef.current.get(activeEntryKey);
    if (
      activePage &&
      document.activeElement instanceof HTMLElement &&
      activePage.contains(document.activeElement)
    ) {
      document.activeElement.scrollIntoView({ block: "nearest" });
    }
  }, [activeEntryKey, keyboardVisible]);

  const activeHeight = activeEntryKey
    ? heightSnapshot.values.get(activeEntryKey)
    : undefined;
  const viewportHeight = getSheetViewportHeight(
    activeHeight,
    heightSnapshot.lastActiveHeight,
    entries.length === 0 && !emptyExitComplete
  );
  const heightTransition = reduceMotion || keyboardVisible
    ? { type: "tween" as const, duration: 0 }
    : getRoleTransition(
        direction === "backward" ? "push-exit" : "push-enter",
        false
      );
  const presenceContext = useMemo<PresenceContext>(
    () => ({ direction, lifecycleEpoch: lifecycle.epoch, reduceMotion }),
    [direction, lifecycle.epoch, reduceMotion]
  );

  return (
    <m.div
      className={styles.sheetPageViewport}
      data-sheet-stack-depth={entries.length}
      data-sheet-stack-direction={direction}
      animate={{ height: viewportHeight }}
      transition={heightTransition}
    >
      <AnimatePresence
        initial={true}
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
              focusGeneration={focusGeneration}
              renderPage={renderPage}
              initialTarget={
                index === 0 && entries.length === 1
                  ? getSheetPageTarget(0, reduceMotion)
                  : getSheetPageBoundary(
                      direction,
                      "enter",
                      reduceMotion
                    )
              }
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
