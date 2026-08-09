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
import {
  useAppMotionLifecycle,
  useAppReducedMotion,
} from "./AppMotionRoot";
import { useNavigation } from "./NavigationProvider";
import type { PushEntry } from "@/lib/appNavigation";
import {
  canStartEdgeBack,
  shouldCompleteEdgeBack,
} from "@/lib/navigationGestures";
import {
  COMPACT_PUSH_OFFSETS,
  getCompactPushOffsets,
  getPushTransition,
  getPushMotionProfile,
  getRootTabOffsets,
  type NavigationTab,
} from "@/lib/navigationMotion";
import {
  MOTION_DURATION,
  MOTION_SPRING,
  ROOT_TAB_CONTENT_TRANSITION,
} from "@/lib/motionSystem";
import styles from "./page.module.css";

type NavigationStackContextValue = {
  activeTab: NavigationTab;
  previousTab: NavigationTab;
  pushDepth: number;
  topPushRoute?: PushEntry["route"];
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
  generation: number;
  mode: EdgeBackSettleMode;
  target: number;
};

const PUSH_DEPTH_OPACITY = 0.06;

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
  const motionLifecycle = useAppMotionLifecycle();
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
  const edgeBackPointerRef = useRef<EdgeBackPointer | null>(null);
  const edgeGestureGenerationRef = useRef(0);
  const activeEdgeSettleGenerationRef = useRef<number | null>(null);
  const lifecycleEpochRef = useRef(motionLifecycle.epoch);
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
    edgeGestureGenerationRef.current += 1;
    activeEdgeSettleGenerationRef.current = null;
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
      const generation = edgeGestureGenerationRef.current;
      activeEdgeSettleGenerationRef.current = generation;
      edgeFinishHandledRef.current = false;
      setEdgeBackSettle({
        ownerKey: topPushKey,
        generation,
        mode: complete ? "complete" : "cancel",
        target: complete ? Math.max(1, viewportWidth) : 0,
      });
    },
    [edgeBackX, topPushKey]
  );

  const finishEdgeBack = useCallback((settlement: EdgeBackSettle) => {
    if (
      edgeFinishHandledRef.current ||
      activeEdgeSettleGenerationRef.current !== settlement.generation
    ) {
      return;
    }
    edgeFinishHandledRef.current = true;
    activeEdgeSettleGenerationRef.current = null;
    if (settlement.mode === "complete") {
      navigation.pop();
      return;
    }
    edgeBackX.set(0);
    setEdgeBackSettle(null);
    setEdgeBackOwnerKey(null);
  }, [edgeBackX, navigation]);

  const cancelEdgeBack = useCallback(() => {
    settleEdgeBack(0, Math.max(1, window.innerWidth), true);
  }, [settleEdgeBack]);

  useEffect(() => {
    activeEdgeSettleGenerationRef.current = null;
    edgeBackX.set(0);
  }, [edgeBackX, topPushKey]);

  useEffect(() => {
    if (lifecycleEpochRef.current === motionLifecycle.epoch) return;
    lifecycleEpochRef.current = motionLifecycle.epoch;
    edgeBackPointerRef.current = null;
    edgeFinishHandledRef.current = true;
    activeEdgeSettleGenerationRef.current = null;
    edgeBackX.stop();
    edgeBackX.set(0);
    setEdgeBackSettle(null);
    setEdgeBackOwnerKey(null);
  }, [edgeBackX, motionLifecycle.epoch]);

  return (
    <NavigationStackContext.Provider
      value={{
        activeTab,
        previousTab: settledTab,
        pushDepth: pushes.length,
        topPushRoute: pushes.at(-1)?.route,
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
            coveringRoute={pushes[index + 1]?.route}
            index={index}
            count={pushes.length}
            covered={readerPresented}
            edgeBackActive={edgeBackActive}
            edgeBackSettle={activeEdgeSettle}
            edgeBackX={edgeBackX}
            edgeBackProgress={edgeBackProgress}
            pointerRef={edgeBackPointerRef}
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

  const {
    activeTab,
    previousTab,
    pushDepth,
    topPushRoute,
    readerPresented,
    settleTab,
  } = context;
  const edgePreviousX = useTransform(
    context.edgeBackProgress,
    [0, 1],
    ["-30%", "0%"]
  );
  const edgePreviousOverlayOpacity = useTransform(
    context.edgeBackProgress,
    [0, 1],
    [PUSH_DEPTH_OPACITY, 0]
  );
  const edgePreviousOpacity = useTransform(
    context.edgeBackProgress,
    [0, 1],
    [0, 1]
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
  const compactCovered =
    pushDepth === 1 && getPushMotionProfile(topPushRoute) === "compact";
  const compactPushOffsets = getCompactPushOffsets(1);
  const coveredX = compactCovered
    ? compactPushOffsets.covered
    : "-30%";
  const coveredOpacity =
    compactCovered && active && !readerPresented
      ? settlingPrevious && context.edgeBackSettleMode === "complete"
        ? 1
        : 0
      : active && !readerPresented
        ? 1
        : 0;
  const x = reduceMotion
    ? 0
    : active
      ? 0
      : outgoing
        ? getRootTabOffsets(previousTab, activeTab).outgoing
        : getRootTabOffsets(activeTab, tab).incoming;
  const rootTabTransition = reduceMotion
    ? { duration: MOTION_DURATION.reduced }
    : pushDepth === 0
      ? active
        ? ROOT_TAB_CONTENT_TRANSITION
        : { duration: 0 }
      : ROOT_TAB_CONTENT_TRANSITION;

  return (
    <m.section
      className={styles.appSurface}
      data-navigation-root={tab}
      data-motion-role="root-content"
      initial={false}
      animate={{
        opacity: coveredOpacity,
        x,
      }}
      transition={rootTabTransition}
      onAnimationComplete={() => {
        if (active) settleTab(tab);
      }}
      aria-hidden={!interactive}
      style={{
        ...(trackingPrevious && compactCovered
          ? { opacity: edgePreviousOpacity }
          : {}),
        pointerEvents: interactive ? "auto" : "none",
      }}
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
                      : coveredX,
                }
              : {
                  x: reduceMotion || pushDepth === 0 ? "0%" : coveredX,
                }
        }
        style={
          trackingPrevious
            ? { x: edgePreviousX }
            : undefined
        }
        transition={
          reduceMotion
            ? { duration: MOTION_DURATION.reduced }
            : settlingPrevious && context.edgeBackSettleMode === "complete"
              ? {
                  duration: MOTION_DURATION.gestureSettle,
                  ease: [0.32, 0.72, 0, 1],
                }
              : MOTION_SPRING.navigation
        }
      >
        {children}
        <m.div
          className={styles.pushDepthOverlay}
          aria-hidden="true"
          initial={false}
          animate={
            trackingPrevious
              ? undefined
              : settlingPrevious
                ? {
                    opacity:
                      reduceMotion ||
                      context.edgeBackSettleMode === "complete"
                        ? 0
                        : compactCovered
                          ? 0
                          : PUSH_DEPTH_OPACITY,
                  }
                : {
                    opacity:
                      reduceMotion || pushDepth === 0
                        ? 0
                        : compactCovered
                          ? 0
                          : PUSH_DEPTH_OPACITY,
                  }
          }
          style={
            trackingPrevious
              ? {
                  opacity: compactCovered
                    ? 0
                    : edgePreviousOverlayOpacity,
                }
              : undefined
          }
          transition={
            reduceMotion
              ? { duration: MOTION_DURATION.reduced }
              : settlingPrevious &&
                  context.edgeBackSettleMode === "complete"
                ? {
                    duration: MOTION_DURATION.gestureSettle,
                    ease: [0.32, 0.72, 0, 1],
                  }
                : MOTION_SPRING.navigation
          }
        />
      </m.div>
    </m.section>
  );
}

function PushLayer({
  entry,
  coveringRoute,
  index,
  count,
  covered,
  edgeBackActive,
  edgeBackSettle,
  edgeBackX,
  edgeBackProgress,
  pointerRef,
  onBeginEdgeBack,
  onSettleEdgeBack,
  onCancelEdgeBack,
  onFinishEdgeBack,
  children,
}: {
  entry: PushEntry;
  coveringRoute?: PushEntry["route"];
  index: number;
  count: number;
  covered: boolean;
  edgeBackActive: boolean;
  edgeBackSettle: EdgeBackSettle | null;
  edgeBackX: MotionValue<number>;
  edgeBackProgress: MotionValue<number>;
  pointerRef: { current: EdgeBackPointer | null };
  onBeginEdgeBack: () => void;
  onSettleEdgeBack: (velocityX: number, viewportWidth: number) => void;
  onCancelEdgeBack: () => void;
  onFinishEdgeBack: (settlement: EdgeBackSettle) => void;
  children: ReactNode;
}) {
  const reduceMotion = useAppReducedMotion();
  const distanceFromTop = count - index - 1;
  const motionProfile = getPushMotionProfile(entry.route);
  const coveringMotionProfile = getPushMotionProfile(coveringRoute);
  const compactPush = motionProfile === "compact";
  const compactCovered =
    distanceFromTop === 1 && coveringMotionProfile === "compact";
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
  const edgePreviousOverlayOpacity = useTransform(
    edgeBackProgress,
    [0, 1],
    [PUSH_DEPTH_OPACITY, 0]
  );
  const edgePreviousOpacity = useTransform(
    edgeBackProgress,
    [0, 1],
    [0, 1]
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
      ? {
          x: edgePreviousX,
          ...(compactCovered ? { opacity: edgePreviousOpacity } : {}),
        }
      : {};

  const settlingTarget = edgeBackSettle?.target ?? 0;
  const settlingComplete = edgeBackSettle?.mode === "complete";
  const pushExitTarget = {
    ...(reduceMotion
      ? { opacity: 0, x: 0 }
      : settlingTop && settlingComplete
        ? { opacity: 1, x: settlingTarget }
        : compactPush
          ? { opacity: 0, x: COMPACT_PUSH_OFFSETS.incoming }
          : { opacity: 1, x: "100%" }),
    transition: getPushTransition("exit", reduceMotion),
  };

  return (
    <m.section
      className={`${styles.appSurface} ${styles.pushSurface}`}
      data-push-route={entry.route}
      data-push-motion={motionProfile}
      initial={
        reduceMotion
          ? { opacity: 0, x: 0 }
          : compactPush
            ? { opacity: 0, x: COMPACT_PUSH_OFFSETS.incoming }
            : { opacity: 1, x: "100%" }
      }
      animate={{
        opacity:
          settlingPrevious && compactCovered
            ? settlingComplete
              ? 1
              : 0
            : compactCovered
              ? 0
              : visible
                ? 1
                : 0,
        ...(settlingTop
          ? { x: settlingTarget }
          : settlingPrevious
            ? {
                x: settlingComplete
                  ? 0
                  : compactCovered
                    ? COMPACT_PUSH_OFFSETS.covered
                    : "-30%",
              }
            : trackingTop || trackingPrevious
              ? {}
              : {
                  x: reduceMotion
                    ? 0
                    : top
                      ? 0
                      : compactCovered
                        ? COMPACT_PUSH_OFFSETS.covered
                        : "-30%",
                }),
      }}
      exit={pushExitTarget}
      transition={
        settlingTop || settlingPrevious
          ? reduceMotion
            ? { duration: MOTION_DURATION.reduced }
            : {
                duration: MOTION_DURATION.gestureSettle,
                ease: [0.32, 0.72, 0, 1],
              }
          : getPushTransition("enter", reduceMotion)
      }
      onUpdate={(latest) => {
        if (settlingTop && typeof latest.x === "number") {
          edgeBackX.set(latest.x);
        }
      }}
      onAnimationComplete={() => {
        if (settlingTop && edgeBackSettle) {
          onFinishEdgeBack(edgeBackSettle);
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
      <m.div
        className={styles.pushDepthOverlay}
        aria-hidden="true"
        initial={false}
        animate={
          trackingPrevious
            ? undefined
            : settlingPrevious
              ? {
                  opacity:
                    reduceMotion || settlingComplete
                      ? 0
                      : compactCovered
                        ? 0
                        : PUSH_DEPTH_OPACITY,
                }
              : {
                  opacity:
                    reduceMotion || distanceFromTop === 0
                      ? 0
                      : compactCovered
                        ? 0
                        : PUSH_DEPTH_OPACITY,
                }
        }
        style={
          trackingPrevious
            ? {
                opacity: compactCovered
                  ? 0
                  : edgePreviousOverlayOpacity,
              }
            : undefined
        }
        transition={
          reduceMotion
            ? { duration: MOTION_DURATION.reduced }
            : settlingPrevious && settlingComplete
              ? {
                  duration: MOTION_DURATION.gestureSettle,
                  ease: [0.32, 0.72, 0, 1],
                }
              : MOTION_SPRING.navigation
        }
      />
      {interactive && (
        <div
          className={styles.edgeBackGestureRegion}
          data-edge-back-gesture-region="true"
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerCancel}
          onLostPointerCapture={handlePointerCancel}
        />
      )}
    </m.section>
  );
}
