"use client";

import { useEffect, useRef, useState } from "react";
import {
  flattenEpubNavigation,
  type EpubTocItem,
} from "@/lib/epubNavigation";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  items: EpubTocItem[];
  onSelect: (href: string) => void;
  onClose: () => void;
};

const TOC_RENDER_BATCH = 60;

export default function TocDrawer({ items, onSelect, onClose }: Props) {
  const flatItems = flattenEpubNavigation(items);
  const [visibleCount, setVisibleCount] = useState(() =>
    getInitialVisibleItemCount(flatItems.length, TOC_RENDER_BATCH)
  );
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const visibleItems = flatItems.slice(0, visibleCount);

  useEffect(() => {
    if (visibleCount >= flatItems.length) return;
    const target = loadSentinelRef.current;
    if (!target) return;
    const Observer = (
      window as Window & {
        IntersectionObserver?: typeof IntersectionObserver;
      }
    ).IntersectionObserver;
    if (!Observer) {
      const frame = window.requestAnimationFrame(() =>
        setVisibleCount(flatItems.length)
      );
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new Observer(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setVisibleCount((current) =>
          getNextVisibleItemCount(
            current,
            flatItems.length,
            TOC_RENDER_BATCH
          )
        );
      },
      {
        root: scrollRootRef.current,
        rootMargin: "320px 0px",
      }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [flatItems.length, visibleCount]);

  return (
    <BottomSheet onClose={onClose} className={styles.tocSheet} ariaLabel="目录">
      {(close) => (
        <>
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>目录</h2>
          <button className={styles.iconButton} onClick={() => close()} title="关闭" aria-label="关闭">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div ref={scrollRootRef} className={styles.sheetBody}>
          {items.length === 0 ? (
            <p className={styles.tocEmptyText}>暂无目录信息</p>
          ) : (
            <div className={styles.tocGroupList}>
              <ul className={styles.tocList}>
                {visibleItems.map((item) => (
                  <li key={item.id} className={styles.tocRow}>
                    <button
                      className={styles.tocRowButton}
                      style={{ paddingLeft: 12 + item.depth * 20 }}
                      onClick={() =>
                        close(() => onSelect(item.href))
                      }
                    >
                      <span className={styles.tocRowLabel}>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {visibleCount < flatItems.length && (
                <div
                  ref={loadSentinelRef}
                  className={styles.tocLoadSentinel}
                  aria-hidden="true"
                />
              )}
            </div>
          )}
        </div>
        </>
      )}
    </BottomSheet>
  );
}
