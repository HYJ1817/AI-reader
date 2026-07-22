"use client";

import { useEffect, useRef } from "react";
import { m } from "motion/react";
import type { BookMetadata } from "@/lib/db";
import { bookCoverLayoutId } from "@/lib/sharedBookTransition";
import { MOTION_SPRING } from "@/lib/motionSystem";
import BookCover from "./BookCover";
import { useAppReducedMotion } from "./AppMotionRoot";
import { useSharedBookSource } from "./SharedBookTransition";
import styles from "./page.module.css";

export { bookCoverLayoutId } from "@/lib/sharedBookTransition";

type MotionBookCoverProps = {
  book: BookMetadata;
  originId: string;
};

export default function MotionBookCover({
  book,
  originId,
}: MotionBookCoverProps) {
  const reduceMotion = useAppReducedMotion();
  const { registerSource, setSourceVisibility } = useSharedBookSource();
  const sourceRef = useRef<HTMLDivElement>(null);
  const layoutId = bookCoverLayoutId(originId);

  useEffect(() => {
    const element = sourceRef.current;
    if (!element) return;

    const unregister = registerSource(originId, book.id, element);
    const Observer = window.IntersectionObserver;
    if (!Observer) {
      setSourceVisibility(originId, true);
      return unregister;
    }

    const observer = new Observer((entries) => {
      const entry = entries[0];
      setSourceVisibility(
        originId,
        Boolean(entry?.isIntersecting && entry.intersectionRatio > 0)
      );
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      unregister();
    };
  }, [book.id, originId, registerSource, setSourceVisibility]);

  return (
    <m.div
      ref={sourceRef}
      className={styles.motionBookCover}
      layoutId={reduceMotion ? undefined : layoutId}
      layout={reduceMotion ? false : "position"}
      transition={MOTION_SPRING.sharedBook}
      data-book-cover-origin={originId}
      data-book-id={book.id}
      tabIndex={-1}
    >
      <BookCover
        title={book.title}
        format={book.format}
        coverImageBlob={book.coverImageBlob}
      />
    </m.div>
  );
}
