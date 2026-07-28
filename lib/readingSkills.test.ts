import { describe, expect, it } from "vitest";
import {
  READING_SKILLS,
  buildReadingSkillQuestion,
  createArtifactTitle,
  listEligibleReadingSkills,
} from "./readingSkills";

describe("reading Skills", () => {
  it("bundles exactly four reading Skills", () => {
    expect(READING_SKILLS.map((skill) => skill.id)).toEqual([
      "explain-selection",
      "translate-selection",
      "summarize-nearby",
      "extract-key-points",
    ]);
  });

  it("hides selection Skills when no selected text exists", () => {
    expect(
      listEligibleReadingSkills({
        selectedText: "",
        nearbyText: "page",
      }).map((skill) => skill.id)
    ).toEqual(["summarize-nearby", "extract-key-points"]);
  });

  it("builds a bounded question without duplicating passage text", () => {
    const question = buildReadingSkillQuestion("explain-selection", {
      selectedText: "passage",
      nearbyText: "nearby",
      locale: "zh-CN",
    });
    expect(question).toContain("\u89e3\u91ca");
    expect(question).not.toContain("passage");
    expect(question).not.toContain("nearby");
  });

  it("rejects missing required context and creates a bounded semantic title", () => {
    expect(() =>
      buildReadingSkillQuestion("translate-selection", {
        locale: "zh-CN",
      })
    ).toThrow();
    expect(createArtifactTitle("## **A useful heading**\nBody", "Book")).toBe(
      "A useful heading"
    );
    expect(createArtifactTitle("", "Book")).toBe("Book \u8d44\u6599");
    expect(createArtifactTitle("#".repeat(80), "Book").length).toBeLessThanOrEqual(60);
  });
});
