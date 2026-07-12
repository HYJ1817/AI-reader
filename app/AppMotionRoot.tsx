"use client";

import { domAnimation, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export default function AppMotionRoot({ reduceMotion, children }: { reduceMotion: boolean; children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <LayoutGroup id="ai-reader-app">{children}</LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
