"use client";

import { AnimatePresence, m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import { MOTION_DURATION } from "@/lib/motionSystem";

export default function AnimatedNumber({ value }: { value: number }) {
  const reduceMotion = useAppReducedMotion();

  return (
    <span
      aria-label={String(value)}
      style={{ display: "inline-grid", fontVariantNumeric: "tabular-nums" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={value}
          aria-hidden="true"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -3 }}
          transition={{
            duration: reduceMotion
              ? MOTION_DURATION.reduced
              : MOTION_DURATION.state,
          }}
          style={{ gridArea: "1 / 1" }}
        >
          {value}
        </m.span>
      </AnimatePresence>
    </span>
  );
}
