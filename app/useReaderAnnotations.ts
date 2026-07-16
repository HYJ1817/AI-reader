"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addAnnotation,
  deleteAnnotation,
  listAnnotations,
  type AnnotationRecord,
  type HighlightColor,
} from "@/lib/db";
import { createLocalId } from "@/lib/localId";
import {
  findBookmarkAtSnapshot,
  partitionAnnotations,
  upsertHighlightRecord,
  type ReaderLocationSnapshot,
  type ReaderTextSelection,
} from "@/lib/readerAnnotations";

const LAST_HIGHLIGHT_COLOR_KEY = "ai-reader-last-highlight-color";

function loadLastColor(): HighlightColor {
  if (typeof window === "undefined") return "yellow";
  const value = window.localStorage.getItem(LAST_HIGHLIGHT_COLOR_KEY);
  return value === "green" || value === "blue" ? value : "yellow";
}

export type UseReaderAnnotationsResult = {
  records: AnnotationRecord[];
  bookmarks: AnnotationRecord[];
  highlights: AnnotationRecord[];
  selection: ReaderTextSelection | null;
  setSelection: (selection: ReaderTextSelection | null) => void;
  lastColor: HighlightColor;
  currentBookmark: AnnotationRecord | null;
  setCurrentSnapshot: (snapshot: ReaderLocationSnapshot | null) => void;
  toggleBookmark: () => Promise<void>;
  saveHighlight: (color: HighlightColor) => Promise<void>;
  remove: (id: string) => Promise<void>;
  error: string | null;
  status: string | null;
};

export default function useReaderAnnotations(
  bookId: string | null
): UseReaderAnnotationsResult {
  const [records, setRecords] = useState<AnnotationRecord[]>([]);
  const [selection, setSelection] = useState<ReaderTextSelection | null>(null);
  const [currentSnapshot, setCurrentSnapshot] =
    useState<ReaderLocationSnapshot | null>(null);
  const [lastColor, setLastColor] = useState<HighlightColor>(loadLastColor);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const loadGenerationRef = useRef(0);

  useEffect(() => {
    const generation = ++loadGenerationRef.current;
    const pendingRecords = bookId ? listAnnotations(bookId) : Promise.resolve([]);
    void pendingRecords
      .then((nextRecords) => {
        if (loadGenerationRef.current !== generation) return;
        setRecords(nextRecords);
        setSelection(null);
        setCurrentSnapshot(null);
        setError(null);
        setStatus(null);
      })
      .catch((cause) => {
        if (loadGenerationRef.current !== generation) return;
        setRecords([]);
        setError(cause instanceof Error ? cause.message : "无法读取书签和高亮");
      });
  }, [bookId]);

  const { bookmarks, highlights } = useMemo(
    () => partitionAnnotations(records),
    [records]
  );
  const currentBookmark = useMemo(
    () => findBookmarkAtSnapshot(records, currentSnapshot),
    [currentSnapshot, records]
  );

  const toggleBookmark = useCallback(async () => {
    if (!bookId || !currentSnapshot) return;
    setError(null);
    try {
      if (currentBookmark) {
        await deleteAnnotation(currentBookmark.id);
        setRecords((current) =>
          current.filter((record) => record.id !== currentBookmark.id)
        );
        setStatus("已移除本页书签");
        return;
      }
      const record: AnnotationRecord = {
        id: createLocalId(),
        bookId,
        kind: "bookmark",
        locator: currentSnapshot.locator,
        text: currentSnapshot.text,
        progressPercent: currentSnapshot.progressPercent,
        ...(currentSnapshot.pageNumber
          ? { pageNumber: currentSnapshot.pageNumber }
          : {}),
        createdAt: new Date().toISOString(),
      };
      await addAnnotation(record);
      setRecords((current) => [...current, record]);
      setStatus("已添加书签");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "书签保存失败");
    }
  }, [bookId, currentBookmark, currentSnapshot]);

  const saveHighlight = useCallback(
    async (color: HighlightColor) => {
      if (!bookId || !selection?.locator || !selection.text) return;
      setError(null);
      const existing = records.find(
        (record) =>
          record.kind === "highlight" && record.locator === selection.locator
      );
      const record: AnnotationRecord = {
        id: existing?.id ?? createLocalId(),
        bookId,
        kind: "highlight",
        locator: selection.locator,
        text: selection.text,
        color,
        progressPercent: selection.progressPercent,
        ...(selection.pageNumber ? { pageNumber: selection.pageNumber } : {}),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      try {
        await addAnnotation(record);
        setRecords((current) => upsertHighlightRecord(current, record));
        setLastColor(color);
        window.localStorage.setItem(LAST_HIGHLIGHT_COLOR_KEY, color);
        setSelection(null);
        setStatus(existing ? "已更新高亮颜色" : "已添加高亮");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "高亮保存失败");
      }
    },
    [bookId, records, selection]
  );

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      await deleteAnnotation(id);
      setRecords((current) => current.filter((record) => record.id !== id));
      setStatus("已删除标记");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    }
  }, []);

  return {
    records,
    bookmarks,
    highlights,
    selection,
    setSelection,
    lastColor,
    currentBookmark,
    setCurrentSnapshot,
    toggleBookmark,
    saveHighlight,
    remove,
    error,
    status,
  };
}
