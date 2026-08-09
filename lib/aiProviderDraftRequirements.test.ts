import { describe, expect, it } from "vitest";
import {
  getAiProviderDraftRequirements,
  getAiProviderSaveHint,
} from "./aiProviderDraftRequirements";

const complete = {
  protocol: "openai-chat",
  label: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test",
  model: "gpt-test",
};

describe("AI provider draft requirements", () => {
  it("returns no requirements for a complete draft", () => {
    expect(getAiProviderDraftRequirements(complete)).toEqual([]);
    expect(getAiProviderSaveHint(complete)).toBe("");
  });

  it("names one and two missing fields", () => {
    expect(getAiProviderSaveHint({ ...complete, apiKey: "" })).toBe(
      "填写 API Key 后即可保存"
    );
    expect(
      getAiProviderSaveHint({ ...complete, label: "", baseUrl: "" })
    ).toBe("填写名称和 API 地址后即可保存");
  });

  it("collapses three or more missing fields", () => {
    expect(
      getAiProviderSaveHint({
        ...complete,
        label: "",
        baseUrl: "",
        apiKey: "",
      })
    ).toBe("请完成必填信息后保存");
  });

  it("gives actionable guidance when only the model is missing", () => {
    expect(getAiProviderSaveHint({ ...complete, model: "" })).toBe(
      "刷新模型，或手动添加模型后即可保存"
    );
  });
});
