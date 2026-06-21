"use client";

import { useEffect, useRef, useState } from "react";
import { acquireBlobUrl, releaseBlobUrl } from "@/lib/blobUrlCache";
import {
  BOOK_COVER_OBSERVER_MARGIN,
  shouldLoadBookCover,
} from "@/lib/bookCoverLoading";
import styles from "./page.module.css";

const PALETTE = [
  "#1e3a5f",
  "#4a2c5e",
  "#2d4a3e",
  "#5c3d2e",
  "#2e3d5c",
  "#5c2e3d",
  "#3d5c2e",
  "#2e5c5c",
  "#5c2e2e",
  "#3d2e5c",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

interface BookCoverProps {
  title: string;
  format: string;
  coverImageBlob?: Blob;
}

export default function BookCover({ title, format, coverImageBlob }: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const coverRef = useRef<HTMLDivElement>(null);
  const hash = hashString(title + format);
  const bg = PALETTE[hash % PALETTE.length];
  const label = format.toUpperCase();

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
    <div ref={coverRef} className={styles.bookCover} style={{ background: bg }}>
      {coverUrl ? (
        <span
          className={styles.bookCoverImage}
          style={{ backgroundImage: `url(${coverUrl})` }}
          aria-hidden="true"
        />
      ) : (
        <span className={styles.bookCoverLabel}>{label}</span>
      )}
    </div>
  );
}
