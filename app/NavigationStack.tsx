"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  AnimatePresence,
  m,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import { useNavigation } from "./NavigationProvider";
import type { PushEntry } from "@/lib/appNavigation";
import {
  canStartEdgeBack,
  shouldCompleteEdgeBack,
} from "@/lib/navigationGestures";
import {
  getRootTabOffsets,
  type NavigationTab,
} from "@/lib/navigationMotion";
import { MOTION_DURATION, MOTION_SPRING } from "@/lib/motionSystem";
import styles from "./page.module.css";

type NavigationStackContextValue = {
  activeTab: NavigationTab;
  previousTab: NavigationTab;
  pushDepth: number;
  readerPresented: boolean;
  edgeBackActive: boolean;
  edgeBackSettleMode: EdgeBackSettleMode | null;
  edgeBackProgress: MotionValue<number>;
  settleTab: (tab: NavigationTab) => void;
};

type EdgeBackPointer = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  claimed: boolean;
};

type EdgeBackSettleMode = "complete" | "cancel";

type EdgeBackSettle = {
  ownerKey: string;
  mode: EdgeBackSettleMode;
  target: number;
};

const NavigationStackContext =
  createContext<NavigationStackContextValue | null>(null);

export default function NavigationStack({
  activeTab,
  pushes,
  readerPresented,
  renderPush,
  children,
}: {
  activeTab: NavigationTab;
  pushes: PushEntry[];
  readerPresented: boolean;
  renderPush: (entry: PushEntry) => ReactNode;
  children: ReactNode;
}) {
  const navigation = useNavigation();
  const [settledTab, setSettledTab] = useState(activeTab);
  const [edgeBackOwnerKey, setEdgeBackOwnerKey] = useState<string | null>(null);
  const [edgeBackSettle, setEdgeBackSettle] =
    useState<EdgeBackSettle | null>(null);
  const edgeBackX = useMotionValue(0);
  const edgeBackProgress = useTransform(edgeBackX, (offset) => {
    const width =
      typeof window === "undefined" ? 1 : Math.max(1, window.innerWidth);
    return Math.min(1, Math.max(0, offset / width));
  });
  const edgeFinishHandledRef = useRef(false);
  const topPushKey = pushes.at(-1)?.key ?? null;
  const edgeBackActive =
    edgeBackOwnerKey !== null && edgeBackOwnerKey === topPushKey;
  const activeEdgeSettle =
    edgeBackSettle?.ownerKey === topPushKey ? edgeBackSettle : null;
  const settleTab = useCallback(
    (tab: NavigationTab) => {
      if (tab === activeTab) setSettledTab(tab);
    },
    [activeTab]
  );

  const beginEdgeBack = useCallback(() => {
    if (!topPushKey) return;
    edgeFinishHandledRef.current = false;
    setEdgeBackSettle(null);
    setEdgeBackOwnerKey(topPushKey);
  }, [topPushKey]);

  const settleEdgeBack = useCallback(
    (velocityX: number, viewportWidth: number, forceCancel = false) => {
      if (!topPushKey) return;
      const offsetX = Math.max(0, edgeBackX.get());
      const complete =
        !forceCancel &&
        shouldCompleteEdgeBack(offsetX, velocityX, viewportWidth);
      edgeFinishHandledRef.current = false;
      setEdgeBackSettle({
        ownerKey: topPushKey,
        mode: complete ? "complete" : "cancel",
        target: complete ? Math.max(1, viewportWidth) : 0,
      });
    },
    [edgeBackX, topPushKey]
  );

  const finishEdgeBack = useCallback(() => {
    if (!activeEdgeSettle || edgeFinishHandledRef.current) return;
    edgeFinishHandledRef.current = true;
    if (activeEdgeSettle.mode === "complete") {
      navigation.pop();
      return;
    }
    edgeBackX.set(0);
    setEdgeBackSettle(null);
    setEdgeBackOwnerKey(null);
  }, [activeEdgeSettle, edgeBackX, navigation]);

  const cancelEdgeBack = useCallback(() => {
    settleEdgeBack(0, Math.max(1, window.innerWidth), true);
  }, [settleEdgeBack]);

  useEffect(() => {
    edgeFinishHandledRef.current = false;
    edgeBackX.set(0);
  }, [edgeBackX, topPushKey]);

  return (
    <NavigationStackContext.Provider
      value={{
        activeTab,
        previousTab: settledTab,
        pushDepth: pushes.length,
        readerPresented,
        edgeBackActive,
        edgeBackSettleMode: activeEdgeSettle?.mode ?? null,
        edgeBackProgress,
        settleTab,
      }}
    >
      {children}
      <AnimatePresence initial={false}>
        {pushes.map((entry, index) => (
          <PushLayer
            key={entry.key}
            entry={entry}
            index={index}
            count={pushes.length}
            covered={readerPresented}
            edgeBackActive={edgeBackActive}
            edgeBackSettle={activeEdgeSettle}
            edgeBackX={edgeBackX}
            edgeBackProgress={edgeBackProgress}
            onBeginEdgeBack={beginEdgeBack}
            onSettleEdgeBack={settleEdgeBack}
            onCancelEdgeBack={cancelEdgeBack}
            onFinishEdgeBack={finishEdgeBack}
          >
            {renderPush(entry)}
          </PushLayer>
        ))}
      </AnimatePresence>
    </NavigationStackContext.Provider>
  );
}

