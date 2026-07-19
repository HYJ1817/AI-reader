"use client";

import { useEffect } from "react";

const BUILD_ID_STORAGE_KEY = "ai-reader-build-id";
const BUILD_ID_CHECK_INTERVAL_MS = 60_000;

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .then(() => {
          if ("caches" in window) {
            return caches
              .keys()
              .then((keys) =>
                Promise.all(
                  keys
                    .filter((key) => key.startsWith("ai-reader-"))
                    .map((key) => caches.delete(key))
                )
              );
          }
          return undefined;
        })
        .catch(() => {
          // Development cleanup is best-effort.
        });
      return;
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let checkingBuildId = false;
    const handleControllerChange = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };
    const checkForNewBuild = async () => {
      if (reloading || checkingBuildId || document.visibilityState === "hidden") {
        return;
      }
      checkingBuildId = true;
      try {
        const response = await fetch("/BUILD_ID", { cache: "no-store" });
        if (!response.ok) return;
        const buildId = (await response.text()).trim();
        if (!buildId) return;
        const previousBuildId = sessionStorage.getItem(BUILD_ID_STORAGE_KEY);
        sessionStorage.setItem(BUILD_ID_STORAGE_KEY, buildId);
        if (previousBuildId && previousBuildId !== buildId) {
          reloading = true;
          window.location.reload();
        }
      } catch {
        // Version checks are opportunistic; offline reading must remain usable.
      } finally {
        checkingBuildId = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForNewBuild();
    };
    const handleFocus = () => void checkForNewBuild();

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    const buildIdInterval = window.setInterval(
      () => void checkForNewBuild(),
      BUILD_ID_CHECK_INTERVAL_MS
    );
    void checkForNewBuild();

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {
        // Service worker registration failed silently.
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(buildIdInterval);
    };
  }, []);

  return null;
}
