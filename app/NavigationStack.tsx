"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import {
  getRootTabOffsets,
  type NavigationTab,
} from "@/lib/navigationMotion";
import { MOTION_DURATION, MOTION_SPRING } from "@/lib/motionSystem";
import styles from "./page.module.css";

type NavigationStackContextValue = {
  activeTab: NavigationTab;
  previousTab: NavigationTab;
  settleTab: (tab: NavigationTab) => void;
};

const NavigationStackContext =
  createContext<NavigationStackContextValue | null>(null);

export default function NavigationStack({
  activeTab,
  children,
}: {
  activeTab: NavigationTab;
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
      value={{ activeTab, previousTab: settledTab, settleTab }}
    >
      {children}
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

  const { activeTab, previousTab, settleTab } = context;
  const active = tab === activeTab;
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
      animate={{ opacity: active ? 1 : 0, x }}
      transition={
        reduceMotion
          ? { duration: MOTION_DURATION.reduced }
          : MOTION_SPRING.navigation
      }
      onAnimationComplete={() => {
        if (active) settleTab(tab);
      }}
      aria-hidden={!active}
      style={{ pointerEvents: active ? "auto" : "none" }}
      {...(!active ? { inert: true } : {})}
    >
      {children}
    </m.section>
  );
}
