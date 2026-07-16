"use client";

import type {
  PointerEventHandler,
  RefObject,
  TransitionEventHandler,
  UIEventHandler,
} from "react";
import EpubReader, { type EpubReaderHandle } from "@/app/EpubReader";
import ReaderControls from "@/app/ReaderControls";
import type { AnnotationRecord, BookRecord, ReadingPosition } from "@/lib/db";
import type { EpubTocItem } from "@/lib/epubNavigation";
import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import type { ReaderMode } from "@/lib/readerMode";
import type { ReaderPreferences } from "@/lib/readerPreferences";
import type { ReaderTextSelection } from "@/lib/readerAnnotations";
import { buildTxtHighlightRuns } from "@/lib/txtAnnotations";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

type ReadingSessionProps = {
  book: BookRecord | null;
  loading: boolean;
  mode: ReaderMode;
  preferences: ReaderPreferences;
  pageInfo: ReaderPageInfo;
  paragraphChunks: string[][];
  highlights: AnnotationRecord[];
  chromeVisible: boolean;
  tocItems: EpubTocItem[];
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
  getReadingPosition: (bookId: string) => Promise<ReadingPosition | undefined>;
  saveReadingPosition: (position: ReadingPosition) => Promise<void>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: () => void;
  onTextSelect: (selection: ReaderTextSelection | null) => void;
  onReaderTap: () => void;
  onReaderScrollStart: () => void;
  onSwipeTurn: (direction: "prev" | "next") => void;
  onTocChange: (items: EpubTocItem[]) => void;
  onProgressChange: (progressPercent: number) => void;
  onPageInfoChange: (pageInfo: ReaderPageInfo) => void;
  onTextReaderScroll: UIEventHandler<HTMLDivElement>;
  onSwipeTransitionEnd: TransitionEventHandler<HTMLDivElement>;
  onBack: () => void;
  onOpenContents: () => void;
  onOpenSettings: () => void;
  onAsk: () => void;
};

export default function ReadingSession({
  book,
  loading,
  mode,
  preferences,
  pageInfo,
  paragraphChunks,
  highlights,
  chromeVisible,
  tocItems,
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
  onPageInfoChange,
  onTextReaderScroll,
  onSwipeTransitionEnd,
  onBack,
  onOpenContents,
  onOpenSettings,
  onAsk,
}: ReadingSessionProps) {
  const isEpubBook = book?.format === "epub";
  const paragraphChunkStarts = paragraphChunks.map((_, chunkIndex) =>
    paragraphChunks
      .slice(0, chunkIndex)
      .reduce((total, chunk) => total + chunk.length, 0)
  );

  return (
    <div
      className={styles.readerShell}
    >
      <div
        className={styles.readerStage}
        data-navigation-gesture-owner="reader"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {!book ? null : isEpubBook ? (
          <EpubReader
            ref={epubReaderRef}
            bookId={book.id}
            fileBlob={book.fileBlob}
            mode={mode}
            getReadingPosition={getReadingPosition}
            saveReadingPosition={saveReadingPosition}
            highlights={highlights}
            onTextSelect={onTextSelect}
            onReaderTap={onReaderTap}
            onReaderScrollStart={onReaderScrollStart}
            onSwipeTurn={onSwipeTurn}
            onTocChange={onTocChange}
            onProgressChange={onProgressChange}
            onPageInfoChange={onPageInfoChange}
            preferences={preferences}
          />
        ) : loading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{UI_TEXT.LOADING}</p>
          </div>
        ) : (
          <div
            ref={textReaderRef}
            data-txt-reader="true"
            className={`${styles.readerBody} ${
              mode === "paged" ? styles.readerBodyPaged : ""
            }`}
            onScroll={onTextReaderScroll}
            onWheel={onReaderScrollStart}
            onTransitionEnd={onSwipeTransitionEnd}
            style={{
              fontSize: `${preferences.fontSizePx}px`,
              fontFamily:
                preferences.fontFamily === "system"
                  ? '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
                  : preferences.fontFamily === "serif"
                    ? '"Songti SC", "STSong", "Noto Serif CJK SC", serif'
                    : undefined,
              fontWeight: preferences.boldText ? 700 : undefined,
              letterSpacing:
                preferences.customLayoutEnabled &&
                preferences.letterSpacingPercent > 0
                  ? `${preferences.letterSpacingPercent / 100}em`
                  : undefined,
              lineHeight: preferences.customLayoutEnabled
                ? preferences.lineHeight
                : undefined,
              maxWidth: `${preferences.contentWidth}px`,
              margin: "0 auto",
              padding: `20px ${
                24 + (preferences.customLayoutEnabled ? preferences.pageMarginPx : 0)
              }px calc(var(--safe-bottom) + 96px)`,
              textAlign:
                preferences.customLayoutEnabled && preferences.justifyText
                  ? "justify"
                  : "start",
              width: "100%",
              wordSpacing:
                preferences.customLayoutEnabled &&
                preferences.wordSpacingPercent > 0
                  ? `${preferences.wordSpacingPercent / 100}em`
                  : undefined,
            }}
          >
            {paragraphChunks.map((chunk, chunkIndex) => (
              <section key={chunkIndex} className={styles.paragraphChunk}>
                {chunk.map((paragraph, paragraphIndex) => (
                  <p
                    key={`${chunkIndex}-${paragraphIndex}`}
                    className={styles.paragraph}
                    data-paragraph-index={
                      paragraphChunkStarts[chunkIndex] + paragraphIndex
                    }
                  >
                    {buildTxtHighlightRuns(
                      paragraphChunkStarts[chunkIndex] + paragraphIndex,
                      paragraph,
                      highlights
                    ).map((run, runIndex) =>
                      run.annotationId ? (
                        <mark
                          key={`${run.annotationId}-${runIndex}`}
                          className={styles.txtHighlight}
                          data-highlight-color={run.color}
                          data-annotation-id={run.annotationId}
                        >
                          {run.text}
                        </mark>
                      ) : (
                        <span key={`text-${runIndex}`}>{run.text}</span>
                      )
                    )}
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
          onOpenSettings={onOpenSettings}
          onAsk={onAsk}
          onWakeMenu={onReaderTap}
          pageInfo={pageInfo}
          visible={chromeVisible}
        />
      )}
    </div>
  );
}
