"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReadingPosition } from "@/lib/db";
import { progressPercentFromEpubLocation } from "@/lib/epubProgress";
import { normalizeEpubNavigation } from "@/lib/epubNavigation";
import type { EpubTocItem } from "@/lib/epubNavigation";
import type { ReaderPreferences } from "@/lib/readerPreferences";
import { UI_TEXT } from "@/lib/uiText";
import type { Rendition } from "epubjs";

export type EpubReaderHandle = {
  next: () => Promise<void>;
  prev: () => Promise<void>;
  goTo: (href: string) => Promise<void>;
};

type EpubReaderProps = {
  bookId: string;
  fileBlob: Blob;
  getReadingPosition: (bookId: string) => Promise<ReadingPosition | undefined>;
  saveReadingPosition: (position: ReadingPosition) => Promise<void>;
  onTextSelect?: (text: string) => void;
  onTocChange?: (items: EpubTocItem[]) => void;
  onProgressChange?: (progressPercent: number) => void;
  preferences?: ReaderPreferences;
};

type EpubBook = {
  renderTo: (
    element: HTMLElement,
    options: { width: string; height: string; spread: string }
  ) => Rendition;
  loaded?: { navigation?: unknown };
  getRange?: (cfiRange: string) => Range | null | undefined;
  destroy: () => void;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read EPUB"));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

const EpubReader = forwardRef<EpubReaderHandle, EpubReaderProps>(function EpubReader(
  {
    bookId,
    fileBlob,
    getReadingPosition,
    saveReadingPosition,
    onTextSelect,
    onTocChange,
    onProgressChange,
    preferences,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const renditionRef = useRef<unknown>(null);
  const bookRef = useRef<unknown>(null);
  const objectUrlRef = useRef<string | null>(null);
  const bookIdRef = useRef(bookId);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    bookIdRef.current = bookId;
  }, [bookId]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

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

  const applyPreferences = useCallback(
    (r: Rendition, prefs: ReaderPreferences) => {
      const root = containerRef.current ?? document.documentElement;
      const cs = getComputedStyle(root);
      const fg = cs.getPropertyValue("--foreground").trim() || "#1a1a1a";
      const bg = cs.getPropertyValue("--background").trim() || "#ffffff";

      r.themes.register("reader-prefs", {
        "body": `color: ${fg} !important; background: ${bg} !important;`,
        "p, div, span, li, h1, h2, h3, h4, h5, h6": `color: ${fg} !important;`,
      });
      r.themes.select("reader-prefs");
      r.themes.override("font-size", `${prefs.fontSizePx}px`);
      r.themes.override("line-height", String(prefs.lineHeight));
    },
    []
  );

  const handleRelocated = useCallback(
    (location: unknown) => {
      const currentBookId = bookIdRef.current;
      const percent = progressPercentFromEpubLocation(location);
      const cfi =
        location &&
        typeof location === "object" &&
        "start" in location &&
        (location as Record<string, unknown>).start &&
        typeof (location as Record<string, unknown>).start === "object"
          ? ((location as Record<string, unknown>).start as Record<string, unknown>).cfi
          : undefined;

      saveReadingPosition({
        bookId: currentBookId,
        locator: typeof cfi === "string" ? cfi : "epub-unknown",
        progressPercent: percent,
        updatedAt: new Date().toISOString(),
      });

      onProgressChange?.(percent);
    },
    [saveReadingPosition, onProgressChange]
  );

  const handleSelected = useCallback(
    (cfiRange: unknown, contents: unknown) => {
      if (!onTextSelect) return;
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
          onTextSelect(trimmedText);
        }
      } catch {
        // ignore selection read errors
      }
    },
    [onTextSelect]
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
        const ePub = ePubModule.default as unknown as (
          input: string,
          options?: { encoding?: "base64" }
        ) => Promise<EpubBook>;
        if (cancelled) return;

        const bookSource = await blobToBase64(fileBlob);
        if (cancelled) return;

        const book = await ePub(bookSource, { encoding: "base64" });
        bookRef.current = book;

        const rendition = book.renderTo(container, {
          width: "100%",
          height: "100%",
          spread: "none",
        });
        renditionRef.current = rendition;

        rendition.on("relocated", handleRelocated);
        rendition.on("selected", handleSelected);

        try {
          const navigation = await book.loaded?.navigation;
          if (!cancelled) {
            onTocChange?.(normalizeEpubNavigation(navigation));
          }
        } catch {
          if (!cancelled) {
            onTocChange?.([]);
          }
        }

        const savedPosition = await getReadingPosition(bookId);
        if (cancelled) return;

        if (savedPosition?.locator && savedPosition.locator !== "epub-unknown") {
          await rendition.display(savedPosition.locator);
        } else {
          await rendition.display();
        }

        if (!cancelled && preferencesRef.current) {
          applyPreferences(rendition as Rendition, preferencesRef.current);
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
      if (renditionRef.current) {
        const r = renditionRef.current as { off: (e: string, cb: unknown) => void; destroy: () => void };
        r.off("relocated", handleRelocated);
        r.off("selected", handleSelected);
        r.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        (bookRef.current as { destroy: () => void }).destroy();
        bookRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [bookId, fileBlob, getReadingPosition, handleRelocated, handleSelected, onTocChange, applyPreferences]);

  useEffect(() => {
    if (!renditionRef.current || !preferences) return;
    applyPreferences(renditionRef.current as Rendition, preferences);
  }, [preferences, applyPreferences]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
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
