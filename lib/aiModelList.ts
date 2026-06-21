import type { AiProviderConfig, AiProviderModel } from "./aiProviders";
import { resolveAiProviderBaseUrl } from "./aiProviders";

export interface AiModelListRequest {
  url: string;
  init: RequestInit;
}

function headersOf(value: Record<string, string>): HeadersInit {
  return value;
}

export function buildAiModelListRequest(provider: AiProviderConfig): AiModelListRequest {
  const baseUrl = resolveAiProviderBaseUrl(provider);

  if (provider.protocol === "gemini") {
    return {
      url: `${baseUrl}/models?key=${encodeURIComponent(provider.apiKey)}`,
      init: {
        method: "GET",
        headers: headersOf({ "Content-Type": "application/json" }),
      },
    };
  }

  if (provider.protocol === "anthropic-compatible") {
    return {
      url: `${baseUrl}/models`,
      init: {
        method: "GET",
        headers: headersOf({
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
        }),
      },
    };
  }

  return {
    url: `${baseUrl}/models`,
    init: {
      method: "GET",
      headers: headersOf({
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      }),
    },
  };
}

function normalizeModel(id: string, label?: string): AiProviderModel | null {
  const trimmedId = id.trim();
  if (!trimmedId) return null;
  const trimmedLabel = label?.trim();
  return {
    id: trimmedId,
    label: trimmedLabel || trimmedId.replace(/^models\//, ""),
    source: "remote",
  };
}

function uniqueModels(models: AiProviderModel[]): AiProviderModel[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

export function extractAiModels(
  provider: AiProviderConfig,
  responseJson: unknown
): AiProviderModel[] {
  if (typeof responseJson !== "object" || responseJson === null) {
    throw new Error("Invalid model response");
  }

  const obj = responseJson as Record<string, unknown>;
  if (provider.protocol === "gemini") {
    const models = obj.models;
    if (!Array.isArray(models)) throw new Error("Invalid Gemini model response");
    return uniqueModels(
      models
        .map((item) => {
          if (typeof item !== "object" || item === null) return null;
          const record = item as Record<string, unknown>;
          const name = typeof record.name === "string" ? record.name : "";
          const displayName =
            typeof record.displayName === "string" ? record.displayName : undefined;
          return normalizeModel(name, displayName);
        })
        .filter((item): item is AiProviderModel => item !== null)
    );
  }

  const data = obj.data;
  if (!Array.isArray(data)) throw new Error("Invalid model response");
  return uniqueModels(
    data
      .map((item) => {
        if (typeof item === "string") return normalizeModel(item);
        if (typeof item !== "object" || item === null) return null;
        const record = item as Record<string, unknown>;
        const id = typeof record.id === "string" ? record.id : "";
        const label =
          typeof record.display_name === "string"
            ? record.display_name
            : typeof record.name === "string"
              ? record.name
              : undefined;
        return normalizeModel(id, label);
      })
      .filter((item): item is AiProviderModel => item !== null)
  );
}
