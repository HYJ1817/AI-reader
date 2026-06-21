import { describe, expect, it } from "vitest";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "./incrementalList";

describe("incremental list sizing", () => {
  it("renders only the first batch for a long list", () => {
    expect(getInitialVisibleItemCount(120, 30)).toBe(30);
  });

  it("renders the whole list when it is smaller than one batch", () => {
    expect(getInitialVisibleItemCount(18, 30)).toBe(18);
  });

  it("adds one batch without exceeding the total", () => {
    expect(getNextVisibleItemCount(30, 95, 30)).toBe(60);
    expect(getNextVisibleItemCount(90, 95, 30)).toBe(95);
  });

  it("sanitizes invalid totals and batch sizes", () => {
    expect(getInitialVisibleItemCount(Number.NaN, 0)).toBe(0);
    expect(getNextVisibleItemCount(-10, Number.POSITIVE_INFINITY, -4)).toBe(0);
  });
});
