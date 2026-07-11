"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import type { AppPreferences, BackgroundMode } from "@/lib/appPreferences";
import { hasIndexedDbSupport } from "@/lib/browserStorage";
import {
  deleteCustomBackgroundImage,
  getCustomBackgroundImage,
  saveCustomBackgroundImage,
} from "@/lib/db";

export type CustomBackgroundControls = {
  backgroundInputRef: RefObject<HTMLInputElement | null>;
  customBackgroundBlob: Blob | null;
  customBackgroundPreviewUrl: string | null;
  customBackgroundAvailable: boolean;
  handleBackgroundModeChange: (mode: BackgroundMode) => void;
  reloadCustomBackground: () => Promise<void>;
  handleCustomBackgroundImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleClearCustomBackground: () => Promise<void>;
};

export default function useCustomBackground(
  onPreferencesChange: (next: Partial<AppPreferences>) => void
): CustomBackgroundControls {
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const customBackgroundPreviewUrlRef = useRef<string | null>(null);
  const [customBackgroundBlob, setCustomBackgroundBlob] = useState<Blob | null>(null);
  const [customBackgroundPreviewUrl, setCustomBackgroundPreviewUrl] = useState<string | null>(null);

  const setCustomBackground = useCallback((blob: Blob | null) => {
    if (customBackgroundPreviewUrlRef.current) {
      URL.revokeObjectURL(customBackgroundPreviewUrlRef.current);
      customBackgroundPreviewUrlRef.current = null;
    }
    const previewUrl = blob ? URL.createObjectURL(blob) : null;
    customBackgroundPreviewUrlRef.current = previewUrl;
    setCustomBackgroundBlob(blob);
    setCustomBackgroundPreviewUrl(previewUrl);
  }, []);

  const reloadCustomBackground = useCallback(async () => {
    if (!hasIndexedDbSupport(window)) {
      setCustomBackground(null);
      return;
    }
    try {
      setCustomBackground(await getCustomBackgroundImage());
    } catch {
      setCustomBackground(null);
    }
  }, [setCustomBackground]);

  useEffect(() => {
    let cancelled = false;
    if (!hasIndexedDbSupport(window)) return;
    getCustomBackgroundImage()
      .then((blob) => {
        if (!cancelled) setCustomBackground(blob);
      })
      .catch(() => {
        if (!cancelled) setCustomBackground(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setCustomBackground]);

  useEffect(() => {
    return () => {
      if (customBackgroundPreviewUrlRef.current) {
        URL.revokeObjectURL(customBackgroundPreviewUrlRef.current);
        customBackgroundPreviewUrlRef.current = null;
      }
    };
  }, []);

  function handleBackgroundModeChange(mode: BackgroundMode) {
    onPreferencesChange({ backgroundMode: mode });
  }

  async function handleCustomBackgroundImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!hasIndexedDbSupport(window) || !file.type.startsWith("image/")) {
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
      return;
    }
    await saveCustomBackgroundImage(file);
    setCustomBackground(file);
    onPreferencesChange({ backgroundMode: "custom" });
    if (backgroundInputRef.current) backgroundInputRef.current.value = "";
  }

  async function handleClearCustomBackground() {
    if (hasIndexedDbSupport(window)) {
      await deleteCustomBackgroundImage();
    }
    setCustomBackground(null);
    onPreferencesChange({ backgroundMode: "auto" });
  }

  return {
    backgroundInputRef,
    customBackgroundBlob,
    customBackgroundPreviewUrl,
    customBackgroundAvailable: customBackgroundBlob !== null,
    reloadCustomBackground,
    handleBackgroundModeChange,
    handleCustomBackgroundImport,
    handleClearCustomBackground,
  };
}
