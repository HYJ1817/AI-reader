"use client";

import { domMax, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createSystemMotionPreferenceStore,
  getMotionPolicy,
  type MotionPolicy,
} from "@/lib/motionSystem";

const AppMotionPolicyContext = createContext<MotionPolicy | null>(null);
const getServerSystemMotionPreference = () => false;
const systemMotionPreferenceStore = createSystemMotionPreferenceStore(
  typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? undefined
    : (query) => window.matchMedia(query)
);

export function useAppMotionPolicy(): MotionPolicy {
  const policy = useContext(AppMotionPolicyContext);

  if (policy === null) {
    throw new Error("useAppMotionPolicy must be used within AppMotionRoot");
  }

  return policy;
}

export function useAppReducedMotion(): boolean {
  return useAppMotionPolicy() === "reduced";
}

export default function AppMotionRoot({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  const systemPreference = useSyncExternalStore(
    systemMotionPreferenceStore.subscribe,
    systemMotionPreferenceStore.getSnapshot,
    getServerSystemMotionPreference
  );
  const motionPolicy = getMotionPolicy(reduceMotion, systemPreference);

  return (
    <AppMotionPolicyContext.Provider value={motionPolicy}>
      <LazyMotion features={domMax} strict>
        <MotionConfig reducedMotion={motionPolicy === "reduced" ? "always" : "never"}>
          <LayoutGroup id="ai-reader-app">{children}</LayoutGroup>
        </MotionConfig>
      </LazyMotion>
    </AppMotionPolicyContext.Provider>
  );
}
