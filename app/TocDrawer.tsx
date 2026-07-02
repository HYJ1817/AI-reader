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
import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  items: EpubTocItem[];
  bookTitle: string | null;
  pageInfo: ReaderPageInfo;
  onSelect: (href: string) => void;
  onClose: () => void;
};

const TOC_RENDER_BATCH = 60;

export default function TocDrawer({
  items,
  bookTitle,
  pageInfo,
  onSelect,
  onClose,
}: Props) {
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
          <div className={styles.tocHeader}>
            <div className={styles.tocHeaderText}>
              <h2 className={styles.tocHeaderTitle}>
                {bookTitle || "目录"}
              </h2>
              <p>
                第 {pageInfo.current} 页（共 {pageInfo.total} 页）
              </p>
            </div>
            <button
              className={styles.tocDoneButton}
              onClick={() => close()}
              title="关闭"
              aria-label="关闭"
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M7 14l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className={styles.tocTabs} role="tablist" aria-label="目录视图">
            <button className={styles.tocTabActive} type="button">
              章节
            </button>
            <button type="button">书签</button>
            <button type="button">高亮标记</button>
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
                        onClick={() => close(() => onSelect(item.href))}
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
