"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, m, useIsPresent } from "motion/react";
import type { ReaderEntry } from "@/lib/appNavigation";
import type { BookRecord } from "@/lib/db";
import {
  bookCoverLayoutId,
  getBookTransitionMode,
} from "@/lib/sharedBookTransition";
import {
  getReaderTransitionTiming,
  MOTION_DURATION,
  MOTION_EASE,
} from "@/lib/motionSystem";
import BookCover from "./BookCover";
import {
  useAppMotionLifecycle,
  useAppReducedMotion,
} from "./AppMotionRoot";
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
  sourceLayoutTransition: ReaderSpatialTransition;
};

type ReaderSpatialTransition = {
  type: "tween";
  duration: number;
  ease: typeof MOTION_EASE.enter | typeof MOTION_EASE.exit;
};

function getReaderSpatialTransition(
  phase: "enter" | "exit",
  reduceMotion: boolean
): ReaderSpatialTransition {
  return {
    type: "tween",
    duration: reduceMotion
      ? MOTION_DURATION.reduced
      : phase === "enter"
        ? MOTION_DURATION.readerEnter
        : MOTION_DURATION.readerExit,
    ease: phase === "enter" ? MOTION_EASE.enter : MOTION_EASE.exit,
  };
}

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

type ReaderPresentationProps = {
  readerEntry: ReaderEntry;
  book: BookRecord;
  readerContent: ReactNode;
  mode: "shared" | "fallback";
  sharedLayoutId: string | undefined;
  sourceElement: HTMLElement | null;
  reduceMotion: boolean;
};

type ProjectionState = {
  epoch: number;
  invalidatedKey: string | null;
};

const SETTLED_TRANSITION = { duration: 0 } as const;

