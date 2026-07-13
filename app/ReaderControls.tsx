"use client";

import { useState } from "react";
import { m, type Variants } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import {
  formatReaderPageLabel,
  type ReaderPageInfo,
} from "@/lib/readerPageInfo";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

const chromeVariants = {
  visible: (reduceMotion: boolean) => ({
    transition: reduceMotion
      ? { duration: 0 }
      : { staggerChildren: 0.035, delayChildren: 0.02 },
  }),
  hidden: (reduceMotion: boolean) => ({
    transition: reduceMotion
      ? { duration: 0 }
      : { staggerChildren: 0.025, staggerDirection: -1 },
  }),
} satisfies Variants;

const menuRowVariants = {
  visible: (reduceMotion: boolean) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: reduceMotion ? 0 : 0.2 },
  }),
  hidden: (reduceMotion: boolean) => ({
    opacity: 0,
    y: reduceMotion ? 0 : 14,
    scale: reduceMotion ? 1 : 0.96,
    transition: { duration: reduceMotion ? 0 : 0.16 },
  }),
} satisfies Variants;

const closeVariants = {
  visible: (reduceMotion: boolean) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: reduceMotion ? 0 : 0.2 },
  }),
  hidden: (reduceMotion: boolean) => ({
    opacity: 0,
    y: reduceMotion ? 0 : -8,
    scale: reduceMotion ? 1 : 0.96,
    transition: { duration: reduceMotion ? 0 : 0.16 },
  }),
} satisfies Variants;

const pagePillVariants = {
  visible: (reduceMotion: boolean) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: reduceMotion ? 0 : 0.2 },
  }),
  hidden: (reduceMotion: boolean) => ({
    opacity: 0,
    y: reduceMotion ? 0 : 10,
    scale: reduceMotion ? 1 : 0.97,
    transition: { duration: reduceMotion ? 0 : 0.16 },
  }),
} satisfies Variants;

type Props = {
  onBack: () => void;
  onContents: () => void;
  hasToc: boolean;
  onOpenSettings: () => void;
  onAsk: () => void;
  onWakeMenu: () => void;
  pageInfo: ReaderPageInfo;
  visible?: boolean;
};

export default function ReaderControls({
  onBack,
  onContents,
  hasToc,
  onOpenSettings,
  onAsk,
  onWakeMenu,
  pageInfo,
  visible = true,
}: Props) {
  const reduceMotion = useAppReducedMotion();
  const [controlsInert, setControlsInert] = useState(!visible);

  const handleContents = () => {
    if (hasToc) onContents();
  };

  return (
    <div className={styles.readerChrome}>
      <button
        className={styles.readerMenuWakeButton}
        data-reader-menu-toggle="true"
        onClick={onWakeMenu}
        title={UI_TEXT.MORE_OPTIONS}
        aria-label={UI_TEXT.MORE_OPTIONS}
        aria-expanded={visible}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" />
        </svg>
      </button>

      <m.div
        className={styles.readerChromeAnimated}
        data-reader-chrome-controls="true"
        custom={reduceMotion}
        variants={chromeVariants}
        initial={false}
        animate={visible ? "visible" : "hidden"}
        onAnimationStart={(definition) => {
          if (definition === "visible") setControlsInert(false);
        }}
        onAnimationComplete={(definition) => {
          if (definition === "hidden") setControlsInert(true);
        }}
        aria-hidden={controlsInert}
        {...(controlsInert ? { inert: true } : {})}
      >
        <m.button
          className={styles.readerOverlayBack}
          custom={reduceMotion}
          variants={closeVariants}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          data-reader-close="true"
          onClick={onBack}
          title={UI_TEXT.LIBRARY}
          aria-label={UI_TEXT.LIBRARY}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <path d="M8 8l12 12M20 8 8 20" strokeLinecap="round" />
          </svg>
        </m.button>

        <m.div
          className={styles.readerPagePill}
          custom={reduceMotion}
          variants={pagePillVariants}
        >
          {formatReaderPageLabel(pageInfo)}
        </m.div>

        <div className={styles.readerActionMenu}>
          <m.div
            className={styles.readerMenuRowMotion}
            custom={reduceMotion}
            variants={menuRowVariants}
          >
            <button
              className={styles.readerMenuRow}
              onClick={handleContents}
              disabled={!hasToc}
            >
              <span>{UI_TEXT.CONTENTS}</span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
                <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
                <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </m.div>

          <m.div
            className={styles.readerMenuRowMotion}
            custom={reduceMotion}
            variants={menuRowVariants}
          >
            <button className={styles.readerMenuRow} onClick={onAsk}>
              <span>{UI_TEXT.ASK_AI}</span>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" strokeLinecap="round" />
              </svg>
            </button>
          </m.div>

          <m.div
            className={styles.readerMenuRowMotion}
            custom={reduceMotion}
            variants={menuRowVariants}
          >
            <button className={styles.readerMenuRow} onClick={onOpenSettings}>
              <span>主题与设置</span>
              <span className={styles.readerMenuTrailing}>大小</span>
            </button>
          </m.div>
        </div>
      </m.div>
    </div>
  );
}
