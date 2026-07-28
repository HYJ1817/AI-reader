import type { NavigationDirection } from "./appNavigation";

export function getSheetPageTarget(
  distanceFromTop: number,
  reduceMotion: boolean
): { opacity: number; x: number } {
  if (distanceFromTop <= 0) return { opacity: 1, x: 0 };
  if (reduceMotion) return { opacity: 0, x: 0 };
  return { opacity: 0.92, x: -12 };
}

export function getSheetPageBoundary(
  direction: NavigationDirection,
  phase: "enter" | "exit",
  reduceMotion: boolean
): { opacity: number; x: number } {
  if (reduceMotion || direction === "replace") {
    return { opacity: 0, x: 0 };
  }

  const isForward = direction === "forward";
  const x = phase === "enter"
    ? isForward ? 24 : -12
    : isForward ? -12 : 24;

  return { opacity: 0, x };
}
