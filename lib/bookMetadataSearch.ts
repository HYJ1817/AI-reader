import {
  buildGoogleBooksQuery,
  buildOpenLibraryQuery,
  normalizeBookQuery,
  normalizeGoogleVolume,
  normalizeOpenLibraryWork,
  selectBestBookCandidate,
  type BookMetadataSearchInput,
  type NormalizedBookCandidate,
} from "./bookMetadataProviders";

export type PublicBookMetadataSearchResult = {
  candidate: NormalizedBookCandidate | null;
  score: number;
  missing: Array<"description" | "subjects">;
};

export type BookMetadataSearchOptions = {
  fetcher?: typeof fetch;
  googleBooksApiKey?: string;
};

const PROVIDER_RESPONSE_LIMIT = 512_000;
const PROVIDER_TIMEOUT_MS = 4_500;

async function readLimitedResponseJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error("Provider request failed");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PROVIDER_RESPONSE_LIMIT) {
    throw new Error("Provider response too large");
  }
  if (!response.body) return undefined;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > PROVIDER_RESPONSE_LIMIT) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Provider response too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function fetchOpenLibrary(
  query: ReturnType<typeof normalizeBookQuery>,
  fetcher: typeof fetch
): Promise<NormalizedBookCandidate[]> {
  const url = new URL("https://openlibrary.org/search.json");
  for (const [key, value] of Object.entries(buildOpenLibraryQuery(query))) {
    if (value) url.searchParams.set(key, value);
  }
  url.searchParams.set("limit", "10");
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,language,isbn,publisher,subject,cover_i"
  );
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const payload = objectValue(await readLimitedResponseJson(response));
  return (Array.isArray(payload?.docs) ? payload.docs : [])
    .slice(0, 10)
    .map(normalizeOpenLibraryWork)
    .filter((candidate): candidate is NormalizedBookCandidate => Boolean(candidate));
}

async function fetchGoogleBooks(
  query: ReturnType<typeof normalizeBookQuery>,
  fetcher: typeof fetch,
  apiKey: string
): Promise<NormalizedBookCandidate[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", buildGoogleBooksQuery(query));
  url.searchParams.set("maxResults", "10");
  url.searchParams.set("printType", "books");
  url.searchParams.set("key", apiKey);
  const response = await fetcher(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const payload = objectValue(await readLimitedResponseJson(response));
  return (Array.isArray(payload?.items) ? payload.items : [])
    .slice(0, 10)
    .map(normalizeGoogleVolume)
    .filter((candidate): candidate is NormalizedBookCandidate => Boolean(candidate));
}

async function safeProvider(
  request: Promise<NormalizedBookCandidate[]>
): Promise<NormalizedBookCandidate[]> {
  try {
    return await request;
  } catch {
    return [];
  }
}

export async function searchPublicBookMetadata(
  input: BookMetadataSearchInput,
  options: BookMetadataSearchOptions = {}
): Promise<PublicBookMetadataSearchResult> {
  const query = normalizeBookQuery(input);
  const fetcher = options.fetcher ?? fetch;
  const googleBooksApiKey = options.googleBooksApiKey?.trim() ?? "";
  const requests = [safeProvider(fetchOpenLibrary(query, fetcher))];
  if (googleBooksApiKey) {
    requests.push(
      safeProvider(fetchGoogleBooks(query, fetcher, googleBooksApiKey))
    );
  }
  const candidates = (await Promise.all(requests)).flat();
  const selection = selectBestBookCandidate(query, candidates);
  const missing: Array<"description" | "subjects"> = [];
  if (!selection.candidate?.description) missing.push("description");
  if (!selection.candidate?.subjects.length) missing.push("subjects");
  return { ...selection, missing };
}
