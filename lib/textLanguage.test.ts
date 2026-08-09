import { describe, expect, it } from "vitest";
import { getTxtParagraphLanguage } from "./textLanguage";

describe("TXT paragraph language", () => {
  it("marks paragraphs containing Han characters as simplified Chinese", () => {
    expect(getTxtParagraphLanguage("资本论第一章")).toBe("zh-CN");
    expect(getTxtParagraphLanguage("AI 阅读助手支持中文")).toBe("zh-CN");
  });

  it("leaves non-Han and empty paragraphs unspecified", () => {
    expect(getTxtParagraphLanguage("Chapter One")).toBeUndefined();
    expect(getTxtParagraphLanguage("   ")).toBeUndefined();
  });
});
