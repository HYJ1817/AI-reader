"use client";

import { useEffect, useMemo } from "react";
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
  const coverUrl = useMemo(
    () => (coverImageBlob ? URL.createObjectURL(coverImageBlob) : null),
    [coverImageBlob]
  );
  const hash = hashString(title + format);
  const bg = PALETTE[hash % PALETTE.length];
  const label = format.toUpperCase();

  useEffect(() => {
    if (!coverUrl) return;
    return () => URL.revokeObjectURL(coverUrl);
  }, [coverUrl]);

  return (
    <div className={styles.bookCover} style={{ background: bg }}>
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
