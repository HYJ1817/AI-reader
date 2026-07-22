"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { MOTION_DURATION, MOTION_SPRING } from "@/lib/motionSystem";
import { useAppReducedMotion } from "./AppMotionRoot";
import styles from "./page.module.css";

export type CloseSheet = (afterClose?: () => void) => void;

export type MotionSheetProps = {
  onClose: () => void;
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
};

type SheetCloseRequest = {
  afterClose: (() => void) | null;
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
  onClose,
  children,
  className = "",
  ariaLabel,
  showGrabber = true,
  initialFocusRef,
  onBeforeClose,
}: MotionSheetProps) {
  const reduceMotion = useAppReducedMotion();
  const [present, setPresent] = useState(true);
  const [closeRequest, setCloseRequest] =
    useState<SheetCloseRequest | null>(null);
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
  const dragControls = useDragControls();
  const activeAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const animationGenerationRef = useRef(0);
  const closeCompletedRef = useRef(false);
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

      if (reduceMotion) {
        y.set(target);
        onComplete?.();
        return;
      }

      const controls = animate(
        y,
        target,
        kind === "settle"
          ? MOTION_SPRING.sheet
          : {
              duration: MOTION_DURATION.sheetExit,
              ease: [0.32, 0.72, 0, 1],
            }
      );
      activeAnimationRef.current = controls;
      void controls.then(() => {
        if (animationGenerationRef.current !== generation) return;
        activeAnimationRef.current = null;
        onComplete?.();
      });
    },
    [reduceMotion, y]
  );

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
    runAnimation(0, "settle");
    return () => {
      animationGenerationRef.current += 1;
      activeAnimationRef.current?.stop();
    };
  }, [runAnimation]);

  const close = useCallback<CloseSheet>((nextAfterClose) => {
    setCloseRequest((current) =>
      current ?? { afterClose: nextAfterClose ?? null }
    );
  }, []);

  useEffect(() => {
    if (!closeRequest) return;
    const viewportHeight = Math.max(sheetHeight, window.innerHeight);
    runAnimation(viewportHeight, "close", () => {
      setPresent(false);
    });
  }, [closeRequest, runAnimation, sheetHeight]);

  const finishClose = useCallback(() => {
    if (closeCompletedRef.current) return;
    closeCompletedRef.current = true;
    const callback = closeRequest?.afterClose ?? null;
    onBeforeClose?.();
    onClose();
    callback?.();
  }, [closeRequest, onBeforeClose, onClose]);

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

  const interruptClose = useCallback(() => {
    if (!closeRequest) return;
    animationGenerationRef.current += 1;
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    setCloseRequest(null);
  }, [closeRequest]);

  function handleDragPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    const target = event.target;
    const fromHeader =
      target instanceof Element &&
      Boolean(target.closest('[data-sheet-drag-handle="true"]'));
    if (!fromHeader && isInteractiveControl(target)) return;

    const scrollTop = findScrollableAncestor(target, panel)?.scrollTop ?? 0;
    if (!canSheetClaimGesture({ fromHeader, scrollTop, deltaY: 1 })) return;
    interruptClose();
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
            data-sheet-closing={closeRequest ? "true" : undefined}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <m.div
              className={styles.motionSheetBackdrop}
              style={{ opacity: progress }}
              data-motion-sheet="backdrop"
              aria-hidden="true"
            />
            <m.div
              ref={panelRef}
              className={panelClassName}
              style={{ y }}
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
                setCloseRequest(null);
                runAnimation(0, "settle");
              }}
              data-motion-sheet="panel"
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
