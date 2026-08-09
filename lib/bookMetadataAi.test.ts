import { describe, expect, it } from "vitest";
import {
  buildMetadataAiMessages,
  parseMetadataAiResponse,
  parseMetadataCompletionText,
} from "./bookMetadataAi";

describe("metadata AI response parsing", () => {
  it.each([
    [
      "openai-compatible" as const,
      { choices: [{ message: { content: '{"description":"简介","subjects":["经济学"]}' } }] },
      { description: "简介", subjects: ["经济学"] },
    ],
    [
      "anthropic-compatible" as const,
      { content: [{ type: "text", text: '{"description":"简介"}' }] },
      { description: "简介" },
    ],
    [
      "gemini" as const,
      { candidates: [{ content: { parts: [{ text: '{"subjects":["经典"]}' }] } }] },
      { subjects: ["经典"] },
    ],
  ])("extracts bounded completion from %s", (protocol, payload, expected) => {
    expect(parseMetadataAiResponse(protocol, payload, ["description", "subjects"]))
      .toEqual(expected);
  });

  it("drops facts and fields that were not requested", () => {
    expect(
      parseMetadataCompletionText(
        '{"description":"简介","authors":["伪造作者"],"publisher":"伪造出版社","subjects":["隐藏"]}',
        ["description"]
      )
    ).toEqual({ description: "简介" });
  });

  it("strips fences, markup and enforces completion limits", () => {
    expect(
      parseMetadataCompletionText(
        `\`\`\`json\n${JSON.stringify({
          description: `<b>${"文".repeat(13_000)}</b>`,
          subjects: [...Array(20)].map((_, index) => `${index}-${"标".repeat(100)}`),
        })}\n\`\`\``,
        ["description", "subjects"]
      )
    ).toMatchObject({
      description: expect.not.stringContaining("<b>"),
      subjects: expect.any(Array),
    });
    const completion = parseMetadataCompletionText(
      JSON.stringify({ description: "文".repeat(13_000), subjects: Array(20).fill("标签") }),
      ["description", "subjects"]
    );
    expect(completion.description?.length).toBe(12_000);
    expect(completion.subjects).toHaveLength(1);
  });

  it("builds a bounded JSON-only, no-invention prompt", () => {
    const messages = buildMetadataAiMessages(
      { title: "资本论", authors: ["马克思"] },
      ["description"],
      "章".repeat(7_000)
    );
    expect(messages[0].content).toContain("不得编造");
    expect(messages[0].content).toContain("JSON");
    expect(messages[1].content).not.toContain("章".repeat(6_001));
  });
});
