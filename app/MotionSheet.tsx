"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  animate,
  m,
  useDragControls,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import {
  canSheetClaimGesture,
  shouldCompleteSheetDismiss,
} from "@/lib/navigationGestures";
import { MOTION_SPRING, getRoleTransition } from "@/lib/motionSystem";
import {
  createSheetCloseRequestGuard,
  shouldCommitSheetExit,
} from "@/lib/sheetPresentationState";
import { useAppMotionLifecycle, useAppReducedMotion } from "./AppMotionRoot";
import styles from "./page.module.css";

export type CloseSheet = (afterClose?: () => void) => void;

export type MotionSheetProps = {
  open: boolean;
  stackDepth?: number;
  onRequestClose: () => void;
  onExitComplete?: () => void;
  children: ReactNode | ((close: CloseSheet) => ReactNode);
  className?: string;
  ariaLabel?: string;
  showGrabber?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onBeforeClose?: () => void;
};

type SheetPresentationMotion = {
  progress: MotionValue<number>;
  scale: MotionValue<number>;
  borderRadius: MotionValue<number>;
  brightness: MotionValue<number>;
  keyboardVisible: boolean;
};

type VisualViewportFrame = {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
  keyboardVisible: boolean;
};

type BackgroundSiblingState = {
  sibling: HTMLElement;
  wasInert: boolean;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[contenteditable='true']",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const SheetPresentationContext =
  createContext<SheetPresentationMotion | null>(null);

function readVisualViewportFrame(viewport: VisualViewport): VisualViewportFrame {
  return {
    offsetLeft: viewport.offsetLeft,
    offsetTop: viewport.offsetTop,
    width: viewport.width,
    height: viewport.height,
    keyboardVisible:
      window.innerHeight - viewport.height - viewport.offsetTop >= 120,
  };
}

export function useSheetPresentationMotion(): SheetPresentationMotion | null {
  return useContext(SheetPresentationContext);
}

function findScrollableAncestor(
  target: EventTarget | null,
  panel: HTMLElement
): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  let current: Element | null = target;

  while (current && current !== panel) {
    if (current instanceof HTMLElement) {
      const style = window.getComputedStyle(current);
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        current.scrollHeight > current.clientHeight
      ) {
        return current;
      }
    }
    current = current.parentElement;
  }

  return null;
}

function isInteractiveControl(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, a, label, input, textarea, select, option, [contenteditable='true'], [role='button'], [role='link'], [role='textbox'], [role='checkbox'], [role='radio'], [role='switch'], [role='combobox'], [role='option'], [role='spinbutton'], [role='slider'], [data-sheet-horizontal-gesture='true']"
      )
    )
  );
}

