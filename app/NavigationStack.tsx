"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import type { PushEntry } from "@/lib/appNavigation";
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
  settleTab: (tab: NavigationTab) => void;
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
  const [settledTab, setSettledTab] = useState(activeTab);
  const settleTab = useCallback(
    (tab: NavigationTab) => {
      if (tab === activeTab) setSettledTab(tab);
    },
    [activeTab]
  );

  return (
    <NavigationStackContext.Provider
      value={{
        activeTab,
        previousTab: settledTab,
        pushDepth: pushes.length,
        readerPresented,
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
  const active = tab === activeTab;
  const interactive = active && pushDepth === 0 && !readerPresented;
  const outgoing = tab === previousTab && previousTab !== activeTab;
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
        animate={{
          x: reduceMotion || pushDepth === 0 ? "0%" : "-30%",
          filter:
            pushDepth > 0 ? "brightness(0.94)" : "brightness(1)",
        }}
        transition={
          reduceMotion
            ? { duration: MOTION_DURATION.reduced }
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
  children,
}: {
  entry: PushEntry;
  index: number;
  count: number;
  covered: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useAppReducedMotion();
  const distanceFromTop = count - index - 1;
  const top = distanceFromTop === 0;
  const interactive = top && !covered;
  const visible = distanceFromTop <= 1;

  return (
    <m.section
      className={`${styles.appSurface} ${styles.pushSurface}`}
      data-push-route={entry.route}
      initial={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
      animate={{
        opacity: visible ? 1 : 0,
        x: reduceMotion ? 0 : top ? 0 : "-30%",
        filter: top ? "brightness(1)" : "brightness(0.94)",
      }}
      exit={reduceMotion ? { opacity: 0, x: 0 } : { opacity: 1, x: "100%" }}
      transition={
        reduceMotion
          ? { duration: MOTION_DURATION.reduced }
          : MOTION_SPRING.navigation
      }
      aria-hidden={!interactive}
      style={{
        pointerEvents: interactive ? "auto" : "none",
        zIndex: 20 + index,
      }}
      {...(!interactive ? { inert: true } : {})}
    >
      {children}
    </m.section>
  );
}
