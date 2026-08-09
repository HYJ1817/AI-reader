"use client";

import type { BookMetadata } from "@/lib/db";
import { UI_TEXT } from "@/lib/uiText";

export type BookDetailsSurfaceProps = {
  book: BookMetadata;
  progressPercent: number;
  lastReadAt?: string;
  originId?: string;
  metadataRunning: boolean;
  onBack: () => void;
  onRead: (originId: string) => void;
  onOpenContents: (originId: string) => void;
  onEnrich: (mode: "automatic" | "manual") => void;
};

export default function BookDetailsSurface({
  book,
  progressPercent,
  metadataRunning,
  onBack,
  onRead,
}: BookDetailsSurfaceProps) {
  return (
    <section data-book-details="true" data-push-route="book-details">
      <button type="button" onClick={onBack} aria-label={UI_TEXT.BACK}>
        {UI_TEXT.BACK}
      </button>
      <h1>{book.enrichment?.bibliographicTitle ?? book.title}</h1>
      <p aria-live="polite">
        {metadataRunning ? UI_TEXT.METADATA_PENDING : `${UI_TEXT.READING_PROGRESS} ${progressPercent}%`}
      </p>
      <button
        type="button"
        onClick={() => onRead(`book-details-${book.id}`)}
      >
        {progressPercent > 0 ? UI_TEXT.CONTINUE_READING : UI_TEXT.START_READING}
      </button>
    </section>
  );
}
