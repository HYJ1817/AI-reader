"use client";

import type {
  PointerEventHandler,
  RefObject,
  TransitionEventHandler,
  UIEventHandler,
} from "react";
import EpubReader, { type EpubReaderHandle } from "@/app/EpubReader";
import ReaderControls from "@/app/ReaderControls";
import type { BookRecord, ReadingPosition } from "@/lib/db";
import type { EpubTocItem } from "@/lib/epubNavigation";
import type { ReaderMode } from "@/lib/readerMode";
import type { ReaderPreferences } from "@/lib/readerPreferences";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

type ReadingSessionProps = {
  active: boolean;
  book: BookRecord | null;
  loading: boolean;
  mode: ReaderMode;
  preferences: ReaderPreferences;
  paragraphChunks: string[][];
  chromeVisible: boolean;
  tocItems: EpubTocItem[];
  progressPercent: number;
  shellRef: RefObject<HTMLDivElement | null>;
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
  getReadingPosition: (bookId: string) => Promise<ReadingPosition | undefined>;
  saveReadingPosition: (position: ReadingPosition) => Promise<void>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: () => void;
  onTextSelect: (text: string) => void;
  onReaderTap: () => void;
  onReaderScrollStart: () => void;
  onSwipeTurn: (direction: "prev" | "next") => void;
  onTocChange: (items: EpubTocItem[]) => void;
  onProgressChange: (progressPercent: number) => void;
  onTextReaderScroll: UIEventHandler<HTMLDivElement>;
  onSwipeTransitionEnd: TransitionEventHandler<HTMLDivElement>;
  onBack: () => void;
  onOpenContents: () => void;
  onOpenSettings: () => void;
  onAsk: () => void;
  onOpenGoal: () => void;
  onModeChange: (mode: ReaderMode) => void;
};

export default function ReadingSession({
  active,
  book,
  loading,
  mode,
  preferences,
  paragraphChunks,
  chromeVisible,
  tocItems,
  progressPercent,
  shellRef,
  textReaderRef,
  epubReaderRef,
  getReadingPosition,
  saveReadingPosition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onTextSelect,
  onReaderTap,
  onReaderScrollStart,
  onSwipeTurn,
  onTocChange,
  onProgressChange,
  onTextReaderScroll,
  onSwipeTransitionEnd,
  onBack,
  onOpenContents,
  onOpenSettings,
  onAsk,
  onOpenGoal,
  onModeChange,
}: ReadingSessionProps) {
  return (
    <div
      ref={shellRef}
      className={`${styles.readerShell} ${
        active ? styles.readerSessionActive : styles.readerSessionInactive
      } ${chromeVisible ? "" : styles.readerChromeHidden}`}
      aria-hidden={!active}
    >
      <div
        className={styles.readerStage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {!book ? null : book.format === "epub" ? (
          <EpubReader
            ref={epubReaderRef}
            bookId={book.id}
            fileBlob={book.fileBlob}
            mode={mode}
            getReadingPosition={getReadingPosition}
            saveReadingPosition={saveReadingPosition}
            onTextSelect={onTextSelect}
            onReaderTap={onReaderTap}
            onReaderScrollStart={onReaderScrollStart}
            onSwipeTurn={onSwipeTurn}
            onTocChange={onTocChange}
            onProgressChange={onProgressChange}
            preferences={preferences}
          />
        ) : loading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{UI_TEXT.LOADING}</p>
          </div>
        ) : (
          <div
            ref={textReaderRef}
            className={`${styles.readerBody} ${
              mode === "paged" ? styles.readerBodyPaged : ""
            }`}
            onScroll={onTextReaderScroll}
            onTransitionEnd={onSwipeTransitionEnd}
            style={{
              fontSize: `${preferences.fontSizePx}px`,
              lineHeight: preferences.lineHeight,
              maxWidth: `${preferences.contentWidth}px`,
              margin: "0 auto",
              width: "100%",
            }}
          >
            {paragraphChunks.map((chunk, chunkIndex) => (
              <section key={chunkIndex} className={styles.paragraphChunk}>
                {chunk.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${chunkIndex}-${paragraphIndex}`}
                    className={styles.paragraph}
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      {book && (
        <ReaderControls
          onBack={onBack}
          onContents={onOpenContents}
          hasToc={tocItems.length > 0 && book.format === "epub"}
          progressPercent={progressPercent}
          onOpenSettings={onOpenSettings}
          onAsk={onAsk}
          onOpenGoal={onOpenGoal}
          readerMode={mode}
          onReaderModeChange={onModeChange}
          visible={chromeVisible}
        />
      )}
    </div>
  );
}
