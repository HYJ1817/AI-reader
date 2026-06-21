import {
  buildChatMessages,
  buildAiProviderRequest,
  extractAiProviderAnswer,
  type AiContext,
} from "@/lib/aiChat";
import {
  createAiProviderFromPreset,
  hasUsableAiProvider,
  sanitizeAiProvider,
  type AiProviderConfig,
} from "@/lib/aiProviders";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, baseUrl, apiKey, model, question, context } = body as {
    provider?: unknown;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    question?: string;
    context?: AiContext;
  };

  const resolvedProvider: AiProviderConfig | null = provider
    ? sanitizeAiProvider(provider)
    : baseUrl && apiKey && model
      ? createAiProviderFromPreset("openai", {
          id: "request-openai-compatible",
          baseUrl,
          apiKey,
          model,
          appendDefaultPath: false,
        })
      : null;

  if (!resolvedProvider || !hasUsableAiProvider(resolvedProvider) || !question) {
    return Response.json(
      { error: "Missing required fields: provider, question" },
      { status: 400 }
    );
  }

  let aiRequest: ReturnType<typeof buildAiProviderRequest>;
  try {
    aiRequest = buildAiProviderRequest(
      resolvedProvider,
      buildChatMessages(question, context ?? {})
    );
  } catch {
    return Response.json({ error: "Invalid baseUrl" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(aiRequest.url, aiRequest.init);
  } catch {
    return Response.json({ error: "AI request failed" }, { status: 502 });
  }

  if (!upstream.ok) {
    const status = upstream.status >= 400 && upstream.status < 600
      ? upstream.status
      : 502;
    return Response.json({ error: "AI request failed" }, { status });
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return Response.json(
      { error: "AI request failed: invalid response" },
      { status: 502 }
    );
  }

  let answer: string;
  try {
    answer = extractAiProviderAnswer(resolvedProvider, data);
  } catch {
    return Response.json(
      { error: "AI request failed: unexpected response format" },
      { status: 502 }
    );
  }

  return Response.json({ answer });
}
