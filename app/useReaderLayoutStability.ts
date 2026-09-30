import { useCallback, useMemo, useRef } from "react";
import { preserveScrollProgressOnContentResize } from "@/lib/readerLayoutStability";

export default function useReaderLayoutStability() {
  const progress = useRef(0);
  const restoring = useRef(false);
  const stopObserver = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    restoring.current = false;
    stopObserver.current?.();
    stopObserver.current = null;
  }, []);

  const setProgress = useCallback((value: number) => {
    progress.current = value;
  }, []);

  const getProgress = useCallback(() => progress.current, []);

  const isRestoring = useCallback(() => restoring.current, []);

  const restore = useCallback((value: number, reader: HTMLElement, mode: "scroll" | "paged") => {
    progress.current = value;
    restoring.current = value > 0;
    if (mode === "scroll" && typeof ResizeObserver !== "undefined") {
      stopObserver.current = preserveScrollProgressOnContentResize(
        reader,
        () => progress.current
      );
    }
  }, []);

  return useMemo(
    () => ({ getProgress, isRestoring, restore, setProgress, stop }),
    [getProgress, isRestoring, restore, setProgress, stop]
  );
}
