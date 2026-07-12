"use client";

import type { ComponentProps } from "react";
import type { PushEntry } from "@/lib/appNavigation";
import AiSettingsSurface from "./AiSettingsSurface";
import CustomBackgroundSettingsSurface from "./CustomBackgroundSettingsSurface";
import LibraryCollectionsSurface from "./LibraryCollectionsSurface";

type Props = {
  entry: PushEntry;
  data: {
    collections: Omit<
      ComponentProps<typeof LibraryCollectionsSurface>,
      "onBack"
    >;
    ai: Omit<
      ComponentProps<typeof AiSettingsSurface>,
      "mode" | "providerId" | "onBack" | "onPushConfigure"
    >;
    background: Omit<
      ComponentProps<typeof CustomBackgroundSettingsSurface>,
      "onBack"
    >;
  };
  actions: {
    pop: () => void;
    pushAiProvider: (providerId?: string) => void;
  };
};

export default function AppPushSurfaces({ entry, data, actions }: Props) {
  switch (entry.route) {
    case "collections":
      return (
        <LibraryCollectionsSurface
          {...data.collections}
          onBack={actions.pop}
        />
      );
    case "ai-providers":
      return (
        <AiSettingsSurface
          mode="list"
          {...data.ai}
          onPushConfigure={actions.pushAiProvider}
          onBack={actions.pop}
        />
      );
    case "ai-provider-configure":
      return (
        <AiSettingsSurface
          mode="configure"
          providerId={entry.entityId}
          {...data.ai}
          onPushConfigure={actions.pushAiProvider}
          onBack={actions.pop}
        />
      );
    case "custom-background":
      return (
        <CustomBackgroundSettingsSurface
          {...data.background}
          onBack={actions.pop}
        />
      );
  }

  entry.route satisfies never;
  return null;
}
