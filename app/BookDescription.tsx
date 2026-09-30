"use client";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./BookDetailsRefinement.module.css";

export default function BookDescription({ text, aiGenerated }: { text: string; aiGenerated: boolean }) {
  const id = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      setOverflows(element.scrollHeight > lineHeight * 6 + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [text]);
  return <>
    {aiGenerated && <p className={styles.provenance}>AI 生成 · 请结合原书判断</p>}
    <p ref={textRef} id={id} className={!expanded ? styles.clamped : undefined}>{text}</p>
    {overflows && <button ref={buttonRef} className={styles.textAction} aria-expanded={expanded} aria-controls={id} onClick={() => {
      const button = buttonRef.current;
      const scroller = button?.closest<HTMLElement>('[data-push-route="book-details"]');
      const top = button?.getBoundingClientRect().top;
      setExpanded((value) => !value);
      if (expanded && scroller && top !== undefined) requestAnimationFrame(() => {
        const nextTop = button?.getBoundingClientRect().top;
        if (nextTop !== undefined) scroller.scrollTop += nextTop - top;
      });
    }}>{expanded ? "收起简介" : "展开简介"}</button>}
  </>;
}
