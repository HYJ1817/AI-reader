"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type RunningTask = {
  generation: number;
  controller: AbortController;
  promise: Promise<BookEnrichmentResult | undefined>;
};

type UseBookMetadataEnrichmentOptions = {
  aiProvider: AiProviderConfig | null;
  onMetadataChanged: (books: BookMetadata[]) => void;
};

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error("Metadata request failed");
  return (await response.json()) as T;
}

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
  onMetadataChanged,
}: UseBookMetadataEnrichmentOptions) {
  const tasksRef = useRef(new Map<string, RunningTask>());
  const generationRef = useRef(0);
  const [, setRevision] = useState(0);

  useEffect(() => {
    const tasks = tasksRef.current;
    return () => {
      for (const task of tasks.values()) task.controller.abort();
      tasks.clear();
    };
  }, []);

  const run = useCallback(
    (book: BookMetadata, mode: BookMetadataEnrichmentMode) => {
      const existing = tasksRef.current.get(book.id);
      if (existing) return existing.promise;

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
            setRevision((value) => value + 1);
          }
        });

      tasksRef.current.set(book.id, { generation, controller, promise });
      setRevision((value) => value + 1);
      return promise;
    },
    [aiProvider, onMetadataChanged]
  );

  const isRunning = useCallback(
    (bookId: string) => tasksRef.current.has(bookId),
    []
  );

  return { run, isRunning };
}
