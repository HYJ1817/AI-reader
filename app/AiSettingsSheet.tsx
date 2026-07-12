"use client";

import { useState } from "react";
import type { AiProviderSettings } from "@/lib/aiProviders";
import AiSettingsSurface from "./AiSettingsSurface";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";

type Props = {
  settings: AiProviderSettings;
  onSave: (settings: AiProviderSettings) => void;
  onClose: () => void;
};

export default function AiSettingsSheet({ settings, onSave, onClose }: Props) {
  const [route, setRoute] = useState<{
    mode: "list" | "configure";
    providerId?: string;
  }>(() => ({
    mode: settings.providers.length > 0 ? "list" : "configure",
  }));

  return (
    <BottomSheet
      onClose={onClose}
      className={styles.providerSheet}
      ariaLabel="AI 服务商"
      showGrabber={false}
    >
      {(close) => (
        <AiSettingsSurface
          mode={route.mode}
          settings={settings}
          providerId={route.providerId}
          onPushConfigure={(providerId) =>
            setRoute({ mode: "configure", providerId })
          }
          onBack={() => {
            if (route.mode === "configure" && settings.providers.length > 0) {
              setRoute({ mode: "list" });
              return;
            }
            close();
          }}
          onSave={onSave}
        />
      )}
    </BottomSheet>
  );
}
