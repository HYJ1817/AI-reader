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
  getWorkspaceManualScrollOwnership,
  isWorkspaceNearBottom,
  shouldRestoreWorkspacePrependAnchor,
  shouldFollowWorkspaceViewport,
} from "@/lib/workspaceViewportFollow";

export type WorkspaceViewportFollow = {
  threadRef: RefObject<HTMLDivElement | null>;
  showReturnToBottom: boolean;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onUserInteractionStart: () => void;
  onUserInteractionEnd: () => void;
  onUserInteractionCancel: () => void;
  onWheel: () => void;
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

function findVisiblePrependAnchor(thread: HTMLDivElement): HTMLElement | null {
  const viewport = thread.getBoundingClientRect();
  const isVisible = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom >= viewport.top && rect.top <= viewport.bottom;
  };
  const messages = Array.from(
    thread.querySelectorAll<HTMLElement>("[data-workspace-message-id]")
  );
  return (
    messages.find(isVisible) ??
    thread.querySelector<HTMLElement>("[data-workspace-prepend-anchor]") ??
    messages[0] ??
    null
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
  const gestureActiveRef = useRef(false);
  const interactionGenerationRef = useRef(0);
  const manualAwayRef = useRef(false);
  const ownedScrollTopRef = useRef<number | null>(null);
  const preservingPrependRef = useRef(false);
  const wheelReleaseTimerRef = useRef<number | null>(null);
  const returnLayoutFrameRef = useRef<number | null>(null);
  const expectedAnimatedScrollTopRef = useRef<number | null>(null);
  const [showReturnToBottom, setShowReturnToBottom] = useState(false);

  const stopActiveAnimation = useCallback(() => {
    activeAnimationRef.current?.stop();
    activeAnimationRef.current = null;
    expectedAnimatedScrollTopRef.current = null;
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
        if (threadRef.current === thread) {
          expectedAnimatedScrollTopRef.current = value;
          thread.scrollTop = value;
        }
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
    if (manualAwayRef.current && ownedScrollTopRef.current !== null) {
      thread.scrollTop = Math.min(
        ownedScrollTopRef.current,
        Math.max(0, thread.scrollHeight - thread.clientHeight)
      );
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
      if (wheelReleaseTimerRef.current !== null) {
        window.clearTimeout(wheelReleaseTimerRef.current);
      }
      if (returnLayoutFrameRef.current !== null) {
        window.cancelAnimationFrame(returnLayoutFrameRef.current);
      }
    },
    [stopActiveAnimation]
  );

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const thread = event.currentTarget;
    const ownership = getWorkspaceManualScrollOwnership({
      scrollHeight: thread.scrollHeight,
      clientHeight: thread.clientHeight,
      scrollTop: thread.scrollTop,
    });

    if (gestureActiveRef.current) {
      manualAwayRef.current = ownership.manualAway;
      nearBottomRef.current = ownership.nearBottom;
      ownedScrollTopRef.current = ownership.ownedScrollTop;
      setShowReturnToBottom(ownership.manualAway);
      return;
    }

    if (activeAnimationRef.current) {
      const expectedScrollTop = expectedAnimatedScrollTopRef.current;
      if (
        expectedScrollTop !== null &&
        Math.abs(thread.scrollTop - expectedScrollTop) <= 1
      ) {
        if (ownership.nearBottom) nearBottomRef.current = true;
        return;
      }
      activeAnimationRef.current.stop();
      activeAnimationRef.current = null;
      expectedAnimatedScrollTopRef.current = null;
      manualAwayRef.current = ownership.manualAway;
      ownedScrollTopRef.current = ownership.ownedScrollTop;
    }

    if (manualAwayRef.current) {
      manualAwayRef.current = ownership.manualAway;
      ownedScrollTopRef.current = ownership.ownedScrollTop;
      nearBottomRef.current = ownership.nearBottom;
      userInteractingRef.current = ownership.manualAway;
      setShowReturnToBottom(ownership.manualAway);
      if (ownership.nearBottom) {
        gestureActiveRef.current = false;
      }
      return;
    }

    manualAwayRef.current = ownership.manualAway;
    ownedScrollTopRef.current = ownership.ownedScrollTop;
    nearBottomRef.current = ownership.nearBottom;
    userInteractingRef.current = ownership.manualAway;
    setShowReturnToBottom(ownership.manualAway);
  }, []);

  const onUserInteractionStart = useCallback(() => {
    stopActiveAnimation();
    gestureActiveRef.current = true;
    interactionGenerationRef.current += 1;
    userInteractingRef.current = true;
    if (returnLayoutFrameRef.current !== null) {
      window.cancelAnimationFrame(returnLayoutFrameRef.current);
      returnLayoutFrameRef.current = null;
    }
    if (wheelReleaseTimerRef.current !== null) {
      window.clearTimeout(wheelReleaseTimerRef.current);
      wheelReleaseTimerRef.current = null;
    }
  }, [stopActiveAnimation]);

  const onUserInteractionEnd = useCallback(() => {
    gestureActiveRef.current = false;
    const thread = threadRef.current;
    if (!thread) return;
    const ownership = getWorkspaceManualScrollOwnership({
      scrollHeight: thread.scrollHeight,
      clientHeight: thread.clientHeight,
      scrollTop: thread.scrollTop,
    });
    if (ownership.nearBottom && !manualAwayRef.current) {
      nearBottomRef.current = true;
      userInteractingRef.current = false;
      setShowReturnToBottom(false);
      return;
    }
    manualAwayRef.current = true;
    ownedScrollTopRef.current = thread.scrollTop;
    nearBottomRef.current = false;
    userInteractingRef.current = true;
    setShowReturnToBottom(true);
  }, []);

  const onUserInteractionCancel = useCallback(() => {
    gestureActiveRef.current = false;
    const thread = threadRef.current;
    if (!thread) return;
    const ownership = getWorkspaceManualScrollOwnership({
      scrollHeight: thread.scrollHeight,
      clientHeight: thread.clientHeight,
      scrollTop: thread.scrollTop,
    });
    manualAwayRef.current = ownership.manualAway;
    ownedScrollTopRef.current = ownership.ownedScrollTop;
    nearBottomRef.current = ownership.nearBottom;
    userInteractingRef.current = ownership.manualAway;
    setShowReturnToBottom(ownership.manualAway);
  }, []);

  const onWheel = useCallback(() => {
    onUserInteractionStart();
    wheelReleaseTimerRef.current = window.setTimeout(() => {
      wheelReleaseTimerRef.current = null;
      onUserInteractionEnd();
    }, 120);
  }, [onUserInteractionEnd, onUserInteractionStart]);

  const preservePrependAnchor = useCallback(
    async (load: () => Promise<void> | void) => {
      const thread = threadRef.current;
      if (!thread) return;
      stopActiveAnimation();
      preservingPrependRef.current = true;
      const interactionGeneration = interactionGenerationRef.current;
      const anchor = findVisiblePrependAnchor(thread);
      const previousAnchorTop = anchor?.getBoundingClientRect().top ?? null;
      try {
        await load();
        await nextAnimationFrame();
        if (threadRef.current !== thread) return;
        if (
          shouldRestoreWorkspacePrependAnchor(
            interactionGeneration,
            interactionGenerationRef.current
          ) &&
          anchor?.isConnected &&
          previousAnchorTop !== null
        ) {
          thread.scrollTop = getAnchoredPrependScrollTop({
            currentScrollTop: thread.scrollTop,
            previousAnchorTop,
            nextAnchorTop: anchor.getBoundingClientRect().top,
          });
        }
        const nearBottom = isWorkspaceNearBottom(
          thread.scrollHeight,
          thread.clientHeight,
          thread.scrollTop
        );
        manualAwayRef.current = !nearBottom;
        ownedScrollTopRef.current = nearBottom ? null : thread.scrollTop;
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
    stopActiveAnimation();
    gestureActiveRef.current = false;
    manualAwayRef.current = false;
    ownedScrollTopRef.current = null;
    userInteractingRef.current = false;
    nearBottomRef.current = true;
    setShowReturnToBottom(false);
    if (returnLayoutFrameRef.current !== null) {
      window.cancelAnimationFrame(returnLayoutFrameRef.current);
    }
    returnLayoutFrameRef.current = window.requestAnimationFrame(() => {
      returnLayoutFrameRef.current = null;
      animateToBottom();
    });
  }, [animateToBottom, stopActiveAnimation]);

  return {
    threadRef,
    showReturnToBottom,
    onScroll,
    onUserInteractionStart,
    onUserInteractionEnd,
    onUserInteractionCancel,
    onWheel,
    preservePrependAnchor,
    returnToBottom,
  };
}