export function NavigationRoot({
  tab,
  children,
}: {
  tab: NavigationTab;
  children: ReactNode;
}) {
  const context = useContext(NavigationStackContext);
  const reduceMotion = useAppReducedMotion();

  if (!context) {
    throw new Error("NavigationRoot requires NavigationStack");
  }

  const { activeTab, previousTab, pushDepth, readerPresented, settleTab } =
    context;
  const edgePreviousX = useTransform(
    context.edgeBackProgress,
    [0, 1],
    ["-30%", "0%"]
  );
  const edgePreviousBrightness = useTransform(
    context.edgeBackProgress,
    [0, 1],
    ["brightness(0.94)", "brightness(1)"]
  );
  const active = tab === activeTab;
  const interactive = active && pushDepth === 0 && !readerPresented;
  const outgoing = tab === previousTab && previousTab !== activeTab;
  const trackingPrevious =
    context.edgeBackActive &&
    context.edgeBackSettleMode === null &&
    pushDepth === 1;
  const settlingPrevious =
    context.edgeBackActive &&
    context.edgeBackSettleMode !== null &&
    pushDepth === 1;
  const x = reduceMotion
    ? 0
    : active
      ? 0
      : outgoing
        ? getRootTabOffsets(previousTab, activeTab).outgoing
        : getRootTabOffsets(activeTab, tab).incoming;

  return (
    <m.section
      className={styles.appSurface}
      data-navigation-root={tab}
      initial={false}
      animate={{
        opacity: active && !readerPresented ? 1 : 0,
        x,
      }}
      transition={
        reduceMotion
          ? { duration: MOTION_DURATION.reduced }
          : MOTION_SPRING.navigation
      }
      onAnimationComplete={() => {
        if (active) settleTab(tab);
      }}
      aria-hidden={!interactive}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      {...(!interactive ? { inert: true } : {})}
    >
      <m.div
        className={styles.rootParallaxLayer}
        initial={false}
        animate={
          trackingPrevious
            ? undefined
            : settlingPrevious
              ? {
                  x:
                    context.edgeBackSettleMode === "complete"
                      ? "0%"
                      : "-30%",
                  filter:
                    context.edgeBackSettleMode === "complete"
                      ? "brightness(1)"
                      : "brightness(0.94)",
                }
            : {
                x: reduceMotion || pushDepth === 0 ? "0%" : "-30%",
                filter:
                  pushDepth > 0 ? "brightness(0.94)" : "brightness(1)",
              }
        }
        style={
          trackingPrevious
            ? { x: edgePreviousX, filter: edgePreviousBrightness }
            : undefined
        }
        transition={
          reduceMotion
            ? { duration: MOTION_DURATION.reduced }
            : settlingPrevious && context.edgeBackSettleMode === "complete"
              ? { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
              : MOTION_SPRING.navigation
        }
      >
        {children}
      </m.div>
    </m.section>
  );
}

function PushLayer({
  entry,
  index,
  count,
  covered,
  edgeBackActive,
  edgeBackSettle,
  edgeBackX,
  edgeBackProgress,
  onBeginEdgeBack,
  onSettleEdgeBack,
  onCancelEdgeBack,
  onFinishEdgeBack,
  children,
}: {
  entry: PushEntry;
  index: number;
  count: number;
  covered: boolean;
  edgeBackActive: boolean;
  edgeBackSettle: EdgeBackSettle | null;
  edgeBackX: MotionValue<number>;
  edgeBackProgress: MotionValue<number>;
  onBeginEdgeBack: () => void;
  onSettleEdgeBack: (velocityX: number, viewportWidth: number) => void;
  onCancelEdgeBack: () => void;
  onFinishEdgeBack: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useAppReducedMotion();
  const pointerRef = useRef<EdgeBackPointer | null>(null);
  const distanceFromTop = count - index - 1;
  const top = distanceFromTop === 0;
  const interactive = top && !covered;
  const visible = distanceFromTop <= 1;
  const trackingTop = top && edgeBackActive && edgeBackSettle === null;
  const trackingPrevious =
    distanceFromTop === 1 && edgeBackActive && edgeBackSettle === null;
  const settlingTop = top && edgeBackActive && edgeBackSettle !== null;
  const settlingPrevious =
    distanceFromTop === 1 && edgeBackActive && edgeBackSettle !== null;
  const edgePreviousX = useTransform(
    edgeBackProgress,
    [0, 1],
    ["-30%", "0%"]
  );
  const edgePreviousBrightness = useTransform(
    edgeBackProgress,
    [0, 1],
    ["brightness(0.94)", "brightness(1)"]
  );

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (
      event.button !== 0 ||
      !canStartEdgeBack({
        clientX: event.clientX,
        hasPush: top,
        inReader:
          covered ||
          Boolean(
            event.target instanceof Element &&
              event.target.closest('[data-navigation-gesture-owner="reader"]')
          ),
      }) ||
      (event.target instanceof Element &&
        event.target.closest('[data-navigation-gesture-owner="sheet"]'))
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocityX: 0,
      claimed: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!pointer.claimed) {
      if (absY > 12 && absY >= absX) {
        pointerRef.current = null;
        return;
      }
      if (deltaX <= 12 || absX <= absY * 1.25) return;
      pointer.claimed = true;
      flushSync(onBeginEdgeBack);
      edgeBackX.stop();
    }

    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - pointer.lastTime);
    pointer.velocityX = ((event.clientX - pointer.lastX) / elapsed) * 1000;
    pointer.lastX = event.clientX;
    pointer.lastTime = event.timeStamp;
    const viewportWidth = Math.max(
      1,
      event.currentTarget.ownerDocument.defaultView?.innerWidth ??
        window.innerWidth
    );
    const nextOffset = Math.min(Math.max(0, deltaX), viewportWidth);
    edgeBackX.set(nextOffset);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (!pointer.claimed) return;
    onSettleEdgeBack(
      pointer.velocityX,
      Math.max(
        1,
        event.currentTarget.ownerDocument.defaultView?.innerWidth ??
          window.innerWidth
      )
    );
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (pointer.claimed) onCancelEdgeBack();
  }

  const edgeStyle = trackingTop
    ? { x: edgeBackX }
    : trackingPrevious
      ? { x: edgePreviousX, filter: edgePreviousBrightness }
      : {};

  const settlingTarget = edgeBackSettle?.target ?? 0;
  const settlingComplete = edgeBackSettle?.mode === "complete";

  return (
    <m.section
      className={`${styles.appSurface} ${styles.pushSurface}`}
      data-push-route={entry.route}
      initial={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
      animate={{
        opacity: visible ? 1 : 0,
        ...(settlingTop
          ? { x: settlingTarget, filter: "brightness(1)" }
          : settlingPrevious
            ? {
                x: settlingComplete ? "0%" : "-30%",
                filter: settlingComplete
                  ? "brightness(1)"
                  : "brightness(0.94)",
              }
          : trackingTop || trackingPrevious
          ? {}
          : {
              x: reduceMotion ? 0 : top ? 0 : "-30%",
              filter: top ? "brightness(1)" : "brightness(0.94)",
            }),
      }}
      exit={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
      transition={
        reduceMotion
          ? { duration: MOTION_DURATION.reduced }
          : (settlingTop || settlingPrevious) && settlingComplete
            ? { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
            : MOTION_SPRING.navigation
      }
      onUpdate={(latest) => {
        if (settlingTop && typeof latest.x === "number") {
          edgeBackX.set(latest.x);
        }
      }}
      onAnimationComplete={() => {
        if (settlingTop) {
          onFinishEdgeBack();
        }
      }}
      aria-hidden={!interactive}
      style={{
        ...edgeStyle,
        pointerEvents: interactive ? "auto" : "none",
        zIndex: 20 + index,
      }}
      data-edge-back-active={
        trackingTop || settlingTop ? "true" : undefined
      }
      data-edge-back-settling={edgeBackSettle?.mode}
      {...(!interactive ? { inert: true } : {})}
    >
      {children}
      {interactive && (
        <div
          className={styles.edgeBackGestureRegion}
          data-edge-back-gesture-region="true"
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerCancel}
        />
      )}
    </m.section>
  );
}
