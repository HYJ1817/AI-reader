import {
  normalizeOpenAiBaseUrl,
  buildChatMessages,
  extractChatAnswer,
  type AiContext,
} from "@/lib/aiChat";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { baseUrl, apiKey, model, question, context } = body as {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    question?: string;
    context?: AiContext;
  };

  if (!baseUrl || !apiKey || !model || !question) {
    return Response.json(
      { error: "Missing required fields: baseUrl, apiKey, model, question" },
      { status: 400 }
    );
  }

  let normalizedBase: string;
  try {
    normalizedBase = normalizeOpenAiBaseUrl(baseUrl);
  } catch {
    return Response.json({ error: "Invalid baseUrl" }, { status: 400 });
  }

  const messages = buildChatMessages(question, context ?? {});

  let upstream: Response;
  try {
    upstream = await fetch(`${normalizedBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
    });
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
    answer = extractChatAnswer(data);
  } catch {
    return Response.json(
      { error: "AI request failed: unexpected response format" },
      { status: 502 }
    );
  }

  return Response.json({ answer });
}
