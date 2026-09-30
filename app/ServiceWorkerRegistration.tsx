"use client";

import { useEffect } from "react";
import { appUpdate } from "@/lib/appUpdate";
import { DEFERRED_UPDATE_KEY } from "@/lib/browserAppUpdate";

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

    let disposed = false;
    let checkingBuildId = false;
    try { appUpdate.defer(sessionStorage.getItem(DEFERRED_UPDATE_KEY)); } catch { /* In-memory snooze still works. */ }
    const checkForNewBuild = async () => {
      if (checkingBuildId || document.visibilityState === "hidden") {
        return;
      }
      checkingBuildId = true;
      try {
        const response = await fetch("/BUILD_ID", { cache: "no-store" });
        if (!response.ok) return;
        const buildId = (await response.text()).trim();
        if (!buildId) return;
        if (!disposed) appUpdate.discover(buildId);
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
    // A worker takeover is discovery, never permission to reload this page.
    const handleControllerChange = () => void checkForNewBuild();

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
      disposed = true;
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
