"use client";

import { domMax, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createMotionLifecycleState,
  reduceMotionLifecycle,
  subscribeMotionLifecycle,
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

function MotionLifecycleProvider({ children }: { children: ReactNode }) {
  const [motionLifecycle, dispatchMotionLifecycle] = useReducer(
    reduceMotionLifecycle,
    createMotionLifecycleState()
  );
  const lifecycleRef = useRef(motionLifecycle);

  useLayoutEffect(() => {
    lifecycleRef.current = motionLifecycle;
  }, [motionLifecycle]);

  useEffect(
    () =>
      subscribeMotionLifecycle({
        windowTarget: window,
        documentTarget: document,
        dispatch(event) {
          lifecycleRef.current = reduceMotionLifecycle(lifecycleRef.current, event);
          dispatchMotionLifecycle(event);
        },
        getSuspended: () => lifecycleRef.current.suspended,
      }),
    []
  );

  return (
    <AppMotionLifecycleContext.Provider value={motionLifecycle}>
      {children}
    </AppMotionLifecycleContext.Provider>
  );
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
          <LayoutGroup id="ai-reader-app">
            <MotionLifecycleProvider>{children}</MotionLifecycleProvider>
          </LayoutGroup>
        </MotionConfig>
      </LazyMotion>
    </AppMotionPolicyContext.Provider>
  );
}
