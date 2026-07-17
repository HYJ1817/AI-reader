"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  clampReadingGoalMinutes,
  clampReadingGoalWheelPosition,
  getReadingGoalWheelAnimationMix,
  getReadingGoalWheelDeltaRows,
  getReadingGoalWheelDragTarget,
  getReadingGoalWheelSelectedValue,
  getReadingGoalWheelValues,
  getReadingGoalWheelValueForKey,
  getReadingGoalWheelVisualState,
  shouldPlayReadingGoalTick,
  READING_GOAL_MAX_MINUTES,
  READING_GOAL_MIN_MINUTES,
  READING_GOAL_WHEEL_SMOOTHING_MS,
} from "@/lib/readingGoalWheel";
import styles from "./page.module.css";

type ReadingGoalWheelProps = {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
};

type PointerDrag = {
  pointerId: number;
  lastY: number;
};

const FONT_SIZE_REM = 1.7;
const SPACING = 1.4;
const ROW_HEIGHT_REM = FONT_SIZE_REM * SPACING;
const WHEEL_SETTLE_MS = 90;
const FALLBACK_ROOT_FONT_SIZE_PX = 16;
const MAX_FRAME_GAP_MS = 64;
const POSITION_EPSILON = 0.001;

// Derived from React Bits Option Wheel:
// https://github.com/DavidHDev/react-bits
// License and Commons Clause notice: ../THIRD_PARTY_NOTICES.md
export default function ReadingGoalWheel({
  value,
  onChange,
  ariaLabel,
}: ReadingGoalWheelProps) {
  const initialValue = clampReadingGoalMinutes(value);
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const [renderCenter, setRenderCenter] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);
  const [controlledReconciliationGeneration, setControlledReconciliationGeneration] =
    useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const positionRef = useRef(initialValue);
  const targetRef = useRef(initialValue);
  const selectedRef = useRef(initialValue);
  const controlledValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const localEchoValuesRef = useRef(new Set<number>());
  const reconciledControlledGenerationRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const wheelTimerRef = useRef<number | null>(null);
  const dragRef = useRef<PointerDrag | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTickRef = useRef(-1_000_000_000);
  const reducedMotionRef = useRef(false);
  const mountedRef = useRef(true);
  const animateRef = useRef<FrameRequestCallback | null>(null);

  const visibleValues = getReadingGoalWheelValues(renderCenter);

  const paintRows = useCallback((position: number) => {
    for (const [itemValue, row] of rowRefs.current) {
      const visualState = getReadingGoalWheelVisualState(itemValue, position);
      const offsetRem = visualState.offsetSteps * ROW_HEIGHT_REM;
      row.style.transform = `translateY(calc(-50% + ${offsetRem}rem))`;
      row.style.filter = `blur(${visualState.blurPx}px)`;
      row.style.opacity = String(visualState.opacity);
      row.style.fontWeight = String(400 + visualState.emphasis * 100);
      row.style.color =
        visualState.emphasis > 0.5
          ? "var(--text-primary)"
          : "var(--text-secondary)";
    }
  }, []);

  const playTick = useCallback((previousValue: number, nextValue: number) => {
    if (typeof performance === "undefined") return;
    const now = performance.now();
    if (
      !shouldPlayReadingGoalTick(
        previousValue,
        nextValue,
        now,
        lastTickRef.current
      )
    ) {
      return;
    }

    lastTickRef.current = now;
    if (typeof Audio === "undefined") return;

    try {
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio("/assets/sounds/click-soft.mp3");
        audio.preload = "auto";
        audio.volume = 0.5;
        audioRef.current = audio;
      }
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    } catch {
      // Sound is a nonessential enhancement and must never block interaction.
    }
  }, []);

  const beginLocalInteraction = useCallback(() => {
    const controlledValue = controlledValueRef.current;
    if (Number.isFinite(controlledValue)) {
      localEchoValuesRef.current.add(
        clampReadingGoalMinutes(controlledValue)
      );
    }
  }, []);

  const emitSelectedValue = useCallback(
    (position: number) => {
      const nextValue = getReadingGoalWheelSelectedValue(position);
      if (nextValue === selectedRef.current || !mountedRef.current) return;

      playTick(selectedRef.current, nextValue);
      selectedRef.current = nextValue;
      localEchoValuesRef.current.add(nextValue);
      setSelectedValue(nextValue);
      setRenderCenter(nextValue);
      onChangeRef.current(nextValue);
    },
    [playTick]
  );

  const requestControlledReconciliation = useCallback(() => {
    if (!mountedRef.current || localEchoValuesRef.current.size === 0) return;
    setControlledReconciliationGeneration((generation) => generation + 1);
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      rafRef.current = 0;
      if (!mountedRef.current || !Number.isFinite(timestamp)) {
        lastFrameRef.current = null;
        return;
      }

      const previousTimestamp = lastFrameRef.current;
      const elapsed =
        previousTimestamp === null
          ? 1000 / 60
          : Math.min(
              MAX_FRAME_GAP_MS,
              Math.max(0, timestamp - previousTimestamp)
            );
      lastFrameRef.current = timestamp;

      const currentPosition = positionRef.current;
      const targetPosition = targetRef.current;
      const distance = targetPosition - currentPosition;
      const mix = reducedMotionRef.current
        ? 1
        : getReadingGoalWheelAnimationMix(
            elapsed,
            READING_GOAL_WHEEL_SMOOTHING_MS
          );
      const nextPosition = clampReadingGoalWheelPosition(
        Math.abs(distance) < POSITION_EPSILON
          ? targetPosition
          : currentPosition + distance * mix
      );

      positionRef.current = nextPosition;
      paintRows(nextPosition);
      emitSelectedValue(nextPosition);

      if (Math.abs(targetRef.current - nextPosition) < POSITION_EPSILON) {
        positionRef.current = targetRef.current;
        paintRows(targetRef.current);
        emitSelectedValue(targetRef.current);
        requestControlledReconciliation();
        lastFrameRef.current = null;
        return;
      }

      const nextFrame = animateRef.current;
      if (nextFrame) rafRef.current = requestAnimationFrame(nextFrame);
    },
    [emitSelectedValue, paintRows, requestControlledReconciliation]
  );

  const ensureAnimation = useCallback(() => {
    if (reducedMotionRef.current) {
      positionRef.current = targetRef.current;
      lastFrameRef.current = null;
      paintRows(positionRef.current);
      emitSelectedValue(positionRef.current);
      requestControlledReconciliation();
      return;
    }
    if (rafRef.current !== 0) return;
    lastFrameRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
  }, [
    animate,
    emitSelectedValue,
    paintRows,
    requestControlledReconciliation,
  ]);

  useLayoutEffect(() => {
    animateRef.current = animate;
    return () => {
      if (animateRef.current === animate) animateRef.current = null;
    };
  }, [animate]);

  useLayoutEffect(() => {
    return () => {
      mountedRef.current = false;
      animateRef.current = null;
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
    };
  }, []);

  const clearWheelTimer = useCallback(() => {
    if (wheelTimerRef.current === null) return;
    window.clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = null;
  }, []);

  const settleTarget = useCallback(() => {
    targetRef.current = clampReadingGoalMinutes(targetRef.current);
    ensureAnimation();
  }, [ensureAnimation]);

  const measureRowHeight = useCallback(() => {
    const root = rootRef.current;
    if (root && typeof window !== "undefined") {
      const rootFontSize = Number.parseFloat(
        window.getComputedStyle(root).fontSize
      );
      const measuredHeight = rootFontSize * ROW_HEIGHT_REM;
      if (Number.isFinite(measuredHeight) && measuredHeight > 0) {
        return measuredHeight;
      }
    }
    return FALLBACK_ROOT_FONT_SIZE_PX * ROW_HEIGHT_REM;
  }, []);

  const releaseActivePointer = useCallback(() => {
    const drag = dragRef.current;
    const root = rootRef.current;
    dragRef.current = null;
    setIsDragging(false);
    if (drag && root?.hasPointerCapture(drag.pointerId)) {
      try {
        root.releasePointerCapture(drag.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const targetValue = getReadingGoalWheelSelectedValue(targetRef.current);
    const nextValue = getReadingGoalWheelValueForKey(
      targetValue,
      event.key
    );
    if (nextValue === null) return;

    event.preventDefault();
    beginLocalInteraction();
    clearWheelTimer();
    releaseActivePointer();
    targetRef.current = nextValue;
    ensureAnimation();
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    const rowHeight = measureRowHeight();
    const deltaRows = getReadingGoalWheelDeltaRows(
      event.deltaY,
      event.deltaMode,
      rowHeight,
      rootRef.current?.clientHeight ?? 0
    );
    if (deltaRows === 0) return;
    const nextTarget = targetRef.current + deltaRows;
    if (!Number.isFinite(nextTarget)) return;

    event.preventDefault();
    beginLocalInteraction();
    targetRef.current = clampReadingGoalWheelPosition(nextTarget);
    clearWheelTimer();
    wheelTimerRef.current = window.setTimeout(() => {
      wheelTimerRef.current = null;
      if (mountedRef.current) settleTarget();
    }, WHEEL_SETTLE_MS);
    ensureAnimation();
  }, [
    beginLocalInteraction,
    clearWheelTimer,
    ensureAnimation,
    measureRowHeight,
    settleTarget,
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wheelListenerOptions = { passive: false } as const;
    root.addEventListener("wheel", handleWheel, wheelListenerOptions);
    return () => {
      root.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.focus();
    if (!Number.isFinite(event.clientY)) return;

    clearWheelTimer();
    releaseActivePointer();
    beginLocalInteraction();
    dragRef.current = {
      pointerId: event.pointerId,
      lastY: event.clientY,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (
      !drag ||
      drag.pointerId !== event.pointerId ||
      !Number.isFinite(event.clientY) ||
      !Number.isFinite(drag.lastY - event.clientY)
    ) {
      return;
    }

    targetRef.current = getReadingGoalWheelDragTarget(
      targetRef.current,
      drag.lastY,
      event.clientY,
      measureRowHeight()
    );
    drag.lastY = event.clientY;
    ensureAnimation();
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }
    settleTarget();
  };

  const handleLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    settleTarget();
  };

  useLayoutEffect(() => {
    controlledValueRef.current = value;
    onChangeRef.current = onChange;
  }, [onChange, value]);

  useLayoutEffect(() => {
    paintRows(positionRef.current);
  }, [paintRows, renderCenter]);

  useEffect(() => {
    const isPostSettleReconciliation =
      reconciledControlledGenerationRef.current !==
      controlledReconciliationGeneration;
    if (isPostSettleReconciliation) {
      reconciledControlledGenerationRef.current =
        controlledReconciliationGeneration;
      localEchoValuesRef.current.clear();
    }

    const nextValue = clampReadingGoalMinutes(value);
    if (nextValue === selectedRef.current) return;
    if (
      !isPostSettleReconciliation &&
      localEchoValuesRef.current.has(nextValue)
    ) {
      return;
    }

    localEchoValuesRef.current.clear();
    if (rafRef.current !== 0) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    lastFrameRef.current = null;
    positionRef.current = nextValue;
    targetRef.current = nextValue;
    selectedRef.current = nextValue;
    setSelectedValue(nextValue);
    setRenderCenter(nextValue);
    paintRows(nextValue);
  }, [paintRows, value, controlledReconciliationGeneration]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const synchronizeMotionPreference = () => {
      reducedMotionRef.current = mediaQuery.matches;
      if (!mediaQuery.matches) return;
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      positionRef.current = targetRef.current;
      lastFrameRef.current = null;
      paintRows(positionRef.current);
      emitSelectedValue(positionRef.current);
      requestControlledReconciliation();
    };

    synchronizeMotionPreference();
    mediaQuery.addEventListener("change", synchronizeMotionPreference);
    return () => {
      mediaQuery.removeEventListener("change", synchronizeMotionPreference);
    };
  }, [emitSelectedValue, paintRows, requestControlledReconciliation]);

  useEffect(() => {
    mountedRef.current = true;
    const root = rootRef.current;
    const rows = rowRefs.current;
    return () => {
      mountedRef.current = false;
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (wheelTimerRef.current !== null) {
        window.clearTimeout(wheelTimerRef.current);
        wheelTimerRef.current = null;
      }
      const drag = dragRef.current;
      if (drag && root?.hasPointerCapture(drag.pointerId)) {
        try {
          root.releasePointerCapture(drag.pointerId);
        } catch {
          // Pointer capture may already have been released by the browser.
        }
      }
      dragRef.current = null;
      lastFrameRef.current = null;
      rows.clear();
      audioRef.current?.pause();
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = 0;
        } catch {
          // Some browsers reject seeking audio that has not loaded yet.
        }
      }
      audioRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={[styles.goalWheel, isDragging ? styles.goalWheelDragging : ""]
        .filter(Boolean)
        .join(" ")}
      data-reading-goal-wheel="true"
      data-selected-minute={selectedValue}
      role="spinbutton"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={READING_GOAL_MIN_MINUTES}
      aria-valuemax={READING_GOAL_MAX_MINUTES}
      aria-valuenow={selectedValue}
      aria-valuetext={`${selectedValue} 分钟`}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerDrag}
      onPointerCancel={finishPointerDrag}
      onLostPointerCapture={handleLostPointerCapture}
    >
      <div className={styles.goalWheelRows} aria-hidden="true">
        {visibleValues.map((itemValue) => (
          <div
            ref={(node) => {
              if (node) rowRefs.current.set(itemValue, node);
              else rowRefs.current.delete(itemValue);
            }}
            className={styles.goalWheelRow}
            data-reading-goal-wheel-row="true"
            data-minute={itemValue}
            role="presentation"
            key={itemValue}
          >
            {itemValue}
          </div>
        ))}
      </div>
    </div>
  );
}
