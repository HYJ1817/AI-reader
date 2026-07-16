"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import type { AnnotationRecord } from "@/lib/db";
import {
  flattenEpubNavigation,
  type EpubTocItem,
} from "@/lib/epubNavigation";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";
import {
  formatReaderPageSummary,
  type ReaderPageInfo,
} from "@/lib/readerPageInfo";
import {
  READER_TOC_TABS,
  getNearestReaderTocTabIndex,
  getReaderTocTabScrollLeft,
  type ReaderTocTab,
} from "@/lib/readerTocTabs";
import { MOTION_SPRING } from "@/lib/motionSystem";
import { useAppReducedMotion } from "./AppMotionRoot";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  items: EpubTocItem[];
  bookmarks: AnnotationRecord[];
  highlights: AnnotationRecord[];
  currentPageBookmarked: boolean;
  bookTitle: string | null;
  pageInfo: ReaderPageInfo;
  onSelect: (href: string) => void;
  onToggleBookmark: () => void;
  onSelectAnnotation: (annotation: AnnotationRecord) => void;
  onDeleteAnnotation: (id: string) => void;
  onClose: () => void;
};

const TOC_RENDER_BATCH = 60;

function formatAnnotationMeta(record: AnnotationRecord): string {
  const location = record.pageNumber
    ? `第 ${record.pageNumber} 页`
    : typeof record.progressPercent === "number"
      ? `已读 ${Math.round(record.progressPercent)}%`
      : record.locator
        ? "已保存位置"
        : "无法定位原文";
  const date = new Date(record.createdAt);
  return Number.isNaN(date.getTime())
    ? location
    : `${location} · ${date.toLocaleDateString("zh-CN", {
        month: "numeric",
        day: "numeric",
      })}`;
}

function TrashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TocDrawer({
  items,
  bookmarks,
  highlights,
  currentPageBookmarked,
  bookTitle,
  pageInfo,
  onSelect,
  onToggleBookmark,
  onSelectAnnotation,
  onDeleteAnnotation,
  onClose,
}: Props) {
  const reduceMotion = useAppReducedMotion();
  const flatItems = flattenEpubNavigation(items);
  const [activeTab, setActiveTab] =
    useState<"chapters" | "bookmarks" | "highlights">("chapters");
  const [visibleCount, setVisibleCount] = useState(() =>
    getInitialVisibleItemCount(flatItems.length, TOC_RENDER_BATCH)
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const chapterScrollRootRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const activeTabRef = useRef<ReaderTocTab>("chapters");
  const programmaticTabRef = useRef<ReaderTocTab | null>(null);
  const visibleItems = flatItems.slice(0, visibleCount);

  const updateActiveTab = useCallback((tab: ReaderTocTab) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
  }, []);

  const selectTab = useCallback(
    (tab: ReaderTocTab) => {
      const viewport = viewportRef.current;
      programmaticTabRef.current = tab;
      updateActiveTab(tab);
      if (!viewport) return;
      viewport.scrollTo({
        left: getReaderTocTabScrollLeft(
          READER_TOC_TABS.indexOf(tab),
          viewport.clientWidth
        ),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [reduceMotion, updateActiveTab]
  );

  const handleViewportScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const index = getNearestReaderTocTabIndex(
        viewport.scrollLeft,
        viewport.clientWidth
      );
      const nearestTab = READER_TOC_TABS[index];
      const targetTab = programmaticTabRef.current;
      if (targetTab && nearestTab !== targetTab) return;
      programmaticTabRef.current = null;
      if (nearestTab !== activeTabRef.current) updateActiveTab(nearestTab);
    });
  }, [updateActiveTab]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const resnap = () => {
      viewport.scrollTo({
        left: getReaderTocTabScrollLeft(
          READER_TOC_TABS.indexOf(activeTabRef.current),
          viewport.clientWidth
        ),
        behavior: "auto",
      });
    };
    const observer = new ResizeObserver(resnap);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab !== "chapters" || visibleCount >= flatItems.length) return;
    const target = loadSentinelRef.current;
    if (!target) return;
    const Observer = (
      window as Window & { IntersectionObserver?: typeof IntersectionObserver }
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
          getNextVisibleItemCount(current, flatItems.length, TOC_RENDER_BATCH)
        );
      },
      { root: chapterScrollRootRef.current, rootMargin: "320px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, flatItems.length, visibleCount]);

  const tabMeta: Record<
    ReaderTocTab,
    { label: string; count?: number }
  > = {
    chapters: { label: "章节" },
    bookmarks: { label: "书签", count: bookmarks.length },
    highlights: { label: "高亮标记", count: highlights.length },
  };
  const tabs = READER_TOC_TABS.map((id) => ({ id, ...tabMeta[id] }));

  const renderAnnotations = (
    records: AnnotationRecord[],
    emptyText: string,
    close: (afterClose?: () => void) => void
  ) =>
    records.length === 0 ? (
      <p className={styles.tocEmptyText}>{emptyText}</p>
    ) : (
      <ul className={styles.annotationList}>
        {records.map((record) => (
          <li
            key={record.id}
            className={styles.annotationRow}
            data-annotation-id={record.id}
            data-annotation-kind={record.kind}
          >
            <button
              className={styles.annotationJumpButton}
              data-annotation-jump="true"
              disabled={!record.locator}
              onClick={() => close(() => onSelectAnnotation(record))}
            >
              <span className={styles.annotationExcerptLine}>
                {record.kind === "highlight" && (
                  <span
                    className={styles.annotationColorMarker}
                    data-highlight-color={record.color ?? "yellow"}
                    aria-hidden="true"
                  />
                )}
                <span className={styles.annotationExcerpt}>
                  {record.text || "书签位置"}
                </span>
              </span>
              <span className={styles.annotationMeta}>
                {formatAnnotationMeta(record)}
              </span>
            </button>
            <button
              className={styles.annotationDeleteButton}
              data-annotation-delete="true"
              onClick={() => onDeleteAnnotation(record.id)}
              aria-label={`删除${record.kind === "bookmark" ? "书签" : "高亮"}`}
            >
              <TrashIcon />
            </button>
          </li>
        ))}
      </ul>
    );

  const renderPanel = (
    tab: ReaderTocTab,
    close: (afterClose?: () => void) => void
  ) => {
    if (tab === "chapters") {
      return items.length === 0 ? (
        <p className={styles.tocEmptyText}>这本书没有目录信息</p>
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
      );
    }

    if (tab === "bookmarks") {
      return (
        <>
          <button
            className={styles.annotationCurrentButton}
            onClick={onToggleBookmark}
          >
            {currentPageBookmarked ? "移除当前页书签" : "添加当前页书签"}
          </button>
          {renderAnnotations(
            bookmarks,
            "还没有书签，在阅读菜单中添加当前位置",
            close
          )}
        </>
      );
    }

    return renderAnnotations(
      highlights,
      "还没有高亮，长按正文选择文字",
      close
    );
  };

  return (
    <BottomSheet onClose={onClose} className={styles.tocSheet} ariaLabel="目录与标记">
      {(close) => (
        <>
          <div className={styles.tocHeader}>
            <div className={styles.tocHeaderText}>
              <h2 className={styles.tocHeaderTitle}>{bookTitle || "目录与标记"}</h2>
              <p>{formatReaderPageSummary(pageInfo)}</p>
            </div>
            <button className={styles.tocDoneButton} onClick={() => close()} title="关闭" aria-label="关闭">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M7 14l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className={styles.tocTabs} role="tablist" aria-label="目录视图">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`toc-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={activeTab === tab.id}
                aria-controls={`toc-panel-${tab.id}`}
                className={activeTab === tab.id ? styles.tocTabActive : undefined}
                onClick={() => selectTab(tab.id)}
              >
                {activeTab === tab.id &&
                  (reduceMotion ? (
                    <span
                      className={styles.tocTabIndicator}
                      aria-hidden="true"
                    />
                  ) : (
                    <m.span
                      layoutId="toc-active-tab-indicator"
                      className={styles.tocTabIndicator}
                      transition={MOTION_SPRING.navigation}
                      aria-hidden="true"
                    />
                  ))}
                <span className={styles.tocTabLabel}>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0
                    ? ` ${tab.count}`
                    : ""}
                </span>
              </button>
            ))}
          </div>
          <div
            ref={viewportRef}
            className={styles.tocSwipeViewport}
            data-sheet-horizontal-gesture="true"
            data-toc-swipe-viewport="true"
            onPointerDown={() => {
              programmaticTabRef.current = null;
            }}
            onScroll={handleViewportScroll}
          >
            {tabs.map((tab) => (
              <section
                key={tab.id}
                id={`toc-panel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`toc-tab-${tab.id}`}
                aria-hidden={activeTab !== tab.id}
                {...(activeTab !== tab.id ? { inert: true } : {})}
                className={styles.tocSwipePanel}
              >
                <div
                  ref={tab.id === "chapters" ? chapterScrollRootRef : undefined}
                  className={styles.tocPanelScroller}
                >
                  {renderPanel(tab.id, close)}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
