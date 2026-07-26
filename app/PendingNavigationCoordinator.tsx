"use client";

import { useEffect } from "react";
import {
  useNavigation,
  useNavigationSheets,
} from "@/app/NavigationProvider";
import type { NavigationTab } from "@/lib/navigationMotion";

type PendingRef<T> = { current: T };

export default function PendingNavigationCoordinator({
  readerPresented,
  pendingReaderTargetRef,
  pendingPushAfterReaderRef,
}: {
  readerPresented: boolean;
  pendingReaderTargetRef: PendingRef<NavigationTab | null>;
  pendingPushAfterReaderRef: PendingRef<"ai-providers" | null>;
}) {
  const navigation = useNavigation();
  const sheets = useNavigationSheets();

  useEffect(() => {
    const pendingPush = pendingPushAfterReaderRef.current;
    if (pendingPush) {
      if (sheets.length > 0) return;
      if (readerPresented) {
        navigation.dismissReader();
        return;
      }
      pendingPushAfterReaderRef.current = null;
      pendingReaderTargetRef.current = null;
      navigation.selectTab("settings");
      navigation.push(pendingPush);
      return;
    }

    if (readerPresented) return;
    const targetTab = pendingReaderTargetRef.current;
    pendingReaderTargetRef.current = null;
    if (targetTab) navigation.selectTab(targetTab);
  }, [
    navigation,
    pendingPushAfterReaderRef,
    pendingReaderTargetRef,
    readerPresented,
    sheets.length,
  ]);

  return null;
}
