import { describe, expect, it } from "vitest";
import {
  classifyEpubTouchEnd,
  consumeEpubSyntheticClick,
  createEpubSyntheticClickToken,
  normalizeEpubSelectionText,
} from "./epubTapInteractions";

describe("normalizeEpubSelectionText", () => {
  it("trims and collapses selection whitespace for stable snapshots", () => {
    expect(normalizeEpubSelectionText("  first \n\t second  ")).toBe(
      "first second"
    );
  });
});

describe("classifyEpubTouchEnd", () => {
  it("treats a new non-empty selection as selection instead of a tap", () => {
    expect(
      classifyEpubTouchEnd({
        startSelectionText: "",
        endSelectionText: "selected text",
        isInteractiveTarget: false,
        scrollIntentFired: false,
        isTapGesture: true,
      })
    ).toBe("selection");
  });

  it("allows a stationary tap when the non-empty selection is unchanged", () => {
    expect(
      classifyEpubTouchEnd({
        startSelectionText: "stale selection",
        endSelectionText: "stale selection",
        isInteractiveTarget: false,
        scrollIntentFired: false,
        isTapGesture: true,
      })
    ).toBe("tap");
  });

  it("ignores interactive targets, scrolls, and non-tap gestures", () => {
    const base = {
      startSelectionText: "",
      endSelectionText: "",
    };

    expect(
      classifyEpubTouchEnd({
        ...base,
        isInteractiveTarget: true,
        scrollIntentFired: false,
        isTapGesture: true,
      })
    ).toBe("ignore");
    expect(
      classifyEpubTouchEnd({
        ...base,
        isInteractiveTarget: false,
        scrollIntentFired: true,
        isTapGesture: true,
      })
    ).toBe("ignore");
    expect(
      classifyEpubTouchEnd({
        ...base,
        isInteractiveTarget: false,
        scrollIntentFired: false,
        isTapGesture: false,
      })
    ).toBe("ignore");
  });
});

describe("EPUB synthetic click suppression", () => {
  it("suppresses one matching delayed click after a classified touch", () => {
    const target = new EventTarget();
    const token = createEpubSyntheticClickToken(target, 100);
    const consumed = consumeEpubSyntheticClick({
      token,
      target,
      at: 950,
    });

    expect(consumed.suppress).toBe(true);
    expect(consumed.token).toBeNull();
    expect(
      consumeEpubSyntheticClick({
        token: consumed.token,
        target,
        at: 960,
      }).suppress
    ).toBe(false);
  });

  it("does not suppress a click for a different target", () => {
    const touchTarget = new EventTarget();
    const clickTarget = new EventTarget();
    const token = createEpubSyntheticClickToken(touchTarget, 100);
    const result = consumeEpubSyntheticClick({
      token,
      target: clickTarget,
      at: 200,
    });

    expect(result.suppress).toBe(false);
    expect(result.token).toBe(token);
  });
});