function ReaderPresentation({
  readerEntry,
  book,
  readerContent,
  mode,
  sharedLayoutId,
  sourceElement,
  reduceMotion,
}: ReaderPresentationProps) {
  const isPresent = useIsPresent();
  const { epoch, suspended } = useAppMotionLifecycle();
  const timing = getReaderTransitionTiming(reduceMotion);
  const spatialEnter = useMemo(
    () => getReaderSpatialTransition("enter", reduceMotion),
    [reduceMotion]
  );
  const spatialExit = useMemo(
    () => getReaderSpatialTransition("exit", reduceMotion),
    [reduceMotion]
  );
  const [projectionState, invalidateProjection] = useReducer(
    (_current: ProjectionState, next: ProjectionState) => next,
    { epoch, invalidatedKey: null }
  );
  const lifecycleInvalidated =
    projectionState.epoch !== epoch ||
    projectionState.invalidatedKey === readerEntry.key;
  const settleImmediately = suspended || lifecycleInvalidated;
  const exitSourceVisible =
    !isPresent && mode === "shared"
      ? Boolean(sourceElement && isSourceVisible(sourceElement))
      : null;
  const effectiveMode =
    lifecycleInvalidated ||
    (!isPresent && mode === "shared" && !exitSourceVisible)
      ? "fallback"
      : mode;
  const projectionActive =
    effectiveMode === "shared" && !settleImmediately && !reduceMotion;

  useLayoutEffect(() => {
    if (projectionState.epoch === epoch) return;
    invalidateProjection({ epoch, invalidatedKey: readerEntry.key });
  }, [epoch, projectionState.epoch, readerEntry.key]);

  return (
    <m.div
      key={readerEntry.key}
      className={styles.readerPresentation}
      data-reader-presented="true"
      data-reader-transition-mode={effectiveMode}
      data-reader-exit-mode={isPresent ? "present" : effectiveMode}
      data-reader-projection-active={projectionActive ? "true" : "false"}
      data-reader-spatial-duration-ms={
        (isPresent ? spatialEnter.duration : spatialExit.duration) * 1000
      }
      data-reader-lifecycle-settled={
        lifecycleInvalidated && !suspended ? "true" : "false"
      }
      initial={{ opacity: 1 }}
      animate={{
        opacity: 1,
        transition: settleImmediately ? SETTLED_TRANSITION : undefined,
      }}
      exit={{
        opacity: 1,
        transition: settleImmediately ? SETTLED_TRANSITION : undefined,
      }}
    >
      <m.div
        className={styles.readerTransitionCover}
        data-reader-transition-cover="true"
        layoutId={projectionActive ? sharedLayoutId : undefined}
        initial={
          settleImmediately || reduceMotion
            ? { opacity: 0, scale: 1 }
            : {
                opacity: 1,
                scale: effectiveMode === "fallback" ? 0.9 : 1,
              }
        }
        animate={{
          opacity: 0,
          scale: 1,
          transition: settleImmediately ? SETTLED_TRANSITION : undefined,
        }}
        exit={
          settleImmediately
            ? {
                opacity: 0,
                scale: 1,
                transition: SETTLED_TRANSITION,
              }
            : reduceMotion
              ? {
                  opacity: 0,
                  transition: timing.coverExitOpacity,
                }
              : effectiveMode === "shared"
                ? {
                    opacity: 1,
                    scale: 1,
                    transition: {
                      layout: spatialExit,
                      scale: spatialExit,
                      opacity: timing.coverExitOpacity,
                    },
                  }
                : {
                    opacity: 0,
                    scale: 0.88,
                    transition: {
                      scale: spatialExit,
                      opacity: timing.coverExitOpacity,
                    },
                  }
        }
        transition={
          settleImmediately
            ? SETTLED_TRANSITION
            : reduceMotion
              ? timing.coverEnterOpacity
              : {
                  layout: spatialEnter,
                  scale: spatialEnter,
                  opacity: timing.coverEnterOpacity,
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
        data-reader-presentation-content="true"
        initial={{ opacity: settleImmediately ? 1 : 0 }}
        animate={{
          opacity: 1,
          transition: settleImmediately
            ? SETTLED_TRANSITION
            : timing.contentEnter,
        }}
        exit={{
          opacity: 0,
          transition: settleImmediately
            ? SETTLED_TRANSITION
            : timing.contentExit,
        }}
      >
        {readerContent}
      </m.div>
    </m.div>
  );
}

export default function SharedBookTransition({
  readerEntry,
  book,
  readerContent,
  children,
}: SharedBookTransitionProps) {
  const reduceMotion = useAppReducedMotion();
  const readerActive = readerEntry !== null;
  const sourceLayoutTransition = useMemo(
    () =>
      getReaderSpatialTransition(
        readerActive ? "enter" : "exit",
        reduceMotion
      ),
    [readerActive, reduceMotion]
  );
  const [sources, setSources] = useState(() => new Map<string, BookSource>());
  const lastOriginRef = useRef<string | null>(null);
  const readerEntryRef = useRef(readerEntry);
  const sourcesRef = useRef(sources);

  useLayoutEffect(() => {
    readerEntryRef.current = readerEntry;
    sourcesRef.current = sources;
    if (readerEntry?.originId) lastOriginRef.current = readerEntry.originId;
  }, [readerEntry, sources]);

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
    () => ({ registerSource, setSourceVisibility, sourceLayoutTransition }),
    [registerSource, setSourceVisibility, sourceLayoutTransition]
  );

  const source = readerEntry?.originId
    ? sources.get(readerEntry.originId)
    : undefined;
  const sourceVisible = Boolean(
    readerEntry && source?.visible && source.element.isConnected
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
    if (readerEntryRef.current) return;
    const originId = lastOriginRef.current;
    if (!originId) return;

    const sourceToRestore = sourcesRef.current.get(originId);
    if (!sourceToRestore || !isSourceVisible(sourceToRestore.element)) return;
    const focusTarget =
      sourceToRestore.element.closest<HTMLButtonElement>("button") ??
      sourceToRestore.element;
    focusTarget.focus({ preventScroll: true });
    lastOriginRef.current = null;
  }, []);

  useEffect(() => {
    if (readerEntry) return;
    const frame = window.requestAnimationFrame(restoreOriginFocus);
    return () => window.cancelAnimationFrame(frame);
  }, [readerEntry, restoreOriginFocus]);

  return (
    <SharedBookSourceContext.Provider value={contextValue}>
      {children}
      <AnimatePresence initial={false} onExitComplete={restoreOriginFocus}>
        {canPresent && readerEntry && book && (
          <ReaderPresentation
            key={readerEntry.key}
            readerEntry={readerEntry}
            book={book}
            readerContent={readerContent}
            mode={mode}
            sharedLayoutId={sharedLayoutId}
            sourceElement={source?.element ?? null}
            reduceMotion={reduceMotion}
          />
        )}
      </AnimatePresence>
    </SharedBookSourceContext.Provider>
  );
}
