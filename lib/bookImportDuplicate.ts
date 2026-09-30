import {
  getBookFile,
  getReaderDataRevision,
  listBookMetadata,
  saveBookAtRevision,
  type BookCommitOptions,
  type BookMetadata,
  type BookRecord,
} from "./db";
import { readBookFileBytes } from "./bookFileBytes";

const sessionDigests = new Map<string, string>();
let digestRevision = "";

export class BookDuplicateDetectionError extends Error {
  constructor(cause?: unknown) {
    super("无法完成重复书籍检查，请重试或明确选择继续导入。", { cause });
    this.name = "BookDuplicateDetectionError";
  }
}

export type BookImportCommitResult =
  | { kind: "saved" }
  | { kind: "duplicate"; book: BookMetadata };

async function hash(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await readBookFileBytes(blob));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function inspectAndCommitBook(
  record: BookRecord,
  options: BookCommitOptions & { allowDuplicate?: boolean } = {}
): Promise<BookImportCommitResult> {
  let incomingHash: string | undefined;
  // Hash outside IndexedDB transactions, then compare-and-insert under the
  // shared revision lock. A racing tab forces a fresh inspection, not a bypass.
  for (let attempt = 0; attempt < 5; attempt++) {
    if (options.shouldCommit && !options.shouldCommit()) {
      throw new DOMException("Import cancelled", "AbortError");
    }
    const { revision, epoch } = await getReaderDataRevision();
    const snapshot = `${epoch}:${revision}`;
    // Conservative invalidation includes writes from other tabs and restoration.
    if (digestRevision !== snapshot) { sessionDigests.clear(); digestRevision = snapshot; }
    if (!options.allowDuplicate) {
      try {
        const candidates = (await listBookMetadata()).filter(
          (book) => book.format === record.format && book.size === record.size
        );
        for (const candidate of candidates) {
          incomingHash ??= await hash(record.fileBlob);
          let candidateHash = sessionDigests.get(candidate.id);
          if (!candidateHash) {
            const file = await getBookFile(candidate.id);
            if (!file) throw new Error(`Stored file is unavailable: ${candidate.id}`);
            candidateHash = await hash(file);
            if (digestRevision === snapshot) sessionDigests.set(candidate.id, candidateHash);
          }
          if (candidateHash === incomingHash) {
            // Do not report a duplicate that was removed/replaced during hashing.
            if ((await getReaderDataRevision()).revision !== revision) break;
            return { kind: "duplicate", book: candidate };
          }
        }
      } catch (cause) {
        throw new BookDuplicateDetectionError(cause);
      }
    }
    if (await saveBookAtRevision(record, revision, options)) return { kind: "saved" };
  }
  throw new BookDuplicateDetectionError(new Error("Library kept changing during duplicate inspection"));
}
