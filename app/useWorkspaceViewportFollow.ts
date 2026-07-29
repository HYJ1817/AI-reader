"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";
import { animate, type AnimationPlaybackControls } from "motion/react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motionSystem";
import {
  getAnchoredPrependScrollTop,
  isWorkspaceNearBottom,
  shouldFollowWorkspaceViewport,
} from "@/lib/workspaceViewportFollow";

export type WorkspaceViewportFollow = {
  threadRef: RefObject<HTMLDivElement | null>;
  showReturnToBottom: boolean;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onUserInteractionStart: () => void;
  preservePrependAnchor: (load: () => Promise<void> | void) => Promise<void>;
  returnToBottom: () => void;
};

type UseWorkspaceViewportFollowOptions = {
  contentRevision: string;
  visible: boolean;
};

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function isThreadActuallyVisible(thread: HTMLDivElement): boolean {
  return !thread.closest(
    '[data-sheet-page-active="false"], [aria-hidden="true"], [inert]'
  );
}

export default function useWorkspaceViewportFollow({
  contentRevision,
  visible,
}: UseWorkspaceViewportFollowOptions): WorkspaceViewportFollow {
  const threadRef = useRef<HTMLDivElement>(null);
  const activeAnimationRef = useRef<AnimationPlaybackControls | null>(null);
  const nearBottomRef = useRef(true);
  const userInteractingRef = useRef(false);
  const preservingPrependRef = useRef(false);
  const interactionReleaseTimerRef = useRef<number | null>(null);
  const [showReturnToBottom, setShowReturnToBottom] = useState(false);

  const stopActiveAnimation = useCallback(() => {
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
  }, []);

  const animateToBottom = useCallback(() => {
    const thread = threadRef.current;
    if (!thread || !visible || !isThreadActuallyVisible(thread)) return;

    stopActiveAnimation();
    const target = Math.max(0, thread.scrollHeight - thread.clientHeight);
    if (Math.abs(target - thread.scrollTop) <= 1) {
      thread.scrollTop = target;
      nearBottomRef.current = true;
      return;
    }

    const controls = animate(thread.scrollTop, target, {
      duration: MOTION_DURATION.pushExit,
      ease: MOTION_EASE.enter,
      onUpdate: (value) => {
        if (threadRef.current === thread) thread.scrollTop = value;
      },
    });
    activeAnimationRef.current = controls;
    void controls.then(() => {
      if (activeAnimationRef.current !== controls) return;
      activeAnimationRef.current = null;
      nearBottomRef.current = true;
    });
  }, [stopActiveAnimation, visible]);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || !visible || !isThreadActuallyVisible(thread)) {
      stopActiveAnimation();
      return;
    }
    if (
      !preservingPrependRef.current &&
      shouldFollowWorkspaceViewport({
        nearBottom: nearBottomRef.current,
        userInteracting: userInteractingRef.current,
        visible,
      })
    ) {
      animateToBottom();
    }
  }, [animateToBottom, contentRevision, stopActiveAnimation, visible]);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    const sheetPage = thread?.closest<HTMLElement>("[data-sheet-page]");
    if (!thread || !sheetPage) return;

    const handleVisibilityChange = () => {
      if (!visible || !isThreadActuallyVisible(thread)) {
        stopActiveAnimation();
        return;
      }
      if (
        !preservingPrependRef.current &&
        shouldFollowWorkspaceViewport({
          nearBottom: nearBottomRef.current,
          userInteracting: userInteractingRef.current,
          visible: true,
        })
      ) {
        animateToBottom();
      }
    };
    const observer = new MutationObserver(handleVisibilityChange);
    observer.observe(sheetPage, {
      attributes: true,
      attributeFilter: ["data-sheet-page-active", "aria-hidden", "inert"],
    });
    return () => observer.disconnect();
  }, [animateToBottom, stopActiveAnimation, visible]);

  useEffect(
    () => () => {
      stopActiveAnimation();
      if (interactionReleaseTimerRef.current !== null) {
        window.clearTimeout(interactionReleaseTimerRef.current);
      }
    },
    [stopActiveAnimation]
  );

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const thread = event.currentTarget;
    const nearBottom = isWorkspaceNearBottom(
      thread.scrollHeight,
      thread.clientHeight,
      thread.scrollTop
    );

    if (activeAnimationRef.current) {
      if (nearBottom) nearBottomRef.current = true;
      return;
    }

    nearBottomRef.current = nearBottom;
    userInteractingRef.current = !nearBottom;
    setShowReturnToBottom(!nearBottom);
  }, []);

  const onUserInteractionStart = useCallback(() => {
    stopActiveAnimation();
    userInteractingRef.current = true;
    if (interactionReleaseTimerRef.current !== null) {
      window.clearTimeout(interactionReleaseTimerRef.current);
    }
    interactionReleaseTimerRef.current = window.setTimeout(() => {
      interactionReleaseTimerRef.current = null;
      const thread = threadRef.current;
      if (
        thread &&
        isWorkspaceNearBottom(
          thread.scrollHeight,
          thread.clientHeight,
          thread.scrollTop
        )
      ) {
        nearBottomRef.current = true;
        userInteractingRef.current = false;
      }
    }, 120);
  }, [stopActiveAnimation]);

  const preservePrependAnchor = useCallback(
    async (load: () => Promise<void> | void) => {
      const thread = threadRef.current;
      if (!thread) return;
      stopActiveAnimation();
      preservingPrependRef.current = true;
      const previousScrollHeight = thread.scrollHeight;
      const previousScrollTop = thread.scrollTop;
      try {
        await load();
        await nextAnimationFrame();
        if (threadRef.current !== thread) return;
        thread.scrollTop = getAnchoredPrependScrollTop(
          previousScrollTop,
          previousScrollHeight,
          thread.scrollHeight
        );
        const nearBottom = isWorkspaceNearBottom(
          thread.scrollHeight,
          thread.clientHeight,
          thread.scrollTop
        );
        nearBottomRef.current = nearBottom;
        userInteractingRef.current = !nearBottom;
        setShowReturnToBottom(!nearBottom);
      } finally {
        preservingPrependRef.current = false;
      }
    },
    [stopActiveAnimation]
  );

  const returnToBottom = useCallback(() => {
    userInteractingRef.current = false;
    nearBottomRef.current = true;
    setShowReturnToBottom(false);
    animateToBottom();
  }, [animateToBottom]);

  return {
    threadRef,
    showReturnToBottom,
    onScroll,
    onUserInteractionStart,
    preservePrependAnchor,
    returnToBottom,
  };
}
