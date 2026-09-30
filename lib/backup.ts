import {
  getCustomBackgroundRecord,
  getBookFile,
  listAllAnnotations,
  listAllReadingWorkspaces,
  listAllWorkspaceArtifacts,
  listAllWorkspaceBooks,
  listAllWorkspaceMemories,
  listAllWorkspaceMessages,
  listAllWorkspaceSessions,
  listBookGroups,
  listBookMetadata,
  listDailyReadingStats,
  listReadingPositions,
  replaceReaderData,
  type AnnotationRecord,
  type BookGroup,
  type BookRecord,
  type CustomBackgroundRecord,
  type DailyReadingStat,
  type ReadingPosition,
} from "./db";
import {
  DEFAULT_AI_PROVIDER_SETTINGS,
  loadAiProviderSettings,
  sanitizeAiProviderSettings,
  saveAiProviderSettingsToStorage,
  type AiProviderSettings,
} from "./aiProviders";
import { DEFAULT_AI_SETTINGS, saveAiSettingsToStorage } from "./aiSettings";
import {
  BOOK_METADATA_LIMITS,
  type BookEnrichment,
  type BookEnrichmentError,
  type BookEnrichmentStatus,
  type BookMetadataField,
  type BookMetadataProvenance,
  type BookMetadataSource,
} from "./bookMetadata";
import {
  emptyWorkspaceBackupData,
  validateWorkspaceBackupData,
  type WorkspaceBackupData,
} from "./workspaceBackup";

export interface BackupBookMeta {
  id: string;
  title: string;
  format: "epub" | "txt";
  fileName: string;
  size: number;
  createdAt: string;
  lastOpenedAt?: string;
  fileContent: string;
  groupIds?: string[];
  enrichment?: BookEnrichment;
}

type LegacyAiSettings = { baseUrl?: string; model?: string };

export interface LegacyBackupPayload {
  version: 1;
  exportedAt: string;
  books: BackupBookMeta[];
  readingPositions: ReadingPosition[];
  annotations: AnnotationRecord[];
  aiSettings?: LegacyAiSettings;
  bookGroups?: BookGroup[];
}

export interface BackupPayloadV2 {
  version: 2;
  exportedAt: string;
  books: BackupBookMeta[];
  readingPositions: ReadingPosition[];
  annotations: AnnotationRecord[];
  bookGroups: BookGroup[];
  dailyReadingStats: DailyReadingStat[];
  customBackground: {
    imageContent: string;
    updatedAt: string;
  } | null;
  aiProviderSettings: AiProviderSettings;
  aiSettings: { baseUrl: string; model: string };
}

export interface BackupPayloadV3
  extends Omit<BackupPayloadV2, "version">,
    WorkspaceBackupData {
  version: 3;
}

