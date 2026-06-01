"use client";

import { useEffect } from "react";

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

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed silently.
    });
  }, []);

  return null;
}
