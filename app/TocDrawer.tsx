"use client";

import { AnimatePresence, m } from "motion/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { AnnotationRecord } from "@/lib/db";
import {
  flattenEpubNavigation,
  type EpubTocItem,
  type FlatEpubTocItem,
} from "@/lib/epubNavigation";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";
import {
  formatReaderPageSummary,
  type ReaderPageInfo,
} from "@/lib/readerPageInfo";
import { getRoleTransition } from "@/lib/motionSystem";
import {
  READER_TOC_TABS,
  getNearestReaderTocTabIndex,
  getReaderTocTabScrollLeft,
  type ReaderTocTab,
} from "@/lib/readerTocTabs";
import { useAppReducedMotion } from "./AppMotionRoot";
import BottomSheet, { type CloseSheet } from "./BottomSheet";
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

export type TocPageProps = Omit<Props, "onClose"> & {
  close: CloseSheet;
};

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

const ChapterContents = memo(function ChapterContents({
  itemsExist,
  visibleItems,
  visibleCount,
  totalCount,
  loadSentinelRef,
  close,
  onSelect,
}: {
  itemsExist: boolean;
  visibleItems: FlatEpubTocItem[];
  visibleCount: number;
  totalCount: number;
  loadSentinelRef: RefObject<HTMLDivElement | null>;
  close: CloseSheet;
  onSelect: (href: string) => void;
}) {
  if (!itemsExist) {
    return <p className={styles.tocEmptyText}>这本书没有目录信息</p>;
  }

  return (
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
      {visibleCount < totalCount && (
        <div
          ref={loadSentinelRef}
          className={styles.tocLoadSentinel}
          aria-hidden="true"
        />
      )}
    </div>
  );
});

export default function TocDrawer({ onClose, ...pageProps }: Props) {
  return (
    <BottomSheet
      onClose={onClose}
      className={styles.tocSheet}
      ariaLabel="目录与标记"
    >
      {(close) => <TocPage {...pageProps} close={close} />}
    </BottomSheet>
  );
}

export function TocPage({
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
  close,
}: TocPageProps) {
  const reduceMotion = useAppReducedMotion();
  const flatItems = useMemo(() => flattenEpubNavigation(items), [items]);
  const [activeTab, setActiveTab] =
    useState<"chapters" | "bookmarks" | "highlights">("chapters");
  const [visibleCount, setVisibleCount] = useState(() =>
    getInitialVisibleItemCount(flatItems.length, TOC_RENDER_BATCH)
  );
  const viewportRef = useRef<HTMLDivElement>(null);
  const chapterScrollRootRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const tabScrollFrameRef = useRef<number | null>(null);
  const viewportWidthRef = useRef(0);
  const activeTabRef = useRef<ReaderTocTab>("chapters");
  const programmaticTabRef = useRef<ReaderTocTab | null>(null);
  const visibleItems = useMemo(
    () => flatItems.slice(0, visibleCount),
    [flatItems, visibleCount]
  );

  const updateActiveTab = useCallback((tab: ReaderTocTab) => {
    const previousTab = activeTabRef.current;
    if (previousTab === tab) return;
    activeTabRef.current = tab;
    setActiveTab(tab);
  }, []);

  const releaseProgrammaticTab = useCallback(() => {
    programmaticTabRef.current = null;
  }, []);

  const selectTab = useCallback(
    (tab: ReaderTocTab) => {
      const viewport = viewportRef.current;
      programmaticTabRef.current = tab;
      updateActiveTab(tab);
      if (!viewport) return;
      if (tabScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(tabScrollFrameRef.current);
      }
      tabScrollFrameRef.current = window.requestAnimationFrame(() => {
        tabScrollFrameRef.current = null;
        const currentViewport = viewportRef.current;
        if (!currentViewport) return;
        const viewportWidth =
          viewportWidthRef.current || currentViewport.clientWidth;
        currentViewport.scrollTo({
          left: getReaderTocTabScrollLeft(
            READER_TOC_TABS.indexOf(tab),
            viewportWidth
          ),
          behavior: "auto",
        });
      });
    },
    [updateActiveTab]
  );

  const handleViewportScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const index = getNearestReaderTocTabIndex(
        viewport.scrollLeft,
        viewportWidthRef.current || viewport.clientWidth
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

    viewportWidthRef.current = viewport.clientWidth;
    const resnap = (width: number) => {
      viewportWidthRef.current = width;
      viewport.scrollTo({
        left: getReaderTocTabScrollLeft(
          READER_TOC_TABS.indexOf(activeTabRef.current),
          width
        ),
        behavior: "auto",
      });
    };
    const observer = new ResizeObserver(([entry]) =>
      resnap(entry?.contentRect.width || viewport.clientWidth)
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (tabScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(tabScrollFrameRef.current);
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
        const scrollRoot = chapterScrollRootRef.current;
        if (!scrollRoot || scrollRoot.scrollHeight <= scrollRoot.clientHeight + 1) {
          return;
        }
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
      <m.ul className={styles.annotationList}>
        <AnimatePresence initial={false} mode="popLayout">
        {records.map((record) => (
          <m.li
            key={record.id}
            layout={reduceMotion ? false : "position"}
            className={styles.annotationRow}
            data-annotation-id={record.id}
            data-annotation-kind={record.kind}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: reduceMotion ? 0 : 6,
              transition: getRoleTransition("state-exit", reduceMotion),
            }}
            transition={getRoleTransition("state-enter", reduceMotion)}
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
          </m.li>
        ))}
        </AnimatePresence>
      </m.ul>
    );

  const renderPanel = (
    tab: ReaderTocTab,
    close: (afterClose?: () => void) => void
  ) => {
    if (tab === "chapters") {
      return (
        <ChapterContents
          itemsExist={items.length > 0}
          visibleItems={visibleItems}
          visibleCount={visibleCount}
          totalCount={flatItems.length}
          loadSentinelRef={loadSentinelRef}
          close={close}
          onSelect={onSelect}
        />
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
    <div className={styles.tocPage}>
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
          <div
            className={styles.tocTabs}
            role="tablist"
            aria-label="目录视图"
            data-active-tab={activeTab}
          >
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
            onPointerDown={releaseProgrammaticTab}
            onTouchStart={releaseProgrammaticTab}
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
                  data-toc-panel-scroller="true"
                  data-motion-role="inline-state"
                >
                  {renderPanel(tab.id, close)}
                </div>
              </section>
            ))}
          </div>
    </div>
  );
}