export type BackupPayload = BackupPayloadV3;
export type RestorableBackupPayload =
  | BackupPayloadV3
  | BackupPayloadV2
  | LegacyBackupPayload;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid backup: ${key}`);
  }
  return value;
}

function requireFiniteNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid backup: ${key}`);
  }
  return value;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${btoa(chunks.join(""))}`;
}

function base64ToBlob(
  dataUrl: string,
  fallbackMimeType = "application/octet-stream"
): Blob {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const dataUrlMimeType = dataUrl.match(/^data:([^;,]+);base64,/)?.[1];
  if (!base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 === 1) {
    throw new Error("Invalid backup: malformed file content");
  }
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("Invalid backup: malformed file content");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: dataUrlMimeType || fallbackMimeType });
}

function withoutProviderSecrets(settings: unknown): AiProviderSettings {
  const sanitized = sanitizeAiProviderSettings(settings);
  return {
    activeProviderId: sanitized.activeProviderId,
    providers: sanitized.providers.map((provider) => ({ ...provider, apiKey: "" })),
  };
}

export async function createBackupPayload(input?: {
  aiSettings?: { baseUrl: string; apiKey: string; model: string };
  aiProviderSettings?: AiProviderSettings;
}): Promise<BackupPayload> {
  const [
    books,
    positions,
    annotations,
    groups,
    dailyReadingStats,
    customBackground,
    readingWorkspaces,
    workspaceBooks,
    workspaceSessions,
    workspaceMessages,
    workspaceArtifacts,
    workspaceMemories,
  ] = await Promise.all([
      listBookMetadata(),
      listReadingPositions(),
      listAllAnnotations(),
      listBookGroups(),
      listDailyReadingStats(),
      getCustomBackgroundRecord(),
      listAllReadingWorkspaces(),
      listAllWorkspaceBooks(),
      listAllWorkspaceSessions(),
      listAllWorkspaceMessages(),
      listAllWorkspaceArtifacts(),
      listAllWorkspaceMemories(),
    ]);

  const backupBooks: BackupBookMeta[] = [];
  for (const book of books) {
    const fileBlob = await getBookFile(book.id);
    if (!fileBlob) {
      throw new Error(`Stored file is unavailable for book ${book.id}.`);
    }
    backupBooks.push({
      id: book.id,
      title: book.title,
      format: book.format,
      fileName: book.fileName,
      size: book.size,
      createdAt: book.createdAt,
      lastOpenedAt: book.lastOpenedAt,
      fileContent: await blobToBase64(fileBlob),
      groupIds: book.groupIds,
      enrichment: book.enrichment,
    });
  }

  const providerSettings = withoutProviderSecrets(
    input?.aiProviderSettings ?? loadAiProviderSettings()
  );
  const legacyAiSettings = input?.aiSettings ?? {
    baseUrl: providerSettings.providers[0]?.baseUrl ?? DEFAULT_AI_SETTINGS.baseUrl,
    apiKey: "",
    model: providerSettings.providers[0]?.model ?? DEFAULT_AI_SETTINGS.model,
  };

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    books: backupBooks,
    readingPositions: positions,
    annotations,
    bookGroups: groups,
    dailyReadingStats,
    customBackground: customBackground
      ? {
          imageContent: await blobToBase64(customBackground.imageBlob),
          updatedAt: customBackground.updatedAt,
        }
      : null,
    aiProviderSettings: providerSettings,
    aiSettings: {
      baseUrl: legacyAiSettings.baseUrl,
      model: legacyAiSettings.model,
    },
    readingWorkspaces,
    workspaceBooks,
    workspaceSessions,
    workspaceMessages,
    workspaceArtifacts,
    workspaceMemories,
  };
}

function optionalBoundedString(
  value: unknown,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`Invalid backup: ${label}`);
  }
  return value;
}

function validateBoundedStringArray(
  value: unknown,
  label: string,
  maxItems: number,
  maxLength: number
): string[] | undefined {
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some(
      (item) =>
        typeof item !== "string" || !item.trim() || item.length > maxLength
    )
  ) {
    throw new Error(`Invalid backup: ${label}`);
  }
  return [...value];
}

const ENRICHMENT_STATUSES = new Set<BookEnrichmentStatus>([
  "pending",
  "complete",
  "partial",
  "failed",
]);
const ENRICHMENT_ERRORS = new Set<BookEnrichmentError>([
  "no-match",
  "offline",
  "timeout",
  "provider",
  "invalid-response",
]);
const ENRICHMENT_SOURCES = new Set<BookMetadataSource>([
  "open-library",
  "google-books",
  "ai",
]);
const ENRICHMENT_FIELDS = new Set<BookMetadataField>([
  "bibliographicTitle",
  "authors",
  "description",
  "subjects",
  "publisher",
  "publishedDate",
  "language",
  "identifiers",
  "cover",
]);

function validateProvenance(
  value: unknown,
  label: string
): BookMetadataProvenance {
  if (!isRecord(value) || !ENRICHMENT_SOURCES.has(value.source as BookMetadataSource)) {
    throw new Error(`Invalid backup: ${label}`);
  }
  if (value.generated !== undefined && typeof value.generated !== "boolean") {
    throw new Error(`Invalid backup: ${label}.generated`);
  }
  return {
    source: value.source as BookMetadataSource,
    sourceId: optionalBoundedString(value.sourceId, `${label}.sourceId`, 300),
    generated: value.generated as boolean | undefined,
  };
}

function validateBookEnrichment(value: unknown): BookEnrichment | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("Invalid backup: enrichment");
  if (!ENRICHMENT_STATUSES.has(value.status as BookEnrichmentStatus)) {
    throw new Error("Invalid backup: enrichment.status");
  }

  let identifiers: BookEnrichment["identifiers"];
  if (value.identifiers !== undefined) {
    if (
      !Array.isArray(value.identifiers) ||
      value.identifiers.length > BOOK_METADATA_LIMITS.identifiers
    ) {
      throw new Error("Invalid backup: enrichment.identifiers");
    }
    identifiers = value.identifiers.map((identifier, index) => {
      if (!isRecord(identifier)) {
        throw new Error(`Invalid backup: enrichment.identifiers.${index}`);
      }
      const type = optionalBoundedString(
        identifier.type,
        `enrichment.identifiers.${index}.type`,
        BOOK_METADATA_LIMITS.identifierType
      );
      const identifierValue = optionalBoundedString(
        identifier.value,
        `enrichment.identifiers.${index}.value`,
        BOOK_METADATA_LIMITS.identifierValue
      );
      if (!type || !identifierValue) {
        throw new Error(`Invalid backup: enrichment.identifiers.${index}`);
      }
      return { type, value: identifierValue };
    });
  }

  let fieldSources: BookEnrichment["fieldSources"];
  if (value.fieldSources !== undefined) {
    if (!isRecord(value.fieldSources)) {
      throw new Error("Invalid backup: enrichment.fieldSources");
    }
    fieldSources = {};
    for (const [field, source] of Object.entries(value.fieldSources)) {
      if (!ENRICHMENT_FIELDS.has(field as BookMetadataField)) continue;
      fieldSources[field as BookMetadataField] = validateProvenance(
        source,
        `enrichment.fieldSources.${field}`
      );
    }
  }

  if (
    value.matchScore !== undefined &&
    (typeof value.matchScore !== "number" ||
      !Number.isFinite(value.matchScore) ||
      value.matchScore < 0 ||
      value.matchScore > 1)
  ) {
    throw new Error("Invalid backup: enrichment.matchScore");
  }
  if (
    value.errorCode !== undefined &&
    !ENRICHMENT_ERRORS.has(value.errorCode as BookEnrichmentError)
  ) {
    throw new Error("Invalid backup: enrichment.errorCode");
  }

  return {
    bibliographicTitle: optionalBoundedString(
      value.bibliographicTitle,
      "enrichment.bibliographicTitle",
      BOOK_METADATA_LIMITS.title
    ),
    authors: validateBoundedStringArray(
      value.authors,
      "enrichment.authors",
      BOOK_METADATA_LIMITS.authorCount,
      BOOK_METADATA_LIMITS.author
    ),
    description: optionalBoundedString(
      value.description,
      "enrichment.description",
      BOOK_METADATA_LIMITS.description
    ),
    subjects: validateBoundedStringArray(
      value.subjects,
      "enrichment.subjects",
      BOOK_METADATA_LIMITS.subjectCount,
      BOOK_METADATA_LIMITS.subject
    ),
    publisher: optionalBoundedString(
      value.publisher,
      "enrichment.publisher",
      BOOK_METADATA_LIMITS.publisher
    ),
    publishedDate: optionalBoundedString(
      value.publishedDate,
      "enrichment.publishedDate",
      BOOK_METADATA_LIMITS.publishedDate
    ),
    language: optionalBoundedString(
      value.language,
      "enrichment.language",
      BOOK_METADATA_LIMITS.language
    ),
    identifiers,
    status: value.status as BookEnrichmentStatus,
    matchScore: value.matchScore as number | undefined,
    attemptedAt: requireString(value, "attemptedAt"),
    updatedAt: optionalBoundedString(value.updatedAt, "enrichment.updatedAt", 80),
    errorCode: value.errorCode as BookEnrichmentError | undefined,
    fieldSources,
  };
}

function validateBook(value: unknown): BackupBookMeta {
  if (!isRecord(value)) throw new Error("Invalid backup: book");
  const format = value.format;
  if (format !== "epub" && format !== "txt") {
    throw new Error("Invalid backup: book format");
  }
  const groupIds = value.groupIds;
  if (groupIds !== undefined && (!Array.isArray(groupIds) || groupIds.some((id) => typeof id !== "string"))) {
    throw new Error("Invalid backup: book groupIds");
  }
  return {
    id: requireString(value, "id"),
    title: requireString(value, "title"),
    format,
    fileName: requireString(value, "fileName"),
    size: requireFiniteNumber(value, "size"),
    createdAt: requireString(value, "createdAt"),
    lastOpenedAt: typeof value.lastOpenedAt === "string" ? value.lastOpenedAt : undefined,
    fileContent: requireString(value, "fileContent"),
    groupIds: groupIds as string[] | undefined,
    enrichment: validateBookEnrichment(value.enrichment),
  };
}

function validateArray<T>(
  value: unknown,
  label: string,
  validateItem: (item: unknown) => T
): T[] {
  if (!Array.isArray(value)) throw new Error(`Invalid backup: missing ${label} array`);
  return value.map(validateItem);
}

function validatePosition(value: unknown): ReadingPosition {
  if (!isRecord(value)) throw new Error("Invalid backup: reading position");
  const progressPercent = requireFiniteNumber(value, "progressPercent");
  return {
    bookId: requireString(value, "bookId"),
    locator: requireString(value, "locator"),
    progressPercent,
    readingMode: value.readingMode === "paged" || value.readingMode === "scroll"
      ? value.readingMode
      : undefined,
    updatedAt: requireString(value, "updatedAt"),
  };
}

function validateAnnotation(value: unknown): AnnotationRecord {
  if (!isRecord(value)) throw new Error("Invalid backup: annotation");
  const kind = value.kind === "bookmark" ? "bookmark" : "highlight";
  const color =
    value.color === "green" || value.color === "blue" || value.color === "yellow"
      ? value.color
      : "yellow";
  return {
    id: requireString(value, "id"),
    bookId: requireString(value, "bookId"),
    kind,
    locator: typeof value.locator === "string" ? value.locator : undefined,
    text: requireString(value, "text"),
    note: typeof value.note === "string" ? value.note : undefined,
    ...(kind === "highlight" ? { color } : {}),
    progressPercent:
      typeof value.progressPercent === "number" && Number.isFinite(value.progressPercent)
        ? value.progressPercent
        : undefined,
    pageNumber:
      typeof value.pageNumber === "number" && Number.isFinite(value.pageNumber)
        ? Math.max(1, Math.floor(value.pageNumber))
        : undefined,
    createdAt: requireString(value, "createdAt"),
  };
}

function validateGroup(value: unknown): BookGroup {
  if (!isRecord(value)) throw new Error("Invalid backup: book group");
  return {
    id: requireString(value, "id"),
    name: requireString(value, "name"),
    createdAt: requireString(value, "createdAt"),
    updatedAt: requireString(value, "updatedAt"),
  };
}

function validateDailyStat(value: unknown): DailyReadingStat {
  if (!isRecord(value)) throw new Error("Invalid backup: daily reading stat");
  const secondsRead = requireFiniteNumber(value, "secondsRead");
  if (secondsRead < 0) throw new Error("Invalid backup: secondsRead");
  return {
    date: requireString(value, "date"),
    secondsRead: Math.floor(secondsRead),
    updatedAt: requireString(value, "updatedAt"),
  };
}

export function validateBackupPayload(data: unknown): RestorableBackupPayload {
  if (!isRecord(data)) throw new Error("Invalid backup format");
  if (data.version !== 1 && data.version !== 2 && data.version !== 3) {
    throw new Error("Invalid backup: unsupported version");
  }
  const common = {
    exportedAt: requireString(data, "exportedAt"),
    books: validateArray(data.books, "books", validateBook),
    readingPositions: validateArray(
      data.readingPositions,
      "readingPositions",
      validatePosition
    ),
    annotations: validateArray(data.annotations, "annotations", validateAnnotation),
    bookGroups: data.bookGroups === undefined
      ? []
      : validateArray(data.bookGroups, "bookGroups", validateGroup),
  };

  if (data.version === 1) {
    return {
      version: 1,
      ...common,
      aiSettings: isRecord(data.aiSettings)
        ? {
            baseUrl: typeof data.aiSettings.baseUrl === "string" ? data.aiSettings.baseUrl : undefined,
            model: typeof data.aiSettings.model === "string" ? data.aiSettings.model : undefined,
          }
        : undefined,
    };
  }

  const customBackground = data.customBackground;
  if (customBackground !== null && !isRecord(customBackground)) {
    throw new Error("Invalid backup: custom background");
  }
  const modernPayload = {
    ...common,
    dailyReadingStats: validateArray(
      data.dailyReadingStats,
      "dailyReadingStats",
      validateDailyStat
    ),
    customBackground: customBackground
      ? {
          imageContent: requireString(customBackground, "imageContent"),
          updatedAt: requireString(customBackground, "updatedAt"),
        }
      : null,
    aiProviderSettings: withoutProviderSecrets(
      data.aiProviderSettings ?? DEFAULT_AI_PROVIDER_SETTINGS
    ),
    aiSettings: isRecord(data.aiSettings)
      ? {
          baseUrl: typeof data.aiSettings.baseUrl === "string" ? data.aiSettings.baseUrl : "",
          model: typeof data.aiSettings.model === "string" ? data.aiSettings.model : "",
        }
      : { baseUrl: "", model: "" },
  };

  if (data.version === 2) {
    return {
      version: 2,
      ...modernPayload,
    };
  }

  return {
    version: 3,
    ...modernPayload,
    ...validateWorkspaceBackupData(
      data,
      new Set(common.books.map((book) => book.id))
    ),
  };
}

export function prepareBackupRestore(data: unknown) {
  const payload = validateBackupPayload(data);
  const books: BookRecord[] = payload.books.map((book) => ({
    id: book.id,
    title: book.title,
    format: book.format,
    fileName: book.fileName,
    fileBlob: base64ToBlob(
      book.fileContent,
      book.format === "epub" ? "application/epub+zip" : "text/plain"
    ),
    size: book.size,
    createdAt: book.createdAt,
    lastOpenedAt: book.lastOpenedAt,
    ...(book.groupIds ? { groupIds: book.groupIds } : {}),
    ...(book.enrichment ? { enrichment: book.enrichment } : {}),
  }));

  let customBackground: CustomBackgroundRecord | null | undefined;
  if (payload.version === 2 || payload.version === 3) {
    customBackground = payload.customBackground
      ? {
          id: "app-background",
          imageBlob: base64ToBlob(payload.customBackground.imageContent),
          updatedAt: payload.customBackground.updatedAt,
        }
      : null;
  }

  const workspaceData =
    payload.version === 3 ? payload : emptyWorkspaceBackupData();

  return { payload, data: {
    books,
    readingPositions: payload.readingPositions,
    annotations: payload.annotations,
    bookGroups: payload.bookGroups ?? [],
    readingWorkspaces: workspaceData.readingWorkspaces,
    workspaceBooks: workspaceData.workspaceBooks,
    workspaceSessions: workspaceData.workspaceSessions,
    workspaceMessages: workspaceData.workspaceMessages,
    workspaceArtifacts: workspaceData.workspaceArtifacts,
    workspaceMemories: workspaceData.workspaceMemories,
    dailyReadingStats:
      payload.version === 2 || payload.version === 3
        ? payload.dailyReadingStats
        : undefined,
    customBackground,
  } };
}

export type PreparedBackupRestore = ReturnType<typeof prepareBackupRestore>;

export async function restorePreparedBackup(
  prepared: PreparedBackupRestore,
  options?: { expectedRevision?: number; saveProviders?: typeof saveAiProviderSettingsToStorage }
): Promise<{ configurationSaved: boolean }> {
  const { payload, data } = prepared;
  await replaceReaderData(data, options?.expectedRevision);

  let configurationSaved = true;
  if (payload.version === 2 || payload.version === 3) {
    configurationSaved = (options?.saveProviders ?? saveAiProviderSettingsToStorage)(payload.aiProviderSettings);
  } else if (payload.aiSettings) {
    configurationSaved = saveAiSettingsToStorage({
      baseUrl: payload.aiSettings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
      model: payload.aiSettings.model || DEFAULT_AI_SETTINGS.model,
      apiKey: "",
    });
  }
  return { configurationSaved };
}

export async function restoreBackupPayload(data: unknown, options?: { expectedRevision?: number }): Promise<void> {
  await restorePreparedBackup(prepareBackupRestore(data), options);
}
