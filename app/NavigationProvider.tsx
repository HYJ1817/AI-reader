"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UseAppNavigationResult } from "./useAppNavigation";

const NavigationContext = createContext<UseAppNavigationResult | null>(null);

export function NavigationProvider({
  value,
  children,
}: {
  value: UseAppNavigationResult;
  children: ReactNode;
}) {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): UseAppNavigationResult {
  const value = useContext(NavigationContext);
  if (!value) {
    throw new Error("useNavigation requires NavigationProvider");
  }
  return value;
}
