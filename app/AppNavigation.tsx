"use client";

import { m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import {
  getNavigationTabIndex,
  type NavigationTab,
} from "@/lib/navigationMotion";
import { MOTION_SPRING } from "@/lib/motionSystem";
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
        <nav className={styles.tabBar}>
          <m.span
            className={styles.tabIndicator}
            layoutId="root-tab-indicator"
            initial={false}
            animate={{ x: `${getNavigationTabIndex(activeTab) * 100}%` }}
            transition={
              reduceMotion ? { duration: 0 } : MOTION_SPRING.navigation
            }
            aria-hidden="true"
          />
          <button
            className={`${styles.tab} ${activeTab === "library" ? styles.activeTab : ""}`}
            data-navigation-tab="library"
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
            onClick={onOpenSettings}
          >
            <svg className={styles.tabIcon} viewBox="0 0 26 26" aria-hidden="true">
              <path className={styles.tabIconStroke} d="M5.2 7.4h15.6M5.2 13h15.6M5.2 18.6h15.6" />
              <circle className={styles.tabIconFill} cx="10" cy="7.4" r="2.2" />
              <circle className={styles.tabIconFill} cx="16.2" cy="13" r="2.2" />
              <circle className={styles.tabIconFill} cx="11.8" cy="18.6" r="2.2" />
              <circle className={styles.tabIconStroke} cx="10" cy="7.4" r="2.2" />
              <circle className={styles.tabIconStroke} cx="16.2" cy="13" r="2.2" />
              <circle className={styles.tabIconStroke} cx="11.8" cy="18.6" r="2.2" />
            </svg>
            <span className={styles.tabLabel}>{UI_TEXT.SETTINGS}</span>
          </button>
        </nav>
      )}

      {showLibraryBatchBar && (
        <div className={styles.libraryBatchBar}>
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
        </div>
      )}
    </>
  );
}