export default function MotionSheet({
  open,
  stackDepth = 1,
  onRequestClose,
  onExitComplete,
  children,
  className = "",
  ariaLabel,
  showGrabber = true,
  initialFocusRef,
  onBeforeClose,
}: MotionSheetProps) {
  const reduceMotion = useAppReducedMotion();
  const lifecycle = useAppMotionLifecycle();
  const [present, setPresent] = useReducer(
    (_current: boolean, next: boolean) => next,
    open
  );
  const [isAnimating, setIsAnimating] = useReducer(
    (_current: boolean, next: boolean) => next,
    open
  );
  const [exitCommitGeneration, setExitCommitGeneration] = useReducer(
    (_current: number | null, next: number | null) => next,
    null
  );
  const [sheetHeight, setSheetHeight] = useState(() =>
    typeof window === "undefined" ? 900 : Math.max(1, window.innerHeight)
  );
  const [visualViewportFrame, setVisualViewportFrame] =
    useState<VisualViewportFrame | null>(() => {
      if (typeof window === "undefined") return null;
      const viewport = window.visualViewport;
      return viewport ? readVisualViewportFrame(viewport) : null;
    });
  const panelRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(sheetHeight);
  const reducedOpacity = useMotionValue(reduceMotion ? 0 : 1);
  const dragControls = useDragControls();
  const activeAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const animationGenerationRef = useRef(0);
  const exitGenerationRef = useRef(0);
  const completedExitGenerationRef = useRef(0);
  const exitRequestedRef = useRef(!open);
  const beforeCloseCalledRef = useRef(false);
  const closeRequestGuardRef = useRef(createSheetCloseRequestGuard());
  const openRef = useRef(open);
  const lifecycleEpochRef = useRef(lifecycle.epoch);
  const lastHandledOpenRef = useRef<boolean | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const backgroundSiblingsRef = useRef<BackgroundSiblingState[]>([]);
  const dragActiveRef = useRef(false);
  const cancelledDragRef = useRef(false);
  const pointerReleasedRef = useRef(false);

  const progress = useTransform(y, (translationY) => {
    const distance = Math.max(1, sheetHeight);
    return 1 - Math.min(1, Math.max(0, translationY) / distance);
  });
  const scale = useTransform(progress, [0, 1], [1, 0.98]);
  const borderRadius = useTransform(progress, [0, 1], [0, 18]);
  const brightness = useTransform(progress, [0, 1], [1, 0.92]);
  const keyboardVisible = visualViewportFrame?.keyboardVisible ?? false;
  const presentationMotion = useMemo(
    () => ({ progress, scale, borderRadius, brightness, keyboardVisible }),
    [borderRadius, brightness, keyboardVisible, progress, scale]
  );
  const overlayStyle = {
    ...(visualViewportFrame
      ? {
          left: visualViewportFrame.offsetLeft,
          top: visualViewportFrame.offsetTop,
          right: "auto",
          bottom: "auto",
          width: visualViewportFrame.width,
          height: visualViewportFrame.height,
        }
      : {}),
  } satisfies CSSProperties;

  const runAnimation = useCallback(
    (target: number, kind: "settle" | "close", onComplete?: () => void) => {
      const generation = animationGenerationRef.current + 1;
      animationGenerationRef.current = generation;
      activeAnimationRef.current?.stop();

      setIsAnimating(true);
      const controls = reduceMotion
        ? animate(reducedOpacity, kind === "close" ? 0 : 1, getRoleTransition(
            kind === "close" ? "sheet-exit" : "sheet-enter",
            true
          ))
        : animate(
            y,
            target,
            kind === "settle"
              ? MOTION_SPRING.sheet
              : getRoleTransition("sheet-exit", false)
          );
      if (reduceMotion) y.set(kind === "close" ? 0 : target);
      activeAnimationRef.current = controls;
      void controls.then(() => {
        if (animationGenerationRef.current !== generation) return;
        activeAnimationRef.current = null;
        setIsAnimating(false);
        onComplete?.();
      });
    },
    [reduceMotion, reducedOpacity, y]
  );
  const interruptClose = useCallback(() => {
    animationGenerationRef.current += 1;
    exitGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    exitRequestedRef.current = false;
    closeRequestGuardRef.current.reset();
    setExitCommitGeneration(null);
    setIsAnimating(false);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const borderBoxSize = entry?.borderBoxSize as
        | ReadonlyArray<ResizeObserverSize>
        | ResizeObserverSize
        | undefined;
      const borderBox = Array.isArray(borderBoxSize)
        ? borderBoxSize[0]
        : borderBoxSize;
      const borderBoxHeight = borderBox ? borderBox.blockSize : undefined;
      const nextHeight =
        typeof borderBoxHeight === "number" && Number.isFinite(borderBoxHeight)
          ? borderBoxHeight
          : panel.getBoundingClientRect().height;
      setSheetHeight(Math.max(1, nextHeight));
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const overlay = panel.closest<HTMLElement>('[data-sheet-route]');
    const appShell = overlay?.closest<HTMLElement>('[data-app-shell="true"]');
    backgroundSiblingsRef.current = appShell
      ? Array.from(appShell.children)
          .filter(
            (child): child is HTMLElement =>
              child instanceof HTMLElement && child !== overlay
          )
          .map((sibling) => ({ sibling, wasInert: sibling.inert }))
      : [];

    for (const { sibling } of backgroundSiblingsRef.current) {
      sibling.inert = true;
    }

    const managedPage = panel.querySelector("[data-sheet-page]");
    if (!managedPage) {
      const requestedTarget = initialFocusRef?.current;
      const focusTarget =
        requestedTarget && panel.contains(requestedTarget)
          ? requestedTarget
          : panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel;
      focusTarget.focus({ preventScroll: true });
    }

    return () => {
      for (const { sibling, wasInert } of backgroundSiblingsRef.current) {
        sibling.inert = wasInert;
      }
      backgroundSiblingsRef.current = [];

      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncViewport = () => {
      const nextFrame = readVisualViewportFrame(viewport);
      setVisualViewportFrame((currentFrame) =>
        currentFrame &&
        currentFrame.offsetLeft === nextFrame.offsetLeft &&
        currentFrame.offsetTop === nextFrame.offsetTop &&
        currentFrame.width === nextFrame.width &&
        currentFrame.height === nextFrame.height &&
        currentFrame.keyboardVisible === nextFrame.keyboardVisible
          ? currentFrame
          : nextFrame
      );
    };

    viewport.addEventListener("resize", syncViewport);
    viewport.addEventListener("scroll", syncViewport);
    return () => {
      viewport.removeEventListener("resize", syncViewport);
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, []);

  useLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  const beginExit = useCallback(() => {
    if (exitRequestedRef.current) return;
    const exitGeneration = exitGenerationRef.current + 1;
    exitGenerationRef.current = exitGeneration;
    exitRequestedRef.current = true;
    if (!beforeCloseCalledRef.current) {
      beforeCloseCalledRef.current = true;
      onBeforeClose?.();
    }
    const viewportHeight = Math.max(sheetHeight, window.innerHeight);
    runAnimation(viewportHeight, "close", () => {
      if (exitGenerationRef.current !== exitGeneration) return;
      setPresent(false);
      setExitCommitGeneration(exitGeneration);
    });
  }, [onBeforeClose, runAnimation, sheetHeight]);

  useLayoutEffect(() => {
    if (lastHandledOpenRef.current === open) return;
    lastHandledOpenRef.current = open;
    if (open) {
      interruptClose();
      beforeCloseCalledRef.current = false;
      setPresent(true);
      runAnimation(0, "settle");
      return;
    }
    beginExit();
  }, [beginExit, interruptClose, open, runAnimation]);

  useEffect(() => () => {
    animationGenerationRef.current += 1;
    exitGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
  }, []);

  const close = useCallback<CloseSheet>((nextAfterClose) => {
    if (
      !open ||
      !closeRequestGuardRef.current.request(nextAfterClose)
    ) {
      return;
    }
    onRequestClose();
  }, [onRequestClose, open]);

  useLayoutEffect(() => {
    if (exitCommitGeneration === null) return;
    if (
      !shouldCommitSheetExit({
        open,
        requestedGeneration: exitCommitGeneration,
        currentGeneration: exitGenerationRef.current,
        completedGeneration: completedExitGenerationRef.current,
      })
    ) {
      if (open) {
        closeRequestGuardRef.current.reset();
        setExitCommitGeneration(null);
      }
      return;
    }

    completedExitGenerationRef.current = exitCommitGeneration;
    const callback = closeRequestGuardRef.current.takeCallback();
    callback?.();
    onExitComplete?.();
  }, [exitCommitGeneration, onExitComplete, open]);

  useEffect(() => {
    if (lifecycleEpochRef.current === lifecycle.epoch) return;
    lifecycleEpochRef.current = lifecycle.epoch;
    animationGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    setIsAnimating(false);

    if (exitRequestedRef.current || !openRef.current) {
      const exitGeneration = exitRequestedRef.current
        ? exitGenerationRef.current
        : exitGenerationRef.current + 1;
      exitGenerationRef.current = exitGeneration;
      exitRequestedRef.current = true;
      y.set(Math.max(sheetHeight, window.innerHeight));
      reducedOpacity.set(0);
      setPresent(false);
      setExitCommitGeneration(exitGeneration);
      return;
    }
    y.set(0);
    reducedOpacity.set(1);
  }, [lifecycle.epoch, reducedOpacity, sheetHeight, y]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const activePage = panel.querySelector<HTMLElement>(
        '[data-sheet-page][data-sheet-page-active="true"]'
      );
      const focusScope = activePage ?? panel;
      const focusableElements = Array.from(
        focusScope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (element) =>
          !element.closest("[inert], [aria-hidden='true']")
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusScope.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (!focusScope.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  function handleDragPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!openRef.current || event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const target = event.target;
    const fromHeader =
      target instanceof Element &&
      Boolean(target.closest('[data-sheet-drag-handle="true"]'));
    const interactiveTarget = isInteractiveControl(target);

    const scrollTop = findScrollableAncestor(target, panel)?.scrollTop ?? 0;
    if (
      !canSheetClaimGesture({
        fromHeader,
        scrollTop,
        deltaY: 1,
        interactiveTarget,
        keyboardVisible,
      })
    ) {
      return;
    }
    pointerReleasedRef.current = false;
    dragControls.start(event);
  }

  const settleCancelledDrag = useCallback((event: ReactPointerEvent) => {
    if (event.type === "lostpointercapture" && pointerReleasedRef.current) {
      return;
    }
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    cancelledDragRef.current = true;
    runAnimation(0, "settle");
  }, [runAnimation]);

  const panelClassName = [
    styles.bottomSheet,
    styles.motionSheetPanel,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <SheetPresentationContext.Provider value={presentationMotion}>
      <AnimatePresence initial={false}>
        {(open || present) && (
          <m.div
            key="motion-sheet"
            className={styles.sheetOverlay}
            style={overlayStyle}
            data-motion-sheet="overlay"
            data-sheet-closing={!open ? "true" : undefined}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <m.div
              className={styles.motionSheetBackdrop}
              style={{
                opacity: reduceMotion ? reducedOpacity : progress,
                willChange: isAnimating ? "opacity" : "auto",
              }}
              data-motion-sheet="backdrop"
              aria-hidden="true"
            />
            <m.div
              ref={panelRef}
              className={panelClassName}
              style={{
                y,
                opacity: reduceMotion ? reducedOpacity : 1,
                willChange: isAnimating ? "transform" : "auto",
              }}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              tabIndex={-1}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: sheetHeight }}
              dragElastic={{ top: 0, bottom: 0.08 }}
              dragMomentum={false}
              onDragStart={() => {
                dragActiveRef.current = true;
                cancelledDragRef.current = false;
                setIsAnimating(true);
              }}
              onPointerDownCapture={handleDragPointerDown}
              onPointerUpCapture={() => {
                pointerReleasedRef.current = true;
              }}
              onPointerCancel={settleCancelledDrag}
              onLostPointerCapture={settleCancelledDrag}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onDragEnd={(_, info) => {
                dragActiveRef.current = false;
                pointerReleasedRef.current = false;
                if (cancelledDragRef.current) {
                  cancelledDragRef.current = false;
                  return;
                }
                const offsetY = Math.max(0, y.get(), info.offset.y);
                if (
                  shouldCompleteSheetDismiss(
                    offsetY,
                    info.velocity.y,
                    sheetHeight
                  )
                ) {
                  close();
                  return;
                }
                runAnimation(0, "settle");
              }}
              data-motion-sheet="panel"
              data-sheet-stack-depth={stackDepth}
              data-navigation-gesture-owner="sheet"
            >
              {showGrabber && (
                <div
                  className={styles.sheetDragHandle}
                  data-sheet-drag-handle="true"
                >
                  <div className={styles.sheetGrabber} />
                </div>
              )}
              {/* The render prop receives an event callback; it does not invoke it during render. */}
              {/* eslint-disable-next-line react-hooks/refs */}
              {typeof children === "function" ? children(close) : children}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </SheetPresentationContext.Provider>
  );
}
