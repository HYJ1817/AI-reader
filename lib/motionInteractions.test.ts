import { describe, expect, it } from "vitest";
import {
  clampSheetDrag,
  canInterruptSheetPhase,
  getSheetBackdropOpacity,
  getSheetDragTranslation,
  getTransformTranslateY,
  isSheetCloseTransition,
  isScrollIntent,
  isTapGesture,
  shouldReduceReaderMotion,
  shouldHideChromeForScroll,
  shouldDismissSheet,
} from "./motionInteractions";

describe("isTapGesture", () => {
  it("accepts a short stationary gesture", () => {
    expect(
      isTapGesture({
        durationMs: 180,
        deltaX: 4,
        deltaY: 6,
      })
    ).toBe(true);
  });

  it("accepts natural finger drift below the shared scroll threshold", () => {
    const gesture = {
      deltaX: 9,
      deltaY: 12,
    };

    expect(
      isTapGesture({
        durationMs: 180,
        ...gesture,
      })
    ).toBe(true);
    expect(isScrollIntent(gesture)).toBe(false);
  });

  it("rejects a scroll-like movement", () => {
    expect(
      isTapGesture({
        durationMs: 160,
        deltaX: 3,
        deltaY: 24,
      })
    ).toBe(false);
  });

  it("rejects a long press", () => {
    expect(
      isTapGesture({
        durationMs: 520,
        deltaX: 1,
        deltaY: 1,
      })
    ).toBe(false);
  });
});

describe("clampSheetDrag", () => {
  it("does not allow upward dragging past the resting position", () => {
    expect(clampSheetDrag(-48, 600)).toBe(0);
  });

  it("caps downward dragging at the sheet height", () => {
    expect(clampSheetDrag(820, 600)).toBe(600);
  });
});

describe("getTransformTranslateY", () => {
  it("reads the current vertical offset from 2D and 3D transforms", () => {
    expect(getTransformTranslateY("matrix(1, 0, 0, 1, 0, 84.5)")).toBe(84.5);
    expect(
      getTransformTranslateY(
        "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 42, 0, 1)"
      )
    ).toBe(42);
  });

  it("returns rest for missing or invalid transforms", () => {
    expect(getTransformTranslateY("none")).toBe(0);
    expect(getTransformTranslateY("matrix(bad)")).toBe(0);
  });
});

describe("getSheetDragTranslation", () => {
  it("continues from the sheet's current animated position", () => {
    expect(
      getSheetDragTranslation({
        baseTranslationY: 72,
        pointerDeltaY: 18,
        sheetHeight: 500,
      })
    ).toBe(90);
  });

  it("clamps resumed drags to the valid sheet range", () => {
    expect(
      getSheetDragTranslation({
        baseTranslationY: 72,
        pointerDeltaY: -120,
        sheetHeight: 500,
      })
    ).toBe(0);
  });
});

describe("isScrollIntent", () => {
  it("recognizes deliberate finger movement", () => {
    expect(isScrollIntent({ deltaX: 3, deltaY: 19 })).toBe(true);
  });

  it("ignores the small movement of a stationary tap", () => {
    expect(isScrollIntent({ deltaX: 2, deltaY: 5 })).toBe(false);
  });
});

describe("shouldHideChromeForScroll", () => {
  it("suppresses a residual scroll immediately after a chrome tap", () => {
    expect(shouldHideChromeForScroll({ elapsedSinceChromeTapMs: 120 })).toBe(false);
  });

  it("allows a later scroll to hide the chrome", () => {
    expect(shouldHideChromeForScroll({ elapsedSinceChromeTapMs: 320 })).toBe(true);
  });
});

describe("shouldReduceReaderMotion", () => {
  it("reduces motion when either the app or operating system requests it", () => {
    expect(
      shouldReduceReaderMotion({
        appPreference: true,
        systemPreference: false,
      })
    ).toBe(true);
    expect(
      shouldReduceReaderMotion({
        appPreference: false,
        systemPreference: true,
      })
    ).toBe(true);
  });

  it("keeps motion only when both preferences allow it", () => {
    expect(
      shouldReduceReaderMotion({
        appPreference: false,
        systemPreference: false,
      })
    ).toBe(false);
  });
});

describe("shouldDismissSheet", () => {
  it("dismisses after a substantial downward drag", () => {
    expect(
      shouldDismissSheet({
        translationY: 180,
        velocityY: 120,
        sheetHeight: 520,
      })
    ).toBe(true);
  });

  it("dismisses a short but fast downward flick", () => {
    expect(
      shouldDismissSheet({
        translationY: 42,
        velocityY: 1080,
        sheetHeight: 520,
      })
    ).toBe(true);
  });

  it("returns a slow short drag to the open position", () => {
    expect(
      shouldDismissSheet({
        translationY: 54,
        velocityY: 220,
        sheetHeight: 520,
      })
    ).toBe(false);
  });
});

describe("getSheetBackdropOpacity", () => {
  it("keeps the backdrop fully visible at rest", () => {
    expect(getSheetBackdropOpacity(0, 600)).toBe(1);
  });

  it("lightens the backdrop as the sheet follows the finger", () => {
    expect(getSheetBackdropOpacity(300, 600)).toBeCloseTo(0.725);
    expect(getSheetBackdropOpacity(600, 600)).toBeCloseTo(0.45);
  });

  it("sanitizes invalid dimensions", () => {
    expect(getSheetBackdropOpacity(100, 0)).toBe(1);
    expect(getSheetBackdropOpacity(Number.NaN, 600)).toBe(1);
  });
});

describe("isSheetCloseTransition", () => {
  it("accepts the sheet panel transform transition", () => {
    expect(
      isSheetCloseTransition({
        propertyName: "transform",
        targetIsPanel: true,
      })
    ).toBe(true);
  });

  it("ignores child and unrelated transitions", () => {
    expect(
      isSheetCloseTransition({
        propertyName: "opacity",
        targetIsPanel: true,
      })
    ).toBe(false);
    expect(
      isSheetCloseTransition({
        propertyName: "transform",
        targetIsPanel: false,
      })
    ).toBe(false);
  });
});

describe("canInterruptSheetPhase", () => {
  it("allows the sheet to be grabbed during entry, rest, and dismissal", () => {
    expect(canInterruptSheetPhase("entering")).toBe(true);
    expect(canInterruptSheetPhase("open")).toBe(true);
    expect(canInterruptSheetPhase("closing")).toBe(true);
  });

  it("rejects unknown phases defensively", () => {
    expect(canInterruptSheetPhase("unknown")).toBe(false);
  });
});
