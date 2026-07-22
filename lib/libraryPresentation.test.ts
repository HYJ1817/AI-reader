import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildLibraryBookPresentation,
  formatBookDate,
  formatBookSize,
  formatLibraryBookSource,
  formatLibraryLastOpened,
} from "./libraryPresentation";

describe("library presentation", () => {
  it("formats bytes for compact book metadata", () => {
    expect(formatBookSize(1024)).toBe("1 KB");
    expect(formatBookSize(1572864)).toBe("1.5 MB");
  });

  it("uses stable labels for missing and invalid dates", () => {
    expect(formatBookDate()).toBe("从未");
    expect(formatBookDate("invalid")).toBe("未知");
  });

  it("formats valid book dates with the existing Chinese date contract", () => {
    expect(formatBookDate("2026-07-14T08:00:00+08:00")).toBe(
      "2026年7月14日"
    );
  });

  it("eagerly reuses one module-level formatter outside the click path", () => {
    const source = readFileSync(
      new URL("./libraryPresentation.ts", import.meta.url),
      "utf8"
    );

    expect(source).toMatch(
      /^const bookDateFormatter = new Intl\.DateTimeFormat\("zh-CN", \{/m
    );
    expect(source).toContain('year: "numeric"');
    expect(source).toContain('month: "short"');
    expect(source).toContain('day: "numeric"');
    expect(source).toContain("return bookDateFormatter.format(date);");
    expect(source).not.toContain(".toLocaleDateString(");
  });

  it("uses a distinct file stem as source and otherwise stays honest", () => {
    expect(formatLibraryBookSource("山海经", "archive-scan.epub")).toBe(
      "archive-scan"
    );
    expect(
      formatLibraryBookSource(
        "library book first sample",
        "library-book-first-sample.txt"
      )
    ).toBe("本地图书");
  });

  it("formats recent reading relative to a deterministic local day", () => {
    const now = new Date("2026-07-14T12:00:00+08:00");
    expect(formatLibraryLastOpened(undefined, now)).toBe("尚未阅读");
    expect(formatLibraryLastOpened("invalid", now)).toBe("阅读时间未知");
    expect(formatLibraryLastOpened("2026-07-14T08:00:00+08:00", now)).toBe(
      "今天阅读"
    );
    expect(formatLibraryLastOpened("2026-07-13T20:00:00+08:00", now)).toBe(
      "昨天阅读"
    );
    expect(formatLibraryLastOpened("2026-07-10T20:00:00+08:00", now)).toBe(
      "7月10日阅读"
    );
  });

  it("builds unread, active, and finished shelf presentation", () => {
    const book = {
      title: "山海经",
      fileName: "archive-scan.epub",
      lastOpenedAt: "2026-07-14T08:00:00+08:00",
    };
    const now = new Date("2026-07-14T12:00:00+08:00");

    expect(buildLibraryBookPresentation(book, 0, now)).toEqual({
      state: "unread",
      sourceLabel: "archive-scan",
      lastReadLabel: "今天阅读",
      progressLabel: "未开始",
      progressPercent: 0,
      showProgress: false,
    });
    expect(buildLibraryBookPresentation(book, 42, now)).toMatchObject({
      state: "active",
      progressLabel: "已读 42%",
      progressPercent: 42,
      showProgress: true,
    });
    expect(buildLibraryBookPresentation(book, 100, now)).toMatchObject({
      state: "finished",
      progressLabel: "已读完",
      progressPercent: 100,
      showProgress: true,
    });
  });
});
