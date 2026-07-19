"use client";

import type { ComponentProps } from "react";
import BottomSheet from "./BottomSheet";
import CustomBackgroundSettingsSurface from "./CustomBackgroundSettingsSurface";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

type Props = Omit<
  ComponentProps<typeof CustomBackgroundSettingsSurface>,
  "onBack"
> & {
  onClose: () => void;
};

export default function CustomBackgroundSettingsSheet({
  onClose,
  ...surfaceProps
}: Props) {
  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.BACKGROUND_CUSTOM}
      className={styles.customBackgroundSettingsSheet}
    >
      {(close) => (
        <CustomBackgroundSettingsSurface
          {...surfaceProps}
          onBack={() => close()}
        />
      )}
    </BottomSheet>
  );
}
