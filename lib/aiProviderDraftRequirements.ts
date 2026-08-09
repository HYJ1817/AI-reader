export type AiProviderDraftRequirementInput = {
  protocol: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

const REQUIREMENTS = [
  ["protocol", "服务商类型"],
  ["label", "名称"],
  ["baseUrl", "API 地址"],
  ["apiKey", "API Key"],
  ["model", "模型"],
] as const;

export function getAiProviderDraftRequirements(
  draft: AiProviderDraftRequirementInput | null
): string[] {
  if (!draft) return REQUIREMENTS.map(([, label]) => label);
  return REQUIREMENTS.filter(([key]) => !draft[key].trim()).map(
    ([, label]) => label
  );
}

export function getAiProviderSaveHint(
  draft: AiProviderDraftRequirementInput | null
): string {
  const missing = getAiProviderDraftRequirements(draft);
  if (missing.length === 0) return "";
  if (missing.length === 1 && missing[0] === "模型") {
    return "刷新模型，或手动添加模型后即可保存";
  }
  if (missing.length === 1) {
    const spacing = /^[A-Z]/.test(missing[0]) ? " " : "";
    return `填写${spacing}${missing[0]} 后即可保存`;
  }
  if (missing.length === 2) {
    return `填写${missing[0]}和 ${missing[1]}后即可保存`;
  }
  return "请完成必填信息后保存";
}
