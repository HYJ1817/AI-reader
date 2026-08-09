"use client";

import { useState } from "react";
import MotionSheet from "./MotionSheet";
import type { MotionSheetProps } from "./MotionSheet";

export type { CloseSheet } from "./MotionSheet";

type Props = Omit<
  MotionSheetProps,
  "open" | "stackDepth" | "onRequestClose" | "onExitComplete"
> & {
  onClose: () => void;
};

export default function BottomSheet({ onClose, ...props }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <MotionSheet
      {...props}
      open={open}
      onRequestClose={() => setOpen(false)}
      onExitComplete={onClose}
    />
  );
}
