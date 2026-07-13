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
        "button, a, input, textarea, select, option, [contenteditable='true'], [role='slider']"
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
}: MotionSheetProps) {
  const reduceMotion = useAppReducedMotion();
  const [present, setPresent] = useState(true);
  const [closeRequest, setCloseRequest] =
    useState<SheetCloseRequest | null>(null);
  const [sheetHeight, setSheetHeight] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(900);
  const dragControls = useDragControls();
  const activeAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const animationGenerationRef = useRef(0);
  const closeCompletedRef = useRef(false);

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
    "--sheet-backdrop-opacity": progress,
  } as unknown as CSSProperties;

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

    const updateHeight = () => {
      const nextHeight = Math.max(1, panel.getBoundingClientRect().height);
      setSheetHeight(nextHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panel);
    return () => observer.disconnect();
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
    onClose();
    callback?.();
  }, [closeRequest, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
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
            className={`${styles.sheetOverlay} ${styles.motionSheetOverlay}`}
            style={overlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : MOTION_DURATION.sheetExit,
            }}
            data-motion-sheet="overlay"
            data-sheet-closing={closeRequest ? "true" : undefined}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <m.div
              ref={panelRef}
              className={panelClassName}
              style={{ y }}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
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
