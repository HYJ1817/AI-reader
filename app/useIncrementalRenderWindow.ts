"use client";

import { useEffect, useRef, useState } from "react";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";

type IncrementalRenderWindowOptions = {
  active: boolean;
  batchSize: number;
  renderKey: string;
  totalCount: number;
};

export default function useIncrementalRenderWindow({
  active,
  batchSize,
  renderKey,
  totalCount,
}: IncrementalRenderWindowOptions) {
  const [renderWindow, setRenderWindow] = useState({
    key: "",
    count: batchSize,
  });
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const visibleCount = Math.min(
    totalCount,
    renderWindow.key === renderKey
      ? renderWindow.count
      : getInitialVisibleItemCount(totalCount, batchSize)
  );

  useEffect(() => {
    if (!active || visibleCount >= totalCount) return;
    const target = loadSentinelRef.current;
    if (!target) return;
    const Observer = window.IntersectionObserver;
    if (!Observer) {
      const frame = window.requestAnimationFrame(() => {
        setRenderWindow({ key: renderKey, count: totalCount });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new Observer(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setRenderWindow({
          key: renderKey,
          count: getNextVisibleItemCount(visibleCount, totalCount, batchSize),
        });
      },
      { rootMargin: "480px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [active, batchSize, renderKey, totalCount, visibleCount]);

  return { loadSentinelRef, visibleCount };
}
