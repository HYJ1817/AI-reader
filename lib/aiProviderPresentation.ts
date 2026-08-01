import type { AiProviderConfig } from "./aiProviders";

export type AiProviderHealth = "ready" | "needs-attention" | "empty";

export function getAiProviderHealth(
  provider: AiProviderConfig
): AiProviderHealth {
  const hasCredential = provider.apiKey.trim().length > 0;
  const hasModel = provider.models.length > 0 || provider.model.trim().length > 0;

  if (!hasCredential && !hasModel) return "empty";
  if (!hasCredential || !hasModel) return "needs-attention";
  return "ready";
}

export function getAiProviderCredentialSummary(
  provider: AiProviderConfig
): string {
  const key = provider.apiKey.trim();
  if (!key) return "未配置 API Key";
  if (key.length <= 8) return `API Key · ${"•".repeat(key.length)}`;
  return `API Key · ${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function getAiProviderModelCount(provider: AiProviderConfig): number {
  return provider.models.length;
}

export function getAiProviderHealthLabel(health: AiProviderHealth): string {
  switch (health) {
    case "ready":
      return "已就绪";
    case "needs-attention":
      return "需要完善";
    case "empty":
      return "未配置";
  }
}

export function getAiProviderHealthDescription(
  health: AiProviderHealth
): string {
  switch (health) {
    case "ready":
      return "API Key 与模型已配置";
    case "needs-attention":
      return "还需要 API Key 或模型";
    case "empty":
      return "添加 API Key 和模型后即可使用";
  }
}
