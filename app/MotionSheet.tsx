"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

type SheetCloseRequest = {
  afterClose: (() => void) | null;
};

type SheetPresentationMotion = {
  progress: MotionValue<number>;
  scale: MotionValue<number>;
  borderRadius: MotionValue<number>;
  brightness: MotionValue<number>;
};

type VisualViewportFrame = {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
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
        "button, a, input, textarea, select, option, [contenteditable='true'], [role='slider'], [data-sheet-horizontal-gesture='true']"
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
  const [closeRequest, setCloseRequest] = useReducer(
    (_current: SheetCloseRequest | null, next: SheetCloseRequest | null) => next,
    null
  );
  const [sheetHeight, setSheetHeight] = useState(() =>
    typeof window === "undefined" ? 900 : Math.max(1, window.innerHeight)
  );
  const [visualViewportFrame, setVisualViewportFrame] =
    useState<VisualViewportFrame | null>(() => {
      if (typeof window === "undefined") return null;
      const viewport = window.visualViewport;
      return viewport
        ? {
            offsetLeft: viewport.offsetLeft,
            offsetTop: viewport.offsetTop,
            width: viewport.width,
            height: viewport.height,
          }
        : null;
    });
  const panelRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(sheetHeight);
  const reducedOpacity = useMotionValue(reduceMotion ? 0 : 1);
  const dragControls = useDragControls();
  const activeAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const animationGenerationRef = useRef(0);
  const exitRequestedRef = useRef(!open);
  const exitCompletedRef = useRef(false);
  const beforeCloseCalledRef = useRef(false);
  const openRef = useRef(open);
  const onExitCompleteRef = useRef(onExitComplete);
  const lifecycleEpochRef = useRef(lifecycle.epoch);
  const lastHandledOpenRef = useRef<boolean | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const backgroundSiblingsRef = useRef<BackgroundSiblingState[]>([]);

  const progress = useTransform(y, (translationY) => {
    const distance = Math.max(1, sheetHeight);
    return 1 - Math.min(1, Math.max(0, translationY) / distance);
  });
  const scale = useTransform(progress, [0, 1], [1, 0.98]);
  const borderRadius = useTransform(progress, [0, 1], [0, 18]);
  const brightness = useTransform(progress, [0, 1], [1, 0.92]);
  const presentationMotion = useMemo(
    () => ({ progress, scale, borderRadius, brightness }),
    [borderRadius, brightness, progress, scale]
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
  // Full-motion exit timing is MOTION_DURATION.sheetExit with
  // ease: [0.32, 0.72, 0, 1], centralized by getRoleTransition.

  const interruptClose = useCallback(() => {
    animationGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    exitRequestedRef.current = false;
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

    const requestedTarget = initialFocusRef?.current;
    const focusTarget =
      requestedTarget && panel.contains(requestedTarget)
        ? requestedTarget
        : panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel;
    focusTarget.focus({ preventScroll: true });

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
      const nextFrame = {
        offsetLeft: viewport.offsetLeft,
        offsetTop: viewport.offsetTop,
        width: viewport.width,
        height: viewport.height,
      };
      setVisualViewportFrame((currentFrame) =>
        currentFrame &&
        currentFrame.offsetLeft === nextFrame.offsetLeft &&
        currentFrame.offsetTop === nextFrame.offsetTop &&
        currentFrame.width === nextFrame.width &&
        currentFrame.height === nextFrame.height
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

  useEffect(() => {
    openRef.current = open;
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete, open]);

  const beginExit = useCallback(() => {
    if (exitRequestedRef.current) return;
    exitRequestedRef.current = true;
    exitCompletedRef.current = false;
    if (!beforeCloseCalledRef.current) {
      beforeCloseCalledRef.current = true;
      onBeforeClose?.();
    }
    const viewportHeight = Math.max(sheetHeight, window.innerHeight);
    runAnimation(viewportHeight, "close", () => setPresent(false));
  }, [onBeforeClose, runAnimation, sheetHeight]);

  useEffect(() => {
    if (lastHandledOpenRef.current === open) return;
    lastHandledOpenRef.current = open;
    if (open) {
      interruptClose();
      exitCompletedRef.current = false;
      beforeCloseCalledRef.current = false;
      setCloseRequest(null);
      setPresent(true);
      runAnimation(0, "settle");
      return;
    }
    beginExit();
  }, [beginExit, interruptClose, open, runAnimation]);

  useEffect(() => () => {
    animationGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
  }, []);

  const close = useCallback<CloseSheet>((nextAfterClose) => {
    if (!open || closeRequest) return;
    setCloseRequest({ afterClose: nextAfterClose ?? null });
    onRequestClose();
  }, [closeRequest, onRequestClose, open]);

  const finishClose = useCallback(() => {
    if (
      openRef.current ||
      !exitRequestedRef.current ||
      exitCompletedRef.current
    ) {
      return;
    }
    exitCompletedRef.current = true;
    const callback = closeRequest?.afterClose ?? null;
    setCloseRequest(null);
    callback?.();
    onExitCompleteRef.current?.();
  }, [closeRequest]);

  useEffect(() => {
    if (lifecycleEpochRef.current === lifecycle.epoch) return;
    lifecycleEpochRef.current = lifecycle.epoch;
    animationGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    setIsAnimating(false);

    if (exitRequestedRef.current || !openRef.current) {
      y.set(Math.max(sheetHeight, window.innerHeight));
      reducedOpacity.set(0);
      setPresent(false);
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
      const focusableElements = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      if (!panel.contains(activeElement)) {
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
    if (!fromHeader && isInteractiveControl(target)) return;

    const scrollTop = findScrollableAncestor(target, panel)?.scrollTop ?? 0;
    if (!canSheetClaimGesture({ fromHeader, scrollTop, deltaY: 1 })) return;
    dragControls.start(event);
  }

  const panelClassName = [
    styles.bottomSheet,
    styles.motionSheetPanel,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <SheetPresentationContext.Provider value={presentationMotion}>
      <AnimatePresence initial={false} onExitComplete={finishClose}>
        {present && (
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
              onDragStart={() => setIsAnimating(true)}
              onPointerDownCapture={handleDragPointerDown}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onDragEnd={(_, info) => {
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
              {typeof children === "function" ? children(close) : children}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </SheetPresentationContext.Provider>
  );
}
