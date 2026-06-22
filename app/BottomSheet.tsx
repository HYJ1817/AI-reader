"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  canInterruptSheetPhase,
  clampSheetDrag,
  getSheetBackdropOpacity,
  getSheetDragTranslation,
  getTransformTranslateY,
  isSheetCloseTransition,
  shouldDismissSheet,
} from "@/lib/motionInteractions";
import styles from "./page.module.css";

type CloseSheet = (afterClose?: () => void) => void;

type Props = {
  onClose: () => void;
  children: ReactNode | ((close: CloseSheet) => ReactNode);
  className?: string;
  ariaLabel?: string;
  showGrabber?: boolean;
};

type SheetPhase = "entering" | "open" | "closing";

type DragState = {
  pointerId: number;
  sheetHeight: number;
  baseTranslationY: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocityY: number;
  translationY: number;
};

export default function BottomSheet({
  onClose,
  children,
  className = "",
  ariaLabel,
  showGrabber = true,
}: Props) {
  const [phase, setPhase] = useState<SheetPhase>("entering");
  const [dragging, setDragging] = useState(false);
  const [afterClose, setAfterClose] = useState<(() => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const closeCompletedRef = useRef(false);

  useEffect(() => {
    let openFrame: number | null = null;
    const paintFrame = window.requestAnimationFrame(() => {
      openFrame = window.requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      window.cancelAnimationFrame(paintFrame);
      if (openFrame !== null) window.cancelAnimationFrame(openFrame);
    };
  }, []);

  const close = useCallback<CloseSheet>(
    (nextAfterClose) => {
      if (phase === "closing") return;
      setAfterClose(() => nextAfterClose ?? null);
      setDragging(false);
      setPhase("closing");
    },
    [phase]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  const finishClose = useCallback(() => {
    if (closeCompletedRef.current) return;
    closeCompletedRef.current = true;
    onClose();
    afterClose?.();
  }, [afterClose, onClose]);

  useEffect(() => {
    if (phase !== "closing") return;
    closeCompletedRef.current = false;
    const reducedMotion =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      Boolean(document.querySelector('[data-reduce-motion="true"]'));
    if (reducedMotion) {
      finishClose();
      return;
    }
    const timer = window.setTimeout(finishClose, 280);
    return () => window.clearTimeout(timer);
  }, [finishClose, phase]);

  function handlePanelTransitionEnd(
    event: ReactTransitionEvent<HTMLDivElement>
  ) {
    if (phase !== "closing") return;
    if (
      isSheetCloseTransition({
        propertyName: event.propertyName,
        targetIsPanel: event.target === event.currentTarget,
      })
    ) {
      finishClose();
    }
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !canInterruptSheetPhase(phase)) return;
    const panel = panelRef.current;
    if (!panel) return;
    const sheetHeight = panel.getBoundingClientRect().height;
    const currentTranslationY = clampSheetDrag(
      getTransformTranslateY(window.getComputedStyle(panel).transform),
      sheetHeight
    );
    panel.style.setProperty("transition", "none");
    panel.style.setProperty("--sheet-drag-y", `${currentTranslationY}px`);
    overlayRef.current?.style.setProperty(
      "--sheet-backdrop-opacity",
      String(
        getSheetBackdropOpacity(
          currentTranslationY,
          sheetHeight
        )
      )
    );
    if (phase === "closing") {
      closeCompletedRef.current = false;
      setAfterClose(null);
      setPhase("open");
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      sheetHeight,
      baseTranslationY: currentTranslationY,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityY: 0,
      translationY: currentTranslationY,
    };
    setDragging(true);
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;

    const elapsed = Math.max(1, event.timeStamp - drag.lastTime);
    const delta = event.clientY - drag.lastY;
    drag.velocityY = (delta / elapsed) * 1000;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.translationY = getSheetDragTranslation({
      baseTranslationY: drag.baseTranslationY,
      pointerDeltaY: event.clientY - drag.startY,
      sheetHeight: drag.sheetHeight,
    });
    panel.style.setProperty("--sheet-drag-y", `${drag.translationY}px`);
    overlayRef.current?.style.setProperty(
      "--sheet-backdrop-opacity",
      String(
        getSheetBackdropOpacity(
          drag.translationY,
          drag.sheetHeight
        )
      )
    );
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;

    const translationY = drag.translationY;
    dragRef.current = null;
    setDragging(false);
    panel.style.removeProperty("transition");
    if (
      shouldDismissSheet({
        translationY,
        velocityY: drag.velocityY,
        sheetHeight: drag.sheetHeight,
      })
    ) {
      close();
      return;
    }
    window.requestAnimationFrame(() => {
      panel.style.setProperty("--sheet-drag-y", "0px");
      overlayRef.current?.style.setProperty("--sheet-backdrop-opacity", "1");
    });
  }

  const overlayClassName = [
    styles.sheetOverlay,
    styles.motionSheetOverlay,
    phase === "entering" ? styles.motionSheetEntering : "",
    phase === "open" ? styles.motionSheetOpen : "",
    phase === "closing" ? styles.motionSheetClosing : "",
    dragging ? styles.motionSheetDragging : "",
  ]
    .filter(Boolean)
    .join(" ");

  const panelClassName = [styles.bottomSheet, className].filter(Boolean).join(" ");
  const panelStyle = {
    "--sheet-drag-y": "0px",
  } as CSSProperties;

  return (
    <div
      ref={overlayRef}
      className={overlayClassName}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        className={panelClassName}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onTransitionEnd={handlePanelTransitionEnd}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {showGrabber && (
          <div
            className={styles.sheetDragHandle}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
          >
            <div className={styles.sheetGrabber} />
          </div>
        )}
        {typeof children === "function" ? children(close) : children}
      </div>
    </div>
  );
}
