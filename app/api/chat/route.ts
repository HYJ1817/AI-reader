import {
  buildChatMessages,
  buildAiProviderRequest,
  extractAiProviderAnswer,
  type AiContext,
  type ChatConversationMessage,
} from "@/lib/aiChat";
import {
  createAiProviderFromPreset,
  hasUsableAiProvider,
  sanitizeAiProvider,
  type AiProviderConfig,
} from "@/lib/aiProviders";
import {
  AiRequestError,
  fetchAiUpstream,
  readLimitedJson,
} from "@/lib/aiRequestSecurity";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    return Response.json({ error: message }, { status });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, baseUrl, apiKey, model, question, context, messages } =
    body as {
      provider?: unknown;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      question?: string;
      context?: AiContext;
      messages?: ChatConversationMessage[];
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

  if (
    !resolvedProvider ||
    !hasUsableAiProvider(resolvedProvider) ||
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 8_000 ||
    (messages !== undefined && (!Array.isArray(messages) || messages.length > 40))
  ) {
    return Response.json(
      { error: "Missing required fields: provider, question" },
      { status: 400 }
    );
  }

  let aiRequest: ReturnType<typeof buildAiProviderRequest>;
  try {
    aiRequest = buildAiProviderRequest(
      resolvedProvider,
      buildChatMessages(question, context ?? {}, messages ?? [])
    );
  } catch {
    return Response.json({ error: "Invalid baseUrl" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchAiUpstream(aiRequest.url, aiRequest.init, {
      allowLocalDevelopment: process.env.NODE_ENV !== "production",
    });
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 502;
    const message =
      error instanceof AiRequestError ? error.message : "AI request failed";
    return Response.json({ error: message }, { status });
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
