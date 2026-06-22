"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { acquireBlobUrl, releaseBlobUrl } from "@/lib/blobUrlCache";
import {
  createFallbackCoverStyle,
  normalizeCoverTitle,
} from "@/lib/bookCoverStyle";
import {
  BOOK_COVER_OBSERVER_MARGIN,
  shouldLoadBookCover,
} from "@/lib/bookCoverLoading";
import styles from "./page.module.css";

interface BookCoverProps {
  title: string;
  format: string;
  coverImageBlob?: Blob;
}

export default function BookCover({ title, format, coverImageBlob }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  const fallbackStyle = createFallbackCoverStyle(title, format);
  const normalizedTitle = normalizeCoverTitle(title);

  useEffect(() => {
    if (!coverImageBlob) return;
    const Observer = (
      window as Window & {
        IntersectionObserver?: typeof IntersectionObserver;
      }
    ).IntersectionObserver;
    if (!Observer) {
      const frame = window.requestAnimationFrame(() => setNearViewport(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const target = coverRef.current;
    if (!target) return;
    const observer = new Observer(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: BOOK_COVER_OBSERVER_MARGIN }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [coverImageBlob]);

  const observerSupported =
    typeof window !== "undefined" &&
    Boolean(
      (
        window as Window & {
          IntersectionObserver?: typeof IntersectionObserver;
        }
      ).IntersectionObserver
    );
  const shouldLoad = shouldLoadBookCover({
    hasCoverBlob: Boolean(coverImageBlob),
    observerSupported,
    nearViewport,
  });

  useEffect(() => {
    if (!coverImageBlob || !shouldLoad) {
      const frame = window.requestAnimationFrame(() => setCoverUrl(null));
      return () => window.cancelAnimationFrame(frame);
    }
    const nextUrl = acquireBlobUrl(coverImageBlob);
    const frame = window.requestAnimationFrame(() => setCoverUrl(nextUrl));
    return () => {
      window.cancelAnimationFrame(frame);
      releaseBlobUrl(coverImageBlob);
    };
  }, [coverImageBlob, shouldLoad]);

  return (
    <div
      ref={coverRef}
      className={`${styles.bookCover} ${
        coverUrl ? styles.bookCoverReal : styles.bookCoverFallback
      }`}
      style={
        {
          "--cover-paper": fallbackStyle.paper,
          "--cover-spine": fallbackStyle.spine,
        } as CSSProperties
      }
    >
      {coverUrl ? (
        <span
          className={styles.bookCoverImage}
          style={{ backgroundImage: `url(${coverUrl})` }}
          aria-hidden="true"
        />
      ) : (
        <>
          <span className={styles.bookCoverSpine} aria-hidden="true" />
          <span className={styles.bookCoverTitle}>{normalizedTitle}</span>
          <span className={styles.bookCoverFormat}>{format.toUpperCase()}</span>
        </>
      )}
    </div>
  );
}
