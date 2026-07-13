"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, m } from "motion/react";
import type { ReaderEntry } from "@/lib/appNavigation";
import type { BookRecord } from "@/lib/db";
import {
  bookCoverLayoutId,
  getBookTransitionMode,
} from "@/lib/sharedBookTransition";
import { MOTION_DURATION, MOTION_SPRING } from "@/lib/motionSystem";
import BookCover from "./BookCover";
import { useAppReducedMotion } from "./AppMotionRoot";
import styles from "./page.module.css";

type BookSource = {
  bookId: string;
  element: HTMLElement;
  visible: boolean;
};

type SharedBookSourceContextValue = {
  registerSource: (
    originId: string,
    bookId: string,
    element: HTMLElement
  ) => () => void;
  setSourceVisibility: (originId: string, visible: boolean) => void;
};

const SharedBookSourceContext =
  createContext<SharedBookSourceContextValue | null>(null);

export function useSharedBookSource(): SharedBookSourceContextValue {
  const value = useContext(SharedBookSourceContext);
  if (!value) {
    throw new Error("useSharedBookSource requires SharedBookTransition");
  }
  return value;
}

function isSourceVisible(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}

type SharedBookTransitionProps = {
  readerEntry: ReaderEntry | null;
  book: BookRecord | null;
  readerContent: ReactNode;
  children: ReactNode;
};

export default function SharedBookTransition({
  readerEntry,
  book,
  readerContent,
  children,
}: SharedBookTransitionProps) {
  const reduceMotion = useAppReducedMotion();
  const [sources, setSources] = useState(() => new Map<string, BookSource>());
  const lastOriginRef = useRef<string | null>(null);

  useEffect(() => {
    if (readerEntry?.originId) lastOriginRef.current = readerEntry.originId;
  }, [readerEntry?.originId]);

  const registerSource = useCallback(
    (originId: string, bookId: string, element: HTMLElement) => {
      setSources((currentSources) => {
        const nextSources = new Map(currentSources);
        nextSources.set(originId, {
          bookId,
          element,
          visible: isSourceVisible(element),
        });
        return nextSources;
      });

      return () => {
        setSources((currentSources) => {
          const current = currentSources.get(originId);
          if (current?.element !== element) return currentSources;
          const nextSources = new Map(currentSources);
          nextSources.delete(originId);
          return nextSources;
        });
      };
    },
    []
  );

  const setSourceVisibility = useCallback(
    (originId: string, visible: boolean) => {
      setSources((currentSources) => {
        const source = currentSources.get(originId);
        if (!source || source.visible === visible) return currentSources;
        const nextSources = new Map(currentSources);
        nextSources.set(originId, { ...source, visible });
        return nextSources;
      });
    },
    []
  );

  const contextValue = useMemo(
    () => ({ registerSource, setSourceVisibility }),
    [registerSource, setSourceVisibility]
  );

  const source = readerEntry?.originId
    ? sources.get(readerEntry.originId)
    : undefined;
  const sourceVisible = Boolean(
    source?.visible && source.element.isConnected
  );
  const mode =
    readerEntry && book
      ? getBookTransitionMode(
          sourceVisible,
          source?.bookId ?? null,
          readerEntry.bookId
        )
      : "fallback";
  const sharedLayoutId =
    mode === "shared" && readerEntry?.originId
      ? bookCoverLayoutId(readerEntry.originId)
      : undefined;
  const canPresent = Boolean(
    readerEntry && book && readerEntry.bookId === book.id
  );

  const restoreOriginFocus = useCallback(() => {
    if (readerEntry) return;
    const originId = lastOriginRef.current;
    lastOriginRef.current = null;
    if (!originId) return;

    const sourceToRestore = sources.get(originId);
    if (!sourceToRestore || !isSourceVisible(sourceToRestore.element)) return;
    const focusTarget =
      sourceToRestore.element.closest<HTMLButtonElement>("button") ??
      sourceToRestore.element;
    focusTarget.focus({ preventScroll: true });
  }, [readerEntry, sources]);

  return (
    <SharedBookSourceContext.Provider value={contextValue}>
      {children}
      <AnimatePresence initial={false} onExitComplete={restoreOriginFocus}>
        {canPresent && readerEntry && book && (
          <m.div
            key={readerEntry.key}
            className={styles.readerPresentation}
            data-reader-presented="true"
            data-reader-transition-mode={mode}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
          >
            <m.div
              className={styles.readerTransitionCover}
              layoutId={reduceMotion ? undefined : sharedLayoutId}
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 1, scale: mode === "fallback" ? 0.9 : 1 }
              }
              animate={{ opacity: 0, scale: 1 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : mode === "shared"
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.88 }
              }
              transition={
                reduceMotion
                  ? { duration: MOTION_DURATION.reduced }
                  : {
                      layout: MOTION_SPRING.sharedBook,
                      scale: MOTION_SPRING.sharedBook,
                      opacity: {
                        duration: MOTION_DURATION.state,
                        delay: MOTION_DURATION.readerEnter * 0.42,
                      },
                    }
              }
              aria-hidden="true"
            >
              <BookCover
                title={book.title}
                format={book.format}
                coverImageBlob={book.coverImageBlob}
              />
            </m.div>
            <m.div
              className={styles.readerPresentationContent}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion
                  ? MOTION_DURATION.reduced
                  : MOTION_DURATION.readerExit,
                delay: reduceMotion ? 0 : MOTION_DURATION.readerEnter * 0.24,
              }}
            >
              {readerContent}
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </SharedBookSourceContext.Provider>
  );
}
