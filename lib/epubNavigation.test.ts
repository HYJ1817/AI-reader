import { describe, it, expect } from "vitest";
import { normalizeEpubNavigation } from "./epubNavigation";

describe("normalizeEpubNavigation", () => {
  it("returns empty array for null input", () => {
    expect(normalizeEpubNavigation(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(normalizeEpubNavigation(undefined)).toEqual([]);
  });

  it("returns empty array for empty object", () => {
    expect(normalizeEpubNavigation({})).toEqual([]);
  });

  it("returns empty array for non-object non-array input", () => {
    expect(normalizeEpubNavigation("string")).toEqual([]);
    expect(normalizeEpubNavigation(42)).toEqual([]);
    expect(normalizeEpubNavigation(true)).toEqual([]);
  });

  it("normalizes navigation.toc array", () => {
    const input = {
      toc: [
        { label: "Chapter 1", href: "ch1.html" },
        { label: "Chapter 2", href: "ch2.html" },
      ],
    };
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-0", label: "Chapter 1", href: "ch1.html", children: [] },
      { id: "toc-1", label: "Chapter 2", href: "ch2.html", children: [] },
    ]);
  });

  it("normalizes direct toc array", () => {
    const input = [
      { label: "Intro", href: "intro.html" },
      { label: "Main", href: "main.html" },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-0", label: "Intro", href: "intro.html", children: [] },
      { id: "toc-1", label: "Main", href: "main.html", children: [] },
    ]);
  });

  it("trims label and href", () => {
    const input = [
      { label: "  Chapter 1  ", href: "  ch1.html  " },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-0", label: "Chapter 1", href: "ch1.html", children: [] },
    ]);
  });

  it("handles nested subitems", () => {
    const input = [
      {
        label: "Part 1",
        href: "part1.html",
        subitems: [
          { label: "Chapter 1.1", href: "ch1-1.html" },
          { label: "Chapter 1.2", href: "ch1-2.html" },
        ],
      },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      {
        id: "toc-0",
        label: "Part 1",
        href: "part1.html",
        children: [
          { id: "toc-0-0", label: "Chapter 1.1", href: "ch1-1.html", children: [] },
          { id: "toc-0-1", label: "Chapter 1.2", href: "ch1-2.html", children: [] },
        ],
      },
    ]);
  });

  it("handles nested children array", () => {
    const input = [
      {
        label: "Part 1",
        href: "part1.html",
        children: [
          { label: "Section A", href: "sec-a.html" },
        ],
      },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      {
        id: "toc-0",
        label: "Part 1",
        href: "part1.html",
        children: [
          { id: "toc-0-0", label: "Section A", href: "sec-a.html", children: [] },
        ],
      },
    ]);
  });

  it("skips invalid entries (missing label)", () => {
    const input = [
      { href: "no-label.html" },
      { label: "Valid", href: "valid.html" },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-1", label: "Valid", href: "valid.html", children: [] },
    ]);
  });

  it("skips invalid entries (empty label)", () => {
    const input = [
      { label: "", href: "empty.html" },
      { label: "Valid", href: "valid.html" },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-1", label: "Valid", href: "valid.html", children: [] },
    ]);
  });

  it("skips invalid entries (missing href)", () => {
    const input = [
      { label: "No Href" },
      { label: "Valid", href: "valid.html" },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-1", label: "Valid", href: "valid.html", children: [] },
    ]);
  });

  it("skips invalid entries (empty href)", () => {
    const input = [
      { label: "Empty", href: "" },
      { label: "Valid", href: "valid.html" },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-1", label: "Valid", href: "valid.html", children: [] },
    ]);
  });

  it("skips non-object entries", () => {
    const input = [
      null,
      undefined,
      42,
      "string",
      { label: "Valid", href: "valid.html" },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-4", label: "Valid", href: "valid.html", children: [] },
    ]);
  });

  it("preserves valid descendants when parent is invalid", () => {
    const input = [
      {
        label: "",
        href: "",
        children: [
          { label: "Valid Child", href: "child.html" },
        ],
      },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      { id: "toc-0-0", label: "Valid Child", href: "child.html", children: [] },
    ]);
  });

  it("generates stable ids from path indexes", () => {
    const input = [
      { label: "A", href: "a.html" },
      {
        label: "B",
        href: "b.html",
        children: [
          { label: "B1", href: "b1.html" },
          { label: "B2", href: "b2.html" },
        ],
      },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result[0].id).toBe("toc-0");
    expect(result[1].id).toBe("toc-1");
    expect(result[1].children[0].id).toBe("toc-1-0");
    expect(result[1].children[1].id).toBe("toc-1-1");
  });

  it("handles deeply nested structure", () => {
    const input = [
      {
        label: "L1",
        href: "l1.html",
        children: [
          {
            label: "L2",
            href: "l2.html",
            subitems: [
              { label: "L3", href: "l3.html" },
            ],
          },
        ],
      },
    ];
    const result = normalizeEpubNavigation(input);
    expect(result).toEqual([
      {
        id: "toc-0",
        label: "L1",
        href: "l1.html",
        children: [
          {
            id: "toc-0-0",
            label: "L2",
            href: "l2.html",
            children: [
              { id: "toc-0-0-0", label: "L3", href: "l3.html", children: [] },
            ],
          },
        ],
      },
    ]);
  });

  it("handles empty toc array", () => {
    const input = { toc: [] };
    expect(normalizeEpubNavigation(input)).toEqual([]);
  });

  it("handles empty direct array", () => {
    expect(normalizeEpubNavigation([])).toEqual([]);
  });
});
