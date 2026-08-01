export type AiModelRefreshErrorCode =
  | "auth"
  | "billing"
  | "rate-limit"
  | "network"
  | "invalid-response";

export interface AiModelRefreshFailure {
  code: AiModelRefreshErrorCode;
  retryable: boolean;
}

export function classifyAiModelRefreshFailure(
  status: number | null
): AiModelRefreshFailure {
  if (status === 401 || status === 403) {
    return { code: "auth", retryable: false };
  }
  if (status === 402) {
    return { code: "billing", retryable: false };
  }
  if (status === 429) {
    return { code: "rate-limit", retryable: true };
  }
  if (status === 408) {
    return { code: "network", retryable: true };
  }
  if (status !== null && status >= 400 && status < 500) {
    return { code: "invalid-response", retryable: false };
  }
  return { code: "network", retryable: true };
}
