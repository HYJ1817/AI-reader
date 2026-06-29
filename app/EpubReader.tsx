"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReadingPosition } from "@/lib/db";
import { progressPercentFromEpubLocation } from "@/lib/epubProgress";
import { normalizeEpubNavigation } from "@/lib/epubNavigation";
import type { EpubTocItem } from "@/lib/epubNavigation";
import { applyEpubAmbientCanvas } from "@/lib/epubAmbientCanvas";
import type { ReaderPreferences } from "@/lib/readerPreferences";
import { shouldObserveSystemReaderTheme } from "@/lib/readerPreferences";
import { getEpubRenditionOptions } from "@/lib/epubReaderMode";
import type { ReaderMode } from "@/lib/readerMode";
import {
  applyEpubReaderPreferences,
  EMPTY_EPUB_PREFERENCE_STATE,
  type EpubPreferenceState,
  type EpubThemeController,
} from "@/lib/epubReaderPreferences";
import {
  cancelEpubSyntheticClickToken,
  consumeEpubSyntheticClick,
  normalizeEpubSelectionText,
  resolveEpubTouchEnd,
  shouldReportEpubSelectionChange,
  type EpubSyntheticClickToken,
} from "@/lib/epubTapInteractions";
import {
  isTapGesture,
  isScrollIntent,
  shouldReduceReaderMotion,
} from "@/lib/motionInteractions";
import {
  getReaderSwipeAction,
  getReaderSwipeSettleOffset,
  getReaderSwipeVisualOffset,
  hasActiveReaderSwipeOffset,
  isReaderSwipeSettleTransition,
  type ReaderSwipeAction,
} from "@/lib/readerSwipe";
import { UI_TEXT } from "@/lib/uiText";
import type { Rendition } from "epubjs";
import styles from "./page.module.css";

export type EpubReaderHandle = {
  next: () => Promise<void>;
  prev: () => Promise<void>;
  goTo: (href: string) => Promise<void>;
};

type EpubReaderProps = {
  bookId: string;
  fileBlob: Blob;
  mode: ReaderMode;
  getReadingPosition: (bookId: string) => Promise<ReadingPosition | undefined>;
  saveReadingPosition: (position: ReadingPosition) => Promise<void>;
  onTextSelect?: (text: string) => void;
  onReaderTap?: () => void;
  onReaderScrollStart?: () => void;
  onSwipeTurn?: (
    direction: Exclude<ReaderSwipeAction, "none">
  ) => void | Promise<void>;
  onTocChange?: (items: EpubTocItem[]) => void;
  onProgressChange?: (progressPercent: number) => void;
  preferences?: ReaderPreferences;
};

type EpubBook = {
  open: (input: ArrayBuffer, what?: "binary") => Promise<unknown>;
  opened?: Promise<unknown>;
  spine?: { items?: unknown[] };
  renderTo: (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      spread: string;
      flow?: string;
      manager?: string;
      overflow?: string;
    }
  ) => Rendition;
  loaded?: { navigation?: unknown };
  getRange?: (cfiRange: string) => Range | null | undefined;
  destroy: () => void;
};

