"use client";
import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { createBookRecordFromFile } from "@/lib/importBook";
import { BookDuplicateDetectionError, inspectAndCommitBook } from "@/lib/bookImportDuplicate";
import { listBookMetadata, type BookMetadata, type BookRecord } from "@/lib/db";
import { getBookImportErrorMessage } from "@/lib/bookImportError";
import { hasIndexedDbSupport } from "@/lib/browserStorage";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { currentDataTransfer, tryAcquireDataTransfer } from "@/lib/localDataTransfer";
import { appUpdate } from "@/lib/appUpdate";
import useUpdateProtection from "./useUpdateProtection";

type Stage = "idle" | "reading" | "parsing" | "checking" | "decision" | "saving" | "saved";
type Decision = { existing?: BookMetadata; detectionFailed?: boolean };

export default function useBookImport(options: {
  inputRef: RefObject<HTMLInputElement | null>;
  onSaved: (books: BookMetadata[], book: BookRecord) => void;
  onError: (message: string | null) => void;
  onExistingFound: () => Promise<void>;
}) {
  const { inputRef } = options;
  const currentRef = useRef<{ generation: number; release: () => void; committed: boolean; record?: BookRecord } | null>(null);
  const generationRef = useRef(0);
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [savedBook, setSavedBook] = useState<BookMetadata | null>(null);
  const busy = !["idle", "saved"].includes(stage);
  useUpdateProtection({ label: "图书导入", busy });
  useEffect(() => () => { currentRef.current?.release(); currentRef.current = null; }, []);

  function finish() { currentRef.current?.release(); currentRef.current = null; }
  function cancel() {
    if (currentRef.current?.committed) return;
    finish();
    setDecision(null);
    setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function commit(allowDuplicate = false) {
    const operation = currentRef.current;
    if (!operation?.record) return;
    const record = operation.record;
    const isCurrent = () => currentRef.current === operation;
    setDecision(null);
    setStage("checking");
    try {
      const result = await inspectAndCommitBook(record, {
        allowDuplicate,
        shouldCommit: isCurrent,
        onCommit: () => { if (isCurrent()) { operation.committed = true; setStage("saving"); } },
      });
      if (!isCurrent()) return;
      if (result.kind === "duplicate") {
        await options.onExistingFound();
        if (!isCurrent()) return;
        operation.committed = false;
        setDecision({ existing: result.book });
        setStage("decision");
        return;
      }
      setSavedBook(record);
      setStage("saved");
      options.onSaved(await listBookMetadata(), record);
      finish();
    } catch (error) {
      if (!isCurrent()) return;
      operation.committed = false;
      if (error instanceof BookDuplicateDetectionError) {
        setDecision({ detectionFailed: true }); setStage("decision"); return;
      }
      options.onError(getBookImportErrorMessage(error));
      finish(); setStage("idle");
    }
  }

  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || currentRef.current || appUpdate.getSnapshot().updating) return;
    options.onError(null);
    if (!hasIndexedDbSupport(window)) { options.onError(getBookImportErrorMessage(new Error("indexeddb-unavailable"))); return; }
    const release = tryAcquireDataTransfer("图书导入");
    if (!release) { options.onError(`${currentDataTransfer()}正在进行，请完成后重试。`); return; }
    const operation = { generation: ++generationRef.current, release, committed: false, record: undefined as BookRecord | undefined };
    currentRef.current = operation;
    setFileName(file.name); setSavedBook(null); setStage("reading");
    void requestPersistentStorage();
    try {
      const record = await createBookRecordFromFile(file, (next) => { if (currentRef.current === operation) setStage(next); });
      if (currentRef.current !== operation) return;
      operation.record = record;
      await commit();
    } catch (error) {
      if (currentRef.current !== operation) return;
      options.onError(getBookImportErrorMessage(error));
      finish(); setStage("idle");
    }
  }
  return { stage, busy, fileName, decision, savedBook, select, cancel,
    importAnother: () => commit(true),
    dismissStatus: () => { if (!busy) { setStage("idle"); setSavedBook(null); } },
  };
}
