"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NavigationTab } from "@/lib/navigationMotion";

type ActivateTab = (tab: NavigationTab) => void;

export default function useReaderPresentation(activateTab: ActivateTab) {
  const [readerPresented, setReaderPresented] = useState(false);
  const frameRef = useRef<number | null>(null);

  const cancelPendingPresentation = useCallback(() => {
    if (frameRef.current === null) return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const dismissReader = useCallback(
    (targetTab?: NavigationTab) => {
      cancelPendingPresentation();
      setReaderPresented(false);
      if (targetTab) activateTab(targetTab);
    },
    [activateTab, cancelPendingPresentation]
  );

  const presentReader = useCallback(() => {
    dismissReader();
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        activateTab("reading");
        setReaderPresented(true);
      });
    });
  }, [activateTab, dismissReader]);

  useEffect(
    () => () => cancelPendingPresentation(),
    [cancelPendingPresentation]
  );

  return { dismissReader, presentReader, readerPresented };
}
