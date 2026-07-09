"use client";

import { useCallback, useState, type RefObject } from "react";
import type { AiConversationMessage } from "@/app/AskAiPanel";
import type { EpubReaderHandle } from "@/app/EpubReader";
import {
  limitContextText,
  type AiContext,
  type ChatConversationMessage,
} from "@/lib/aiChat";
import type { AiProviderConfig } from "@/lib/aiProviders";
import type { BookRecord } from "@/lib/db";
import { UI_TEXT } from "@/lib/uiText";

type UseAskAiOptions = {
  openBook: BookRecord | null;
  activeAiProvider: AiProviderConfig | null;
  aiProviderUsable: boolean;
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
};

function collectVisibleReaderText(reader: HTMLElement | null): string {
  if (!reader) return "";
  const viewport = reader.getBoundingClientRect();
  const paragraphs = Array.from(reader.querySelectorAll("p"));
  const visibleParagraphs = paragraphs
    .filter((paragraph) => {
      const rects = paragraph.getClientRects();
      for (let index = 0; index < rects.length; index += 1) {
        const rect = rects[index];
        if (
          rect.bottom >= viewport.top - 80 &&
          rect.top <= viewport.bottom + 80 &&
          rect.right >= viewport.left - 80 &&
          rect.left <= viewport.right + 80
        ) {
          return true;
        }
      }
      return false;
    })
    .map((paragraph) => paragraph.textContent?.trim() ?? "")
    .filter(Boolean);

  if (visibleParagraphs.length > 0) {
    return visibleParagraphs.join("\n\n");
  }
  return reader.innerText ?? "";
}

function createAiConversationMessage(
  role: AiConversationMessage["role"],
  content: string
): AiConversationMessage {
  return {
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export default function useAskAi({
  openBook,
  activeAiProvider,
  aiProviderUsable,
  textReaderRef,
  epubReaderRef,
}: UseAskAiOptions) {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AiConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSelectedText(null);
    setQuestion("");
    setMessages([]);
    setError(null);
    setLoading(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedText(null);
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }, []);

  const getCurrentReadingContextText = useCallback((): string => {
    const visibleText =
      openBook?.format === "epub"
        ? epubReaderRef.current?.getVisibleText()
        : collectVisibleReaderText(textReaderRef.current);
    return limitContextText(visibleText, 6000);
  }, [epubReaderRef, openBook, textReaderRef]);

  const ask = useCallback(async () => {
    const submittedQuestion = question.trim();
    if (!submittedQuestion) return;
    if (!activeAiProvider || !aiProviderUsable) {
      setError(UI_TEXT.CONFIGURE_AI_PROMPT);
      return;
    }

    setLoading(true);
    setError(null);
    setQuestion("");

    const context: AiContext = {
      nearbyText: getCurrentReadingContextText(),
    };
    if (openBook) {
      context.bookTitle = openBook.title;
      context.bookFormat = openBook.format;
    }
    if (selectedText) {
      context.selectedText = selectedText;
    }
    if (!context.nearbyText) {
      delete context.nearbyText;
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      createAiConversationMessage("user", submittedQuestion),
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeAiProvider,
          question: submittedQuestion,
          messages: messages.map((message): ChatConversationMessage => ({
            role: message.role,
            content: message.content,
          })),
          context,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `${UI_TEXT.REQUEST_FAILED} (${res.status})`);
      }

      const data = await res.json();
      setMessages((currentMessages) => [
        ...currentMessages,
        createAiConversationMessage(
          "assistant",
          typeof data.answer === "string" ? data.answer : ""
        ),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : UI_TEXT.REQUEST_FAILED);
    } finally {
      setLoading(false);
    }
  }, [
    activeAiProvider,
    aiProviderUsable,
    getCurrentReadingContextText,
    messages,
    openBook,
    question,
    selectedText,
  ]);

  return {
    selectedText,
    setSelectedText,
    question,
    setQuestion,
    messages,
    loading,
    error,
    reset,
    clearSelection,
    ask,
  };
}
