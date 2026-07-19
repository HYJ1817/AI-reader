"use client";

import { AnimatePresence, m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import {
  getNavigationTabIndex,
  type NavigationTab,
} from "@/lib/navigationMotion";
import { MOTION_DURATION, ROOT_TAB_TRANSITION } from "@/lib/motionSystem";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

type AppNavigationProps = {
  activeTab: NavigationTab;
  showBottomTabs: boolean;
  showLibraryBatchBar: boolean;
  allVisibleSelected: boolean;
  selectedCountLabel: string;
  hasSelection: boolean;
  onOpenLibrary: () => void;
  onOpenReading: () => void;
  onOpenSettings: () => void;
  onToggleSelectAll: () => void;
  onOpenBatchGroup: () => void;
  onOpenBatchDelete: () => void;
};

export default function AppNavigation({
  activeTab,
  showBottomTabs,
  showLibraryBatchBar,
  allVisibleSelected,
  selectedCountLabel,
  hasSelection,
  onOpenLibrary,
  onOpenReading,
  onOpenSettings,
  onToggleSelectAll,
  onOpenBatchGroup,
  onOpenBatchDelete,
}: AppNavigationProps) {
  const reduceMotion = useAppReducedMotion();

  return (
    <>
      {showBottomTabs && (
        // Keep standard inline: CSS optimization may retain only prefixed; the module keeps Safari fallback.
        <nav
          className={styles.tabBar}
          style={{ backdropFilter: "blur(14px) saturate(112%)" }}
          aria-label="主要导航"
        >
          <m.span
            className={styles.tabIndicator}
            data-root-tab-indicator="true"
            layoutId="root-tab-indicator"
            initial={false}
            animate={{ x: `${getNavigationTabIndex(activeTab) * 100}%` }}
            transition={
              reduceMotion ? { duration: 0 } : ROOT_TAB_TRANSITION
            }
            aria-hidden="true"
          />
          <button
            className={`${styles.tab} ${activeTab === "library" ? styles.activeTab : ""}`}
            data-navigation-tab="library"
            aria-current={activeTab === "library" ? "page" : undefined}
            onClick={onOpenLibrary}
          >
            <svg className={styles.tabIcon} viewBox="0 0 26 26" aria-hidden="true">
              <rect className={styles.tabIconFill} x="3.5" y="5.2" width="4.6" height="16" rx="1.5" />
              <rect className={styles.tabIconFill} x="10.4" y="4.2" width="4.8" height="17" rx="1.5" />
              <rect className={styles.tabIconFill} x="17.7" y="6.6" width="4.2" height="14.2" rx="1.4" transform="rotate(-7 19.8 13.7)" />
              <rect className={styles.tabIconStroke} x="3.5" y="5.2" width="4.6" height="16" rx="1.5" />
              <rect className={styles.tabIconStroke} x="10.4" y="4.2" width="4.8" height="17" rx="1.5" />
              <rect className={styles.tabIconStroke} x="17.7" y="6.6" width="4.2" height="14.2" rx="1.4" transform="rotate(-7 19.8 13.7)" />
              <path className={styles.tabIconStroke} d="M5.8 9.2v7.6M12.8 8.1v9.2M19.9 10.4l.8 6.1" />
            </svg>
            <span className={styles.tabLabel}>{UI_TEXT.LIBRARY}</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === "reading" ? styles.activeTab : ""}`}
            data-navigation-tab="reading"
            aria-current={activeTab === "reading" ? "page" : undefined}
            onClick={onOpenReading}
          >
            <svg className={styles.tabIcon} viewBox="0 0 26 26" aria-hidden="true">
              <path className={styles.tabIconFill} d="M4.4 5.6c3.3-.4 6 .3 8.6 2.1v14.1c-2.4-1.6-5.2-2.3-8.6-1.8V5.6Z" />
              <path className={styles.tabIconFill} d="M13 7.7c2.6-1.8 5.3-2.5 8.6-2.1V20c-3.4-.5-6.2.2-8.6 1.8V7.7Z" />
              <path className={styles.tabIconStroke} d="M4.4 5.6c3.3-.4 6 .3 8.6 2.1v14.1c-2.4-1.6-5.2-2.3-8.6-1.8V5.6Z" />
              <path className={styles.tabIconStroke} d="M21.6 5.6c-3.3-.4-6 .3-8.6 2.1v14.1c2.4-1.6 5.2-2.3 8.6-1.8V5.6Z" />
              <path className={styles.tabIconStroke} d="M13 7.7v14.1" />
            </svg>
            <span className={styles.tabLabel}>{UI_TEXT.READING}</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === "settings" ? styles.activeTab : ""}`}
            data-navigation-tab="settings"
            aria-current={activeTab === "settings" ? "page" : undefined}
            onClick={onOpenSettings}
          >
            <svg
              className={styles.tabIcon}
              viewBox="0 0 26 26"
              aria-hidden="true"
              data-root-tab-gear="true"
            >
              <path
                className={styles.tabIconSolid}
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.55 2.3a1.55 1.55 0 0 1 1.5-1.18h1.9a1.55 1.55 0 0 1 1.5 1.18l.34 1.35c.43.18.84.42 1.22.7l1.32-.4a1.55 1.55 0 0 1 1.75.68l.95 1.65a1.55 1.55 0 0 1-.25 1.86l-.99.96c.06.47.06.94 0 1.41l.99.96c.5.49.61 1.25.25 1.86l-.95 1.65a1.55 1.55 0 0 1-1.75.68l-1.32-.4c-.38.28-.79.52-1.22.7l-.34 1.35a1.55 1.55 0 0 1-1.5 1.18h-1.9a1.55 1.55 0 0 1-1.5-1.18l-.34-1.35a7.2 7.2 0 0 1-1.22-.7l-1.32.4a1.55 1.55 0 0 1-1.75-.68l-.95-1.65a1.55 1.55 0 0 1 .25-1.86l.99-.96a5.7 5.7 0 0 1 0-1.41l-.99-.96a1.55 1.55 0 0 1-.25-1.86l.95-1.65a1.55 1.55 0 0 1 1.75-.68l1.32.4c.38-.28.79-.52 1.22-.7l.34-1.35ZM12 14.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z"
              />
            </svg>
            <span className={styles.tabLabel}>{UI_TEXT.SETTINGS}</span>
          </button>
        </nav>
      )}

      <AnimatePresence initial={false}>
        {showLibraryBatchBar && (
        <m.div
          key="library-batch-bar"
          className={styles.libraryBatchBar}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
          transition={{
            duration: reduceMotion
              ? MOTION_DURATION.reduced
              : MOTION_DURATION.state,
          }}
        >
          <button className={styles.batchTextButton} onClick={onToggleSelectAll}>
            {allVisibleSelected ? UI_TEXT.CLEAR_SELECTION : UI_TEXT.SELECT_ALL}
          </button>
          <span>{selectedCountLabel}</span>
          <button
            className={styles.batchTextButton}
            onClick={onOpenBatchGroup}
            disabled={!hasSelection}
          >
            {UI_TEXT.BATCH_ADD_TO_GROUP}
          </button>
          <button
            className={styles.batchDangerButton}
            onClick={onOpenBatchDelete}
            disabled={!hasSelection}
          >
            {UI_TEXT.BATCH_DELETE}
          </button>
        </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
