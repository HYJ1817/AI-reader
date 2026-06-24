export type EpubTouchEndClassification = "tap" | "selection" | "ignore";

export function normalizeEpubSelectionText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function resolveEpubSelectionUpdate(value: string): {
  selectedText: string | null;
  shouldShowChrome: boolean;
} {
  const selectedText = normalizeEpubSelectionText(value) || null;
  return {
    selectedText,
    shouldShowChrome: selectedText !== null,
  };
}

export function shouldReportEpubSelectionChange({
  value,
  at,
  suppressNonEmptyUntil,
}: {
  value: string;
  at: number;
  suppressNonEmptyUntil: number;
}): boolean {
  return (
    normalizeEpubSelectionText(value).length === 0 ||
    at > suppressNonEmptyUntil
  );
}

export function classifyEpubTouchEnd({
  startSelectionText,
  endSelectionText,
  isInteractiveTarget,
  scrollIntentFired,
  isTapGesture,
}: {
  startSelectionText: string;
  endSelectionText: string;
  isInteractiveTarget: boolean;
  scrollIntentFired: boolean;
  isTapGesture: boolean;
}): EpubTouchEndClassification {
  if (isInteractiveTarget || scrollIntentFired || !isTapGesture) {
    return "ignore";
  }

  const startSelection = normalizeEpubSelectionText(startSelectionText);
  const endSelection = normalizeEpubSelectionText(endSelectionText);
  if (endSelection && endSelection !== startSelection) {
    return "selection";
  }

  return "tap";
}

const SYNTHETIC_CLICK_SUPPRESSION_MS = 1500;

export type EpubSyntheticClickToken = {
  target: EventTarget | null;
  expiresAt: number;
};

export function createEpubSyntheticClickToken(
  target: EventTarget | null,
  at: number
): EpubSyntheticClickToken {
  return {
    target,
    expiresAt: at + SYNTHETIC_CLICK_SUPPRESSION_MS,
  };
}

export function resolveEpubTouchEnd({
  startSelectionText,
  endSelectionText,
  isInteractiveTarget,
  scrollIntentFired,
  isTapGesture,
  target,
  at,
}: {
  startSelectionText: string;
  endSelectionText: string;
  isInteractiveTarget: boolean;
  scrollIntentFired: boolean;
  isTapGesture: boolean;
  target: EventTarget | null;
  at: number;
}): {
  classification: EpubTouchEndClassification;
  fireTap: boolean;
  syntheticClickToken: EpubSyntheticClickToken | null;
} {
  const classification = classifyEpubTouchEnd({
    startSelectionText,
    endSelectionText,
    isInteractiveTarget,
    scrollIntentFired,
    isTapGesture,
  });
  const fireTap = classification === "tap";
  return {
    classification,
    fireTap,
    syntheticClickToken: fireTap
      ? createEpubSyntheticClickToken(target, at)
      : null,
  };
}

export function cancelEpubSyntheticClickToken(): null {
  return null;
}

export function consumeEpubSyntheticClick({
  token,
  target,
  at,
}: {
  token: EpubSyntheticClickToken | null;
  target: EventTarget | null;
  at: number;
}): {
  suppress: boolean;
  token: EpubSyntheticClickToken | null;
} {
  if (!token) {
    return { suppress: false, token: null };
  }
  if (at > token.expiresAt) {
    return { suppress: false, token: null };
  }
  if (target !== token.target) {
    return { suppress: false, token: null };
  }
  return { suppress: true, token: null };
}
