"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  getBookFile,
  listBookMetadata,
  updateBookEnrichment,
  type BookMetadata,
} from "@/lib/db";
import { extractOpeningExcerpt } from "@/lib/epubPackage";
import {
  enrichBookMetadata,
  type BookEnrichmentResult,
  type BookMetadataEnrichmentMode,
  type MetadataAiCompletionRequest,
  type MetadataAiCompletionResponse,
} from "@/lib/bookMetadataEnrichment";
import type { PublicBookMetadataSearchResult } from "@/lib/bookMetadataSearch";
import type {
  BookMetadataSearchInput,
  NormalizedBookCandidate,
} from "@/lib/bookMetadataProviders";
import { hasUsableAiProvider, type AiProviderConfig } from "@/lib/aiProviders";
import { captureAutoAiMetadataAuthorization } from "@/lib/appPreferences";
import { metadataResponseJson as responseJson } from "@/lib/bookMetadataResponse";
import useUpdateProtection from "./useUpdateProtection";

type RunningTask = {
  generation: number;
  controller: AbortController;
  promise: Promise<BookEnrichmentResult | undefined>;
};

type UseBookMetadataEnrichmentOptions = {
  aiProvider: AiProviderConfig | null;
  autoAiMetadata: boolean;
  onMetadataChanged: (books: BookMetadata[]) => void;
};

async function searchPublic(
  input: BookMetadataSearchInput,
  signal: AbortSignal
): Promise<PublicBookMetadataSearchResult> {
  return responseJson(
    await fetch("/api/book-metadata/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    })
  );
}

async function downloadCover(
  coverRef: NonNullable<NormalizedBookCandidate["coverRef"]>,
  signal: AbortSignal
): Promise<Blob | undefined> {
  const query = new URLSearchParams({ source: coverRef.source, id: coverRef.id });
  const response = await fetch(`/api/book-metadata/cover?${query}`, { signal });
  if (!response.ok) return undefined;
  return response.blob();
}

async function completeWithAi(
  request: MetadataAiCompletionRequest,
  signal: AbortSignal
): Promise<MetadataAiCompletionResponse> {
  return responseJson(
    await fetch("/api/book-metadata/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    })
  );
}

export default function useBookMetadataEnrichment({
  aiProvider,
  autoAiMetadata,
  onMetadataChanged,
}: UseBookMetadataEnrichmentOptions) {
  const tasksRef = useRef(new Map<string, RunningTask>());
  const generationRef = useRef(0);
  const [runningTaskCount, setRunningTaskCount] = useState(0);
  const autoAiMetadataRef = useRef(autoAiMetadata);

  useLayoutEffect(() => {
    autoAiMetadataRef.current = autoAiMetadata;
  }, [autoAiMetadata]);

  useEffect(() => {
    const tasks = tasksRef.current;
    return () => {
      for (const task of tasks.values()) task.controller.abort();
      tasks.clear();
    };
  }, []);

  const run = useCallback(
    (
      book: BookMetadata,
      mode: BookMetadataEnrichmentMode,
      { singleBookAiConsent = false }: { singleBookAiConsent?: boolean } = {}
    ) => {
      const existing = tasksRef.current.get(book.id);
      if (existing) return existing.promise;

      // Capture before the promise microtask: a later opt-in cannot authorize old work.
      const authorizedAtStart = autoAiMetadataRef.current;
      const hasCurrentAuthorization = captureAutoAiMetadataAuthorization();
      const isAiAuthorized = () => authorizedAtStart &&
        autoAiMetadataRef.current && hasCurrentAuthorization();

      const generation = ++generationRef.current;
      const controller = new AbortController();
      const isCurrent = () => {
        const task = tasksRef.current.get(book.id);
        return task?.generation === generation && !controller.signal.aborted;
      };
      const promise = Promise.resolve()
        .then(() =>
          enrichBookMetadata(book, mode, {
            now: () => new Date().toISOString(),
            searchPublic,
            downloadCover,
            getBookFile,
            extractOpeningExcerpt,
            completeWithAi,
            updateBookEnrichment,
            aiProvider: aiProvider ?? undefined,
            aiUsable: hasUsableAiProvider(aiProvider),
            isAiAuthorized,
            singleBookAiConsent,
            shouldCommit: isCurrent,
            signal: controller.signal,
          })
        )
        .then(async (result) => {
          if (result.committed && isCurrent()) {
            onMetadataChanged(await listBookMetadata());
          }
          return result;
        })
        .catch(() => undefined)
        .finally(() => {
          if (tasksRef.current.get(book.id)?.generation === generation) {
            tasksRef.current.delete(book.id);
            setRunningTaskCount(tasksRef.current.size);
          }
        });

      tasksRef.current.set(book.id, { generation, controller, promise });
      setRunningTaskCount(tasksRef.current.size);
      return promise;
    },
    [aiProvider, onMetadataChanged]
  );

  const isRunning = useCallback(
    (bookId: string) => tasksRef.current.has(bookId),
    []
  );

  const cancelAndDrain = useCallback(async () => {
    const tasks = [...tasksRef.current.values()];
    for (const task of tasks) task.controller.abort();
    await Promise.all(tasks.map((task) => task.promise));
  }, []);

  useUpdateProtection({
    busy: runningTaskCount > 0,
    stop: cancelAndDrain,
    label: "书籍信息补全",
  });

  return { run, isRunning, cancelAndDrain };
}