const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(function EpubReader(
  {
    bookId,
    fileBlob,
    mode,
    getReadingPosition,
    saveReadingPosition,
    onTextSelect,
    onReaderTap,
    onReaderScrollStart,
    onSwipeTurn,
    onTocChange,
    onProgressChange,
    preferences,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [systemThemeRevision, setSystemThemeRevision] = useState(0);
  const readerTheme = preferences?.theme;
  const renditionRef = useRef<unknown>(null);
  const bookRef = useRef<unknown>(null);
  const objectUrlRef = useRef<string | null>(null);
  const bookIdRef = useRef(bookId);
  const modeRef = useRef(mode);
  const latestLocatorRef = useRef<string | null>(null);
  const preferencesRef = useRef(preferences);
  const onTextSelectRef = useRef(onTextSelect);
  const onReaderTapRef = useRef(onReaderTap);
  const onReaderScrollStartRef = useRef(onReaderScrollStart);
  const onSwipeTurnRef = useRef(onSwipeTurn);
  const onTocChangeRef = useRef(onTocChange);
  const onProgressChangeRef = useRef(onProgressChange);
  const attachedTapDocsRef = useRef<WeakSet<Document>>(new WeakSet());
  const saveTimerRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<ReadingPosition | null>(null);
  const swipeSettleTimerRef = useRef<number | null>(null);
  const swipeSettleGenerationRef = useRef(0);
  const pendingSwipeSettleRef = useRef<{
    generation: number;
    action: ReaderSwipeAction;
  } | null>(null);
  const appliedPreferenceStateRef = useRef<EpubPreferenceState>(
    EMPTY_EPUB_PREFERENCE_STATE
  );

  useEffect(() => {
    if (bookIdRef.current !== bookId) {
      latestLocatorRef.current = null;
    }
    bookIdRef.current = bookId;
  }, [bookId]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    if (
      !readerTheme ||
      !shouldObserveSystemReaderTheme(readerTheme)
    ) {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemThemeRevision((revision) => revision + 1);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [readerTheme]);

  useEffect(() => {
    onTextSelectRef.current = onTextSelect;
  }, [onTextSelect]);

  useEffect(() => {
    onReaderTapRef.current = onReaderTap;
  }, [onReaderTap]);

  useEffect(() => {
    onReaderScrollStartRef.current = onReaderScrollStart;
  }, [onReaderScrollStart]);

  useEffect(() => {
    onSwipeTurnRef.current = onSwipeTurn;
  }, [onSwipeTurn]);

  useEffect(() => {
    onTocChangeRef.current = onTocChange;
  }, [onTocChange]);

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange;
  }, [onProgressChange]);

  const goNext = useCallback(async () => {
    if (renditionRef.current) {
      await (renditionRef.current as { next: () => Promise<void> }).next();
    }
  }, []);

  const goPrev = useCallback(async () => {
    if (renditionRef.current) {
      await (renditionRef.current as { prev: () => Promise<void> }).prev();
    }
  }, []);

  const goTo = useCallback(async (href: string) => {
    if (renditionRef.current) {
      await (renditionRef.current as { display: (target?: string) => Promise<void> }).display(href);
    }
  }, []);

  useImperativeHandle(ref, () => ({ next: goNext, prev: goPrev, goTo }), [goNext, goPrev, goTo]);

  const getThemeColors = useCallback(() => {
    const root = containerRef.current ?? document.documentElement;
    const cs = getComputedStyle(root);
    return {
      foreground: cs.getPropertyValue("--foreground").trim() || "#1a1a1a",
      background: cs.getPropertyValue("--background").trim() || "#ffffff",
    };
  }, []);

  const applyPreferences = useCallback(
    (r: Rendition, prefs: ReaderPreferences) => {
      const colors = getThemeColors();
      appliedPreferenceStateRef.current = applyEpubReaderPreferences(
        r.themes as EpubThemeController,
        prefs,
        colors,
        appliedPreferenceStateRef.current
      );
    },
    [getThemeColors]
  );

  const applyRenderedCanvas = useCallback(
    (r: Rendition) => {
      const renderedContents = (
        r as Rendition & { getContents?: () => unknown }
      ).getContents?.();
      if (Array.isArray(renderedContents)) {
        renderedContents.forEach((contents) =>
          applyEpubAmbientCanvas(contents)
        );
      } else {
        applyEpubAmbientCanvas(renderedContents);
      }
    },
    []
  );

  const handleRelocated = useCallback(
    (location: unknown) => {
      const currentBookId = bookIdRef.current;
      const spineItemCount =
        (bookRef.current as EpubBook | null)?.spine?.items?.length ?? 0;
      const percent = progressPercentFromEpubLocation(
        location,
        spineItemCount
      );
      const cfi =
        location &&
        typeof location === "object" &&
        "start" in location &&
        (location as Record<string, unknown>).start &&
        typeof (location as Record<string, unknown>).start === "object"
          ? ((location as Record<string, unknown>).start as Record<string, unknown>).cfi
          : undefined;
      const locator = typeof cfi === "string" ? cfi : "epub-unknown";
      if (locator !== "epub-unknown") {
        latestLocatorRef.current = locator;
      }

      pendingPositionRef.current = {
        bookId: currentBookId,
        locator,
        progressPercent: percent,
        readingMode: modeRef.current,
        updatedAt: new Date().toISOString(),
      };
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const position = pendingPositionRef.current;
        pendingPositionRef.current = null;
        if (position) void saveReadingPosition(position);
      }, 180);

      onProgressChangeRef.current?.(percent);
    },
    [saveReadingPosition]
  );

  const handleSelected = useCallback(
    (cfiRange: unknown, contents: unknown) => {
      const onSelect = onTextSelectRef.current;
      if (!onSelect) return;
      try {
        const c = contents as { window?: { getSelection?: () => Selection | null } };
        let text = c?.window?.getSelection?.()?.toString() ?? "";
        if (!text.trim() && typeof cfiRange === "string" && bookRef.current) {
          const book = bookRef.current as {
            getRange?: (cfiRange: string) => Range | null | undefined;
          };
          text = book.getRange?.(cfiRange)?.toString() ?? "";
        }

        const trimmedText = text.trim();
        if (trimmedText.length > 0) {
          onSelect(trimmedText);
        }
      } catch {
        // ignore selection read errors
      }
    },
    []
  );

  const finishSwipeSettle = useCallback(async (generation: number) => {
    const pending = pendingSwipeSettleRef.current;
    if (
      !pending ||
      pending.generation !== generation ||
      generation !== swipeSettleGenerationRef.current
    ) {
      return;
    }
    pendingSwipeSettleRef.current = null;
    if (swipeSettleTimerRef.current !== null) {
      window.clearTimeout(swipeSettleTimerRef.current);
      swipeSettleTimerRef.current = null;
    }
    if (pending.action !== "none") {
      await onSwipeTurnRef.current?.(pending.action);
    }
    if (generation !== swipeSettleGenerationRef.current) return;
    const shell = shellRef.current;
    if (!shell) return;
    shell.classList.remove(styles.readerSwipeSettling);
    shell.style.setProperty("--reader-swipe-x", "0px");
  }, []);

  const handleSwipeTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (
        !isReaderSwipeSettleTransition({
          propertyName: event.propertyName,
          targetIsReader: event.target === event.currentTarget,
        })
      ) {
        return;
      }
      const pending = pendingSwipeSettleRef.current;
      if (pending) void finishSwipeSettle(pending.generation);
    },
    [finishSwipeSettle]
  );

  const attachTapHandlers = useCallback((contents: unknown) => {
    const c = contents as {
      document?: Document;
      window?: Window & { getSelection?: () => Selection | null };
    } | null;
    const doc = c?.document;
    if (!doc || attachedTapDocsRef.current.has(doc)) return;

    attachedTapDocsRef.current.add(doc);
    let touchStart: {
      x: number;
      y: number;
      time: number;
      target: EventTarget | null;
      axis: "pending" | "horizontal" | "vertical";
      baseOffset: number;
      selectionText: string;
    } | null = null;
    let syntheticClickToken: EpubSyntheticClickToken | null = null;
    let scrollIntentFired = false;
    let suppressNonEmptySelectionUntil = Number.NEGATIVE_INFINITY;

    const isInteractiveTarget = (target: EventTarget | null) => {
      const view = doc.defaultView;
      if (!view || !(target instanceof view.HTMLElement)) return false;
      return Boolean(
        target.closest("button") ||
          target.closest("input") ||
          target.closest("textarea") ||
          target.closest("select") ||
          target.closest("a") ||
          target.closest('[role="button"]')
      );
    };

    const getSelectionText = () => {
      const selection = c?.window?.getSelection?.() ?? doc.getSelection?.();
      return normalizeEpubSelectionText(selection?.toString() ?? "");
    };

    let selectionChangeTimer: number | null = null;
    const publishSelectionChange = () => {
      const selectionText = getSelectionText();
      if (
        !shouldReportEpubSelectionChange({
          value: selectionText,
          at: Date.now(),
          suppressNonEmptyUntil: suppressNonEmptySelectionUntil,
        })
      ) {
        return;
      }
      onTextSelectRef.current?.(selectionText);
    };
    const reportSelectionChange = () => {
      const view = c?.window ?? doc.defaultView;
      if (selectionChangeTimer !== null) {
        view?.clearTimeout(selectionChangeTimer);
      }
      if (!view) {
        publishSelectionChange();
        return;
      }
      selectionChangeTimer = view.setTimeout(() => {
        selectionChangeTimer = null;
        publishSelectionChange();
      }, 260);
    };

    const clearSelectionForTap = (at: number) => {
      suppressNonEmptySelectionUntil = at + 420;
      const view = c?.window ?? doc.defaultView;
      if (selectionChangeTimer !== null) {
        view?.clearTimeout(selectionChangeTimer);
        selectionChangeTimer = null;
      }
      const selection = c?.window?.getSelection?.() ?? doc.getSelection?.();
      selection?.removeAllRanges();
      onTextSelectRef.current?.("");
    };

    const fireReaderTap = (target: EventTarget | null) => {
      if (isInteractiveTarget(target) || getSelectionText()) return;
      onReaderTapRef.current?.();
    };

    const settleSwipe = (
      action: ReaderSwipeAction,
      currentOffset: number,
      viewportWidth: number
    ) => {
      const shell = shellRef.current;
      if (!shell) return;
      const reducedMotion = shouldReduceReaderMotion({
        appPreference: Boolean(
          document.querySelector('[data-reduce-motion="true"]')
        ),
        systemPreference: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches,
      });
      const generation = ++swipeSettleGenerationRef.current;
      const duration = reducedMotion ? 0 : action === "none" ? 180 : 160;
      const targetOffset = getReaderSwipeSettleOffset(
        action,
        currentOffset,
        viewportWidth
      );
      shell.classList.remove(styles.readerSwipeTracking);
      shell.classList.add(styles.readerSwipeSettling);
      shell.style.setProperty("--reader-swipe-duration", `${duration}ms`);
      void shell.offsetWidth;
      shell.style.setProperty("--reader-swipe-x", `${targetOffset}px`);
      pendingSwipeSettleRef.current = { generation, action };
      if (swipeSettleTimerRef.current !== null) {
        window.clearTimeout(swipeSettleTimerRef.current);
      }
      if (duration === 0) {
        void finishSwipeSettle(generation);
        return;
      }
      swipeSettleTimerRef.current = window.setTimeout(() => {
        void finishSwipeSettle(generation);
      }, duration + 120);
    };

    doc.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        syntheticClickToken = cancelEpubSyntheticClickToken();
        const shell = shellRef.current;
        let baseOffset = 0;
        if (shell) {
          const transform = window.getComputedStyle(shell).transform;
          if (transform !== "none") {
            try {
              baseOffset = new DOMMatrixReadOnly(transform).m41;
            } catch {
              baseOffset = 0;
            }
          }
          swipeSettleGenerationRef.current += 1;
          if (swipeSettleTimerRef.current !== null) {
            window.clearTimeout(swipeSettleTimerRef.current);
            swipeSettleTimerRef.current = null;
          }
          pendingSwipeSettleRef.current = null;
          shell.classList.remove(styles.readerSwipeSettling);
          shell.style.setProperty("--reader-swipe-x", `${baseOffset}px`);
        }
        touchStart = {
          x: touch.clientX,
          y: touch.clientY,
          time: Date.now(),
          target: event.target,
          axis: "pending",
          baseOffset,
          selectionText: getSelectionText(),
        };
        scrollIntentFired = false;
      },
      { passive: true }
    );

    doc.addEventListener(
      "touchmove",
      (event) => {
        const start = touchStart;
        const touch = event.touches[0];
        if (!start || !touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (
          start.axis === "pending" &&
          isScrollIntent({ deltaX: dx, deltaY: dy })
        ) {
          start.axis = absX > absY * 1.25 ? "horizontal" : "vertical";
        }

        if (start.axis === "horizontal") {
          const shell = shellRef.current;
          if (!shell) return;
          if (!scrollIntentFired) {
            scrollIntentFired = true;
            onReaderScrollStartRef.current?.();
            shell.classList.remove(styles.readerSwipeSettling);
            shell.classList.add(styles.readerSwipeTracking);
          }
          const viewportWidth = doc.documentElement.clientWidth || shell.clientWidth;
          const offset = getReaderSwipeVisualOffset(
            start.baseOffset + dx,
            viewportWidth
          );
          shell.style.setProperty("--reader-swipe-x", `${offset}px`);
          return;
        }

        if (start.axis === "vertical" && !scrollIntentFired) {
          scrollIntentFired = true;
          if (hasActiveReaderSwipeOffset(start.baseOffset)) {
            const shell = shellRef.current;
            settleSwipe(
              "none",
              start.baseOffset,
              doc.documentElement.clientWidth || shell?.clientWidth || 0
            );
            start.baseOffset = 0;
          }
          onReaderScrollStartRef.current?.();
        }
      },
      { passive: true }
    );

    doc.addEventListener(
      "touchend",
      (event) => {
        const start = touchStart;
        touchStart = null;
        const touch = event.changedTouches[0];
        if (!start || !touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (start.axis === "horizontal") {
          const action = getReaderSwipeAction({
            startX: start.x,
            startY: start.y,
            endX: touch.clientX,
            endY: touch.clientY,
          });
          const shell = shellRef.current;
          const viewportWidth =
            doc.documentElement.clientWidth || shell?.clientWidth || 0;
          const currentOffset = getReaderSwipeVisualOffset(
            start.baseOffset + dx,
            viewportWidth
          );
          settleSwipe(action, currentOffset, viewportWidth);
          return;
        }
        if (hasActiveReaderSwipeOffset(start.baseOffset)) {
          const shell = shellRef.current;
          settleSwipe(
            "none",
            start.baseOffset,
            doc.documentElement.clientWidth || shell?.clientWidth || 0
          );
        }
        const touchEndAt = Date.now();
        const touchEnd = resolveEpubTouchEnd({
          startSelectionText: start.selectionText,
          endSelectionText: getSelectionText(),
          isInteractiveTarget: isInteractiveTarget(start.target),
          scrollIntentFired,
          isTapGesture: isTapGesture({
            durationMs: Date.now() - start.time,
            deltaX: dx,
            deltaY: dy,
          }),
          target: start.target,
          at: touchEndAt,
        });
        syntheticClickToken = touchEnd.syntheticClickToken;
        if (touchEnd.fireTap) {
          clearSelectionForTap(touchEndAt);
          onReaderTapRef.current?.();
        }
      },
      { passive: true }
    );

    doc.addEventListener(
      "touchcancel",
      () => {
        const start = touchStart;
        touchStart = null;
        syntheticClickToken = cancelEpubSyntheticClickToken();
        const shell = shellRef.current;
        settleSwipe("none", start?.baseOffset ?? 0, shell?.clientWidth ?? 0);
      },
      { passive: true }
    );

    doc.addEventListener("selectionchange", reportSelectionChange);

    doc.addEventListener("click", (event) => {
      const clickResult = consumeEpubSyntheticClick({
        token: syntheticClickToken,
        target: event.target,
        at: Date.now(),
      });
      syntheticClickToken = clickResult.token;
      if (clickResult.suppress) return;
      fireReaderTap(event.target);
    });

    doc.addEventListener(
      "wheel",
      () => onReaderScrollStartRef.current?.(),
      { passive: true }
    );
  }, [finishSwipeSettle]);

  const handleRenderedContents = useCallback(
    (contents: unknown) => {
      applyEpubAmbientCanvas(contents);
      attachTapHandlers(contents);
    },
    [attachTapHandlers]
  );

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    setStatus("loading");
    setErrorMsg("");

    (async () => {
      try {
        const ePubModule = await import("epubjs");
        const ePub = ePubModule.default as unknown as () => EpubBook;
        if (cancelled) return;

        const bookSource = await fileBlob.arrayBuffer();
        if (cancelled) return;

        const book = ePub();
        bookRef.current = book;
        await book.open(bookSource, "binary");
        if (cancelled) return;

        const rendition = book.renderTo(
          container,
          getEpubRenditionOptions(mode)
        );
        renditionRef.current = rendition;
        appliedPreferenceStateRef.current = EMPTY_EPUB_PREFERENCE_STATE;

        rendition.on("relocated", handleRelocated);
        rendition.on("selected", handleSelected);
        rendition.on("rendered", (_section: unknown, view: unknown) => {
          const contents = (view as { contents?: unknown } | null)?.contents;
          handleRenderedContents(contents);
        });

        if (preferencesRef.current) {
          applyPreferences(rendition as Rendition, preferencesRef.current);
        }

        try {
          const navigation = await book.loaded?.navigation;
          if (!cancelled) {
            onTocChangeRef.current?.(normalizeEpubNavigation(navigation));
          }
        } catch {
          if (!cancelled) {
            onTocChangeRef.current?.([]);
          }
        }

        const savedPosition = await getReadingPosition(bookId);
        if (cancelled) return;

        const resumeLocator =
          latestLocatorRef.current ??
          (savedPosition?.locator !== "epub-unknown"
            ? savedPosition?.locator
            : undefined);
        if (resumeLocator) {
          await rendition.display(resumeLocator);
        } else {
          await rendition.display();
        }

        const renderedContents = (rendition as { getContents?: () => unknown }).getContents?.();
        if (Array.isArray(renderedContents)) {
          renderedContents.forEach(handleRenderedContents);
        } else {
          handleRenderedContents(renderedContents);
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            err instanceof Error ? err.message : UI_TEXT.ERROR_LOADING_EPUB
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (swipeSettleTimerRef.current !== null) {
        window.clearTimeout(swipeSettleTimerRef.current);
        swipeSettleTimerRef.current = null;
      }
      pendingSwipeSettleRef.current = null;
      if (pendingPositionRef.current) {
        void saveReadingPosition(pendingPositionRef.current);
        pendingPositionRef.current = null;
      }
      if (renditionRef.current) {
        const r = renditionRef.current as { off: (e: string, cb: unknown) => void; destroy: () => void };
        try {
          r.off("relocated", handleRelocated);
          r.off("selected", handleSelected);
          r.destroy();
        } catch {
          // epub.js can throw while destroying a partially initialized iframe.
        }
        renditionRef.current = null;
        appliedPreferenceStateRef.current = EMPTY_EPUB_PREFERENCE_STATE;
      }
      if (bookRef.current) {
        try {
          (bookRef.current as { destroy: () => void }).destroy();
        } catch {
          // Keep teardown best-effort; unreadable EPUBs should show an error, not crash the app.
        }
        bookRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [bookId, fileBlob, mode, getReadingPosition, saveReadingPosition, handleRelocated, handleSelected, handleRenderedContents, applyPreferences]);

  useEffect(() => {
    if (!renditionRef.current || !preferences) return;
    const rendition = renditionRef.current as Rendition;
    applyPreferences(rendition, preferences);
    applyRenderedCanvas(rendition);
  }, [
    preferences,
    applyPreferences,
    applyRenderedCanvas,
    systemThemeRevision,
  ]);

  return (
    <div
      ref={shellRef}
      className={styles.epubReaderShell}
      onTransitionEnd={handleSwipeTransitionEnd}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        ref={containerRef}
        className={styles.epubReaderViewport}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: mode === "paged" ? "hidden" : "auto",
          maxWidth: preferences?.contentWidth ? `${preferences.contentWidth}px` : undefined,
          margin: preferences?.contentWidth ? "0 auto" : undefined,
          width: "100%",
        }}
      />
      {status === "loading" && (
        <div style={{ padding: 16, textAlign: "center", color: "var(--muted)" }}>
          {UI_TEXT.LOADING_EPUB}
        </div>
      )}
      {status === "error" && (
        <div style={{ padding: 16, textAlign: "center", color: "#e74c3c" }}>
          {errorMsg || UI_TEXT.ERROR_LOADING_EPUB}
        </div>
      )}
    </div>
  );
});

export default EpubReader;
