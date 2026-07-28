"use client";

import { domMax, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createMotionLifecycleState,
  reduceMotionLifecycle,
  type MotionLifecycleState,
} from "@/lib/motionLifecycle";
import {
  createSystemMotionPreferenceStore,
  getMotionPolicy,
  type MotionPolicy,
} from "@/lib/motionSystem";

const AppMotionPolicyContext = createContext<MotionPolicy | null>(null);
const AppMotionLifecycleContext = createContext<MotionLifecycleState | null>(null);
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

export function useAppMotionLifecycle(): MotionLifecycleState {
  const lifecycle = useContext(AppMotionLifecycleContext);

  if (lifecycle === null) {
    throw new Error("useAppMotionLifecycle must be used within AppMotionRoot");
  }

  return lifecycle;
}

export default function AppMotionRoot({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  const [motionLifecycle, dispatchMotionLifecycle] = useReducer(
    reduceMotionLifecycle,
    createMotionLifecycleState()
  );
  const systemPreference = useSyncExternalStore(
    systemMotionPreferenceStore.subscribe,
    systemMotionPreferenceStore.getSnapshot,
    getServerSystemMotionPreference
  );
  const motionPolicy = getMotionPolicy(reduceMotion, systemPreference);

  useEffect(() => {
    const suspend = () => dispatchMotionLifecycle({ type: "suspend" });
    const resume = () => dispatchMotionLifecycle({ type: "resume" });
    const updateVisibility = () => {
      if (document.hidden) {
        suspend();
      } else {
        resume();
      }
    };
    const invalidateViewport = () =>
      dispatchMotionLifecycle({ type: "viewport-change" });

    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", updateVisibility);
    window.addEventListener("orientationchange", invalidateViewport);
    updateVisibility();

    return () => {
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", updateVisibility);
      window.removeEventListener("orientationchange", invalidateViewport);
    };
  }, []);

  return (
    <AppMotionLifecycleContext.Provider value={motionLifecycle}>
      <AppMotionPolicyContext.Provider value={motionPolicy}>
        <LazyMotion features={domMax} strict>
          <MotionConfig reducedMotion={motionPolicy === "reduced" ? "always" : "never"}>
            <LayoutGroup id="ai-reader-app">{children}</LayoutGroup>
          </MotionConfig>
        </LazyMotion>
      </AppMotionPolicyContext.Provider>
    </AppMotionLifecycleContext.Provider>
  );
}
