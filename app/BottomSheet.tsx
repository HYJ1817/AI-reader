"use client";

import MotionSheet from "./MotionSheet";
import type { MotionSheetProps } from "./MotionSheet";

export type { CloseSheet } from "./MotionSheet";

type Props = MotionSheetProps;

export default function BottomSheet(props: Props) {
  return <MotionSheet {...props} />;
}
