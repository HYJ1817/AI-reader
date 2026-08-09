"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import styles from "./page.module.css";
import {
  AI_API_FORMATS,
  AI_PROVIDER_PRESETS,
  createEmptyAiProvider,
  createAiProviderFromPreset,
  getAiApiFormat,
  materializeAiProviderBaseUrl,
  resolveAiProviderFormatBaseUrl,
  sanitizeAiProviderSettings,
  type AiProviderConfig,
  type AiProviderKind,
  type AiProviderModel,
  type AiProviderProtocol,
  type AiProviderSettings,
} from "@/lib/aiProviders";
import type { AiModelRefreshErrorCode } from "@/lib/aiModelRefresh";
import {
  getAiProviderDraftRequirements,
  getAiProviderSaveHint,
} from "@/lib/aiProviderDraftRequirements";
import {
  getAiProviderCredentialSummary,
  getAiProviderHealth,
  getAiProviderModelCount,
  type AiProviderHealth,
} from "@/lib/aiProviderPresentation";
import { getRoleTransition } from "@/lib/motionSystem";
import { useAppReducedMotion } from "./AppMotionRoot";
import {
  AddIcon,
  CheckIcon,
  ChevronRightIcon,
  ImportIcon,
} from "./UiGlyphs";

type DraftProvider = Omit<AiProviderConfig, "protocol"> & {
  protocol: AiProviderProtocol | "";
};

type ModelRefreshFailure = {
  code: AiModelRefreshErrorCode;
  retryable: boolean;
};

type ModelRefreshError = Error & {
  refreshFailure?: ModelRefreshFailure;
};

const PROVIDER_COMPACT_LABEL: Record<
  Exclude<AiProviderKind, "custom">,
  string
> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
  xai: "xAI",
};

export type AiSettingsSurfaceProps = {
  mode: "list" | "configure";
  settings: AiProviderSettings;
  providerId?: string;
  onPushConfigure: (providerId?: string) => void;
  onBack: () => void;
  onSave: (settings: AiProviderSettings) => void;
};

function apiFormatLabel(protocol: AiProviderProtocol | ""): string {
  if (!protocol) return "请选择";
  return getAiApiFormat(protocol).label;
}

function toDraft(provider: AiProviderConfig): DraftProvider {
  return { ...provider };
}

function createDraft(): DraftProvider {
  return {
    ...createEmptyAiProvider({
      label: "自定义服务商",
      baseUrl: "",
      model: "",
      models: [],
      appendDefaultPath: false,
      defaultPath: "",
    }),
    protocol: "",
  };
}

function dedupeModels(models: AiProviderModel[]): AiProviderModel[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

function providerHealthClass(health: AiProviderHealth): string {
  switch (health) {
    case "ready":
      return styles.providerStatusDotReady;
    case "needs-attention":
      return styles.providerStatusDotAttention;
    case "empty":
      return styles.providerStatusDotEmpty;
  }
}

function modelRefreshErrorMessage(code: AiModelRefreshErrorCode): string {
  switch (code) {
    case "auth":
      return "API Key 无效或没有权限访问模型列表";
    case "billing":
      return "服务商账户需要先完成计费设置";
    case "rate-limit":
      return "请求过于频繁，请稍后重试";
    case "invalid-response":
      return "服务商返回的模型列表格式无法识别";
    case "network":
      return "网络或服务商暂时不可用";
  }
}

function createInitialDraft(
  mode: "list" | "configure",
  settings: AiProviderSettings,
  providerId?: string
): DraftProvider | null {
  if (mode === "list") return null;
  if (!providerId) return createDraft();

  const provider = settings.providers.find((item) => item.id === providerId);
  return provider ? toDraft(provider) : createDraft();
}

export default function AiSettingsSurface({
  mode,
  settings,
  providerId,
  onPushConfigure,
  onBack,
  onSave,
}: AiSettingsSurfaceProps) {
  const reduceMotion = useAppReducedMotion();
  const editingProviderId = providerId ?? null;
  const [draft, setDraft] = useState<DraftProvider | null>(() =>
    createInitialDraft(mode, settings, providerId)
  );
  const [manualModel, setManualModel] = useState("");
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [modelRefreshStatus, setModelRefreshStatus] = useState("");
  const [modelRefreshFailure, setModelRefreshFailure] =
    useState<ModelRefreshFailure | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [providerImportStatus, setProviderImportStatus] = useState("");
  const [providerListEditing, setProviderListEditing] = useState(false);
  const refreshRequestIdRef = useRef(0);
  const addMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const providerImportInputRef = useRef<HTMLInputElement>(null);
  const activeProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === settings.activeProviderId) ??
      null,
    [settings]
  );
  const hasProviders = settings.providers.length > 0;

  useEffect(() => {
    if (!addMenuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setAddMenuOpen(false);
      window.requestAnimationFrame(() => {
        addMenuTriggerRef.current?.focus({ preventScroll: true });
      });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        addMenuRef.current?.contains(target) ||
        addMenuTriggerRef.current?.contains(target)
      ) {
        return;
      }
      setAddMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [addMenuOpen]);

  function openProviderConfigure(providerId?: string) {
    setAddMenuOpen(false);
    onPushConfigure(providerId);
  }

  function handleProviderImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    void file
      .text()
      .then((raw) => {
        const parsed: unknown = JSON.parse(raw);
        const imported = sanitizeAiProviderSettings(parsed);
        if (
          !Array.isArray((parsed as { providers?: unknown } | null)?.providers) ||
          imported.providers.length === 0
        ) {
          throw new Error("文件中没有可导入的服务商配置");
        }

        const providersById = new Map(
          settings.providers.map((provider) => [provider.id, provider])
        );
        imported.providers.forEach((provider) => {
          providersById.set(provider.id, provider);
        });
        const providers = [...providersById.values()];
        onSave(
          sanitizeAiProviderSettings({
            activeProviderId: imported.activeProviderId ?? providers[0]?.id ?? null,
            providers,
          })
        );
        setProviderImportStatus(`已导入 ${imported.providers.length} 个服务商`);
        setAddMenuOpen(false);
      })
      .catch((error) => {
        setProviderImportStatus(
          error instanceof Error ? error.message : "导入失败，请选择有效的 JSON 配置文件"
        );
      });
  }

  function deleteProviderFromList(providerId: string) {
    const provider = settings.providers.find((item) => item.id === providerId);
    if (!provider || !window.confirm(`删除服务商“${provider.label}”？`)) return;
    const providers = settings.providers.filter((item) => item.id !== providerId);
    onSave(
      sanitizeAiProviderSettings({
        activeProviderId:
          settings.activeProviderId === providerId
            ? providers[0]?.id ?? null
            : settings.activeProviderId,
        providers,
      })
    );
    setProviderListEditing(false);
    setProviderImportStatus(`已删除 ${provider.label}`);
  }
  function updateDraft(next: Partial<DraftProvider>) {
    if (!draft) return;
    refreshRequestIdRef.current += 1;
    setRefreshingModels(false);
    setModelRefreshFailure(null);
    setDraft({ ...draft, ...next });
  }

  function changeProviderKind(kind: Exclude<AiProviderKind, "custom">) {
    if (!draft) return;
    refreshRequestIdRef.current += 1;
    setRefreshingModels(false);
    setModelRefreshFailure(null);
    setShowApiKey(false);
    const preset = materializeAiProviderBaseUrl(
      createAiProviderFromPreset(kind, {
        id: draft.id,
        apiKey: draft.apiKey,
        model: "",
        models: [],
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      })
    );
    setDraft({
      ...draft,
      kind: preset.kind,
      protocol: preset.protocol,
      label: preset.label,
      baseUrl: preset.baseUrl,
      defaultPath: preset.defaultPath,
      appendDefaultPath: preset.appendDefaultPath,
      model: "",
      models: [],
    });
    setManualModel("");
    setModelRefreshStatus("");
  }

  function changeProtocol(protocol: AiProviderProtocol) {
    if (!draft) return;
    refreshRequestIdRef.current += 1;
    setRefreshingModels(false);
    setModelRefreshFailure(null);
    setShowApiKey(false);
    const format = getAiApiFormat(protocol);
    const baseUrl = resolveAiProviderFormatBaseUrl({
      currentBaseUrl: draft.baseUrl,
      protocol,
      appendDefaultPath: draft.appendDefaultPath,
    });
    const manualModels = draft.models.filter((model) => model.source === "manual");
    setDraft({
      ...draft,
      kind: "custom",
      protocol,
      baseUrl,
      defaultPath: format.defaultPath,
      models: manualModels,
      model: manualModels.some((model) => model.id === draft.model)
        ? draft.model
        : manualModels[0]?.id ?? "",
    });
    setModelRefreshStatus("");
  }

  function toggleAppendDefaultPath(appendDefaultPath: boolean) {
    if (!draft || !draft.protocol) return;
    const format = getAiApiFormat(draft.protocol);
    const baseUrl = appendDefaultPath
      ? resolveAiProviderFormatBaseUrl({
          currentBaseUrl: draft.baseUrl,
          protocol: draft.protocol,
          appendDefaultPath: true,
        })
      : draft.baseUrl.trim().replace(/\/+$/, "");
    setDraft({
      ...draft,
      defaultPath: format.defaultPath,
      baseUrl,
      appendDefaultPath,
    });
  }

  function addManualModel() {
    if (!draft) return;
    const id = manualModel.trim();
    if (!id) return;
    const nextModels = dedupeModels([
      ...draft.models,
      { id, label: id, source: "manual" },
    ]);
    setDraft({ ...draft, model: id, models: nextModels });
    setManualModel("");
    setModelRefreshStatus("");
    setModelRefreshFailure(null);
  }

  function removeModel(id: string) {
    if (!draft) return;
    const nextModels = draft.models.filter((model) => model.id !== id);
    setDraft({
      ...draft,
      models: nextModels,
      model: draft.model === id ? nextModels[0]?.id ?? "" : draft.model,
    });
    setModelRefreshFailure(null);
  }

  async function refreshModels() {
    if (!draft || !draft.protocol || !draft.baseUrl.trim() || !draft.apiKey.trim()) {
      setModelRefreshStatus("请先选择服务商，并填写 API 地址和 API Key。");
      return;
    }
    const requestId = refreshRequestIdRef.current + 1;
    refreshRequestIdRef.current = requestId;
    setRefreshingModels(true);
    setModelRefreshStatus("");
    setModelRefreshFailure(null);
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: draft }),
      });
      const data = (await response.json()) as {
        models?: AiProviderModel[];
        error?: string;
        errorCode?: AiModelRefreshErrorCode;
        retryable?: boolean;
      };
      if (!response.ok || !Array.isArray(data.models)) {
        const error = new Error(
          data.error ||
            modelRefreshErrorMessage(data.errorCode ?? "invalid-response")
        ) as ModelRefreshError;
        error.refreshFailure = {
          code: data.errorCode ?? "invalid-response",
          retryable: data.retryable ?? false,
        };
        throw error;
      }
      if (refreshRequestIdRef.current !== requestId) return;
      const remoteModels = data.models.map((model) => ({ ...model, source: "remote" as const }));
      const manualModels = draft.models.filter((model) => model.source === "manual");
      const models = dedupeModels([...remoteModels, ...manualModels]);
      setDraft({
        ...draft,
        models,
        model: draft.model || models[0]?.id || "",
      });
      setModelRefreshStatus(
        models.length > 0 ? `已刷新 ${remoteModels.length} 个模型。` : "没有返回模型，可手动添加。"
      );
      setModelRefreshFailure(null);
    } catch (err) {
      if (refreshRequestIdRef.current !== requestId) return;
      const failure: ModelRefreshFailure =
        err instanceof Error && (err as ModelRefreshError).refreshFailure
          ? (err as ModelRefreshError).refreshFailure!
          : { code: "network", retryable: true };
      setModelRefreshFailure(failure);
      setModelRefreshStatus(
        err instanceof Error && (err as ModelRefreshError).refreshFailure
          ? modelRefreshErrorMessage(failure.code)
          : "网络或服务商暂时不可用"
      );
    } finally {
      if (refreshRequestIdRef.current === requestId) {
        setRefreshingModels(false);
      }
    }
  }

  function retryableRefresh() {
    if (!modelRefreshFailure?.retryable || refreshingModels) return;
    void refreshModels();
  }

  function saveDraft() {
    if (
      !draft ||
      !draft.protocol ||
      getAiProviderDraftRequirements(draft).length > 0
    ) {
      return;
    }
    const now = new Date().toISOString();
    const normalized: AiProviderConfig = materializeAiProviderBaseUrl({
      ...draft,
      protocol: draft.protocol,
      label: draft.label.trim(),
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
      models: dedupeModels(draft.models),
      updatedAt: now,
    });
    const providers = editingProviderId
      ? settings.providers.map((provider) =>
          provider.id === editingProviderId ? normalized : provider
        )
      : [...settings.providers, normalized];

    onSave(
      sanitizeAiProviderSettings({
        activeProviderId: normalized.id,
        providers,
      })
    );
    onBack();
  }

  function deleteDraft() {
    if (!draft) return;
    const providers = settings.providers.filter((provider) => provider.id !== draft.id);
    onSave(
      sanitizeAiProviderSettings({
        activeProviderId:
          settings.activeProviderId === draft.id
            ? providers[0]?.id ?? null
            : settings.activeProviderId,
        providers,
      })
    );
    onBack();
  }

  const missingRequirements = getAiProviderDraftRequirements(draft);
  const saveHint = getAiProviderSaveHint(draft);
  const canSave = !!draft && missingRequirements.length === 0;
  const title = mode === "list" ? "AI 服务商" : editingProviderId ? "配置服务商" : "添加服务商";
  const inlineModelStatus = refreshingModels ? "正在刷新模型…" : modelRefreshStatus;

  return (
    <div
      className={styles.providerPushedSurface}
      data-provider-configure={mode === "configure" ? "true" : undefined}
      data-provider-editing={
        mode === "list" && providerListEditing ? "true" : undefined
      }
    >
      <div className={styles.providerSheetHeader}>
        <button
          type="button"
          className={styles.providerNavButton}
          aria-label={mode === "list" ? "返回设置" : "返回服务商"}
          onClick={onBack}
        >
          <svg
            className={styles.providerNavIcon}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M14.5 5 7.5 12l7 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2>{title}</h2>
        {mode === "list" ? (
          <div className={styles.providerHeaderActions}>
            {hasProviders ? (
              <button
                type="button"
                className={styles.providerHeaderEditButton}
                aria-pressed={providerListEditing}
                onClick={() => {
                  setProviderListEditing((editing) => !editing);
                  setProviderImportStatus("");
                }}
              >
                {providerListEditing ? "完成" : "编辑"}
              </button>
            ) : null}
            <button
              ref={addMenuTriggerRef}
              type="button"
              className={styles.providerHeaderAddButton}
              aria-label="AI 服务商菜单"
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((open) => !open)}
            >
              <AddIcon />
            </button>
            <AnimatePresence initial={false}>
              {addMenuOpen ? (
                <m.div
                  ref={addMenuRef}
                  className={styles.providerAddMenu}
                  data-provider-add-menu="true"
                  role="menu"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                  transition={getRoleTransition("popover-enter", reduceMotion)}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.providerAddMenuItem}
                    onClick={() => openProviderConfigure()}
                  >
                    <AddIcon />
                    <span>添加 AI 服务商</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.providerAddMenuItem}
                    onClick={() => providerImportInputRef.current?.click()}
                  >
                    <ImportIcon />
                    <span>导入服务商配置</span>
                  </button>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : (
          <span className={styles.providerHeaderSpacer} />
        )}
      </div>

      <input
        ref={providerImportInputRef}
        className={styles.providerImportInput}
        type="file"
        accept="application/json,.json"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleProviderImport}
      />

      <div
        className={styles.providerSheetBody}
        data-layout-shift-contained="true"
      >
          {mode === "list" && (
            <>
              <p className={styles.providerGroupLabel}>当前服务商</p>
              <div className={styles.providerListCard}>
                <AnimatePresence initial={false} mode="popLayout">
                {settings.providers.length > 0 ? (
                settings.providers.map((provider) => {
                  const active = provider.id === activeProvider?.id;
                  const health = getAiProviderHealth(provider);
                  const modelCount = getAiProviderModelCount(provider);
                  return (
                    <m.div
                        key={provider.id}
                      layout={reduceMotion ? false : "position"}
                      className={styles.providerChoiceRow}
                      data-provider-list-row="true"
                      data-provider-status={health}
                      data-provider-model-count={modelCount}
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                        animate={
                          reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                        }
                        exit={{
                          opacity: 0,
                          y: reduceMotion ? 0 : 6,
                          transition: getRoleTransition("state-exit", reduceMotion),
                        }}
                        transition={getRoleTransition("state-enter", reduceMotion)}
                      >
                        <button
                          type="button"
                          className={styles.providerChoiceMain}
                          aria-label={`${provider.label}，${getAiProviderCredentialSummary(provider)}，${modelCount} 个模型`}
                          onClick={() => openProviderConfigure(provider.id)}
                        >
                          <span className={styles.providerChoiceText}>
                            <strong>{provider.label}</strong>
                            <small>{getAiProviderCredentialSummary(provider)}</small>
                            <small>
                              {modelCount} 个模型 · {apiFormatLabel(provider.protocol)}
                            </small>
                          </span>
                          <span
                            className={`${styles.providerStatusDot} ${providerHealthClass(health)}`}
                            role="img"
                            aria-label={health === "ready" ? "已就绪" : health === "needs-attention" ? "需要完善" : "未配置"}
                          />
                          {active && <span className={styles.providerActiveBadge}>使用中</span>}
                          <ChevronRightIcon
                            className={styles.providerChoiceChevron}
                          />
                        </button>
                        {providerListEditing ? (
                          <button
                            type="button"
                            className={styles.providerListDelete}
                            data-provider-delete="true"
                            aria-label={`删除 ${provider.label}`}
                            onClick={() => deleteProviderFromList(provider.id)}
                          >
                            删除
                          </button>
                        ) : null}
                      </m.div>
                    );
                  })
                ) : (
                  <m.div
                    key="provider-empty"
                    className={styles.providerEmptyState}
                    data-motion-role="inline-status"
                    role="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: getRoleTransition("state-exit", reduceMotion),
                    }}
                    transition={getRoleTransition("state-enter", reduceMotion)}
                  >
                    还没有添加 AI 服务商
                  </m.div>
                )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                className={styles.providerPrimaryButton}
                data-open-provider-configure="true"
                onClick={() => openProviderConfigure()}
              >
                添加 AI 服务商
              </button>
              {!hasProviders ? (
                <button
                  type="button"
                  className={styles.providerEmptyImportButton}
                  data-provider-empty-import="true"
                  onClick={() => providerImportInputRef.current?.click()}
                >
                  导入服务商配置
                </button>
              ) : null}
              <p className={styles.providerHelpText}>
                API Key 只保存在本机浏览器。提问时可能发送书名、格式、选中文本、附近正文（当前页面）、当前问题和最近对话；不会发送整本书，也不会在备份中导出 API Key。
              </p>
              <AnimatePresence initial={false}>
                {providerImportStatus ? (
                  <m.p
                    className={styles.providerHelpText}
                    data-motion-role="inline-status"
                    role="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={getRoleTransition("state-enter", reduceMotion)}
                  >
                    {providerImportStatus}
                  </m.p>
                ) : null}
              </AnimatePresence>
            </>
          )}

          {mode === "configure" && draft && (
            <div className={styles.providerConfigureStack}>
              <section className={styles.providerConfigureSection}>
                <p className={styles.providerGroupLabel}>服务商</p>
                <div
                  className={styles.providerPresetGrid}
                  data-provider-preset-grid="true"
                >
                  {AI_PROVIDER_PRESETS.map((preset) => {
                    const selected = draft.kind === preset.kind;
                    return (
                      <button
                        key={preset.kind}
                        type="button"
                        className={styles.providerPresetButton}
                        data-motion-role="inline-state"
                        aria-pressed={selected}
                        data-selected={selected ? "true" : undefined}
                        onClick={() => changeProviderKind(preset.kind)}
                      >
                        <span
                          className={`${styles.providerChoiceIcon} ${
                            styles[`providerIcon${preset.kind}`]
                          }`}
                        >
                          {preset.iconLabel}
                        </span>
                        <span className={styles.providerPresetCopy}>
                          <span className={styles.providerPresetName}>
                            {PROVIDER_COMPACT_LABEL[preset.kind]}
                          </span>
                          <span className={styles.providerPresetDescription}>
                            {preset.description}
                          </span>
                          <span className={styles.providerPresetVendors}>
                            {preset.vendors.map((vendor) => (
                              <span key={vendor}>{vendor}</span>
                            ))}
                          </span>
                        </span>
                        <span className={styles.providerPresetCheck} aria-hidden="true">
                          <AnimatePresence initial={false}>
                            {selected ? (
                              <m.span
                                key="selected"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{
                                  opacity: 0,
                                  transition: getRoleTransition("state-exit", reduceMotion),
                                }}
                                transition={getRoleTransition("state-enter", reduceMotion)}
                              >
                                <CheckIcon />
                              </m.span>
                            ) : null}
                          </AnimatePresence>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className={styles.providerConfigureSection}>
                <p className={styles.providerGroupLabel}>连接</p>
                <div className={styles.providerConnectionCard}>
                  <label className={styles.providerField}>
                    <span className={styles.providerFieldLabel}>名称</span>
                    <input
                      value={draft.label}
                      onChange={(event) =>
                        updateDraft({ label: event.target.value })
                      }
                      placeholder="例如：DeepSeek"
                    />
                  </label>
                  <div className={styles.providerField}>
                    <span className={styles.providerFieldLabel}>API Key</span>
                    <div className={styles.providerFieldInputRow}>
                      <input
                        aria-label="API Key"
                        value={draft.apiKey}
                        onChange={(event) =>
                          updateDraft({ apiKey: event.target.value })
                        }
                        placeholder="sk-..."
                        type={showApiKey ? "text" : "password"}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className={styles.providerApiKeyToggle}
                        data-provider-api-key-toggle="true"
                        aria-label={showApiKey ? "隐藏密钥" : "显示密钥"}
                        aria-pressed={showApiKey}
                        onClick={() => setShowApiKey((visible) => !visible)}
                      >
                        <span aria-hidden="true">{showApiKey ? "隐藏" : "显示"}</span>
                      </button>
                    </div>
                    <small className={styles.providerFieldHint}>
                      密钥只保存在本机浏览器，不会离开当前设备的本地存储。
                    </small>
                  </div>
                  <label className={styles.providerField}>
                    <span className={styles.providerFieldLabel}>API 地址</span>
                    <input
                      value={draft.baseUrl}
                      onChange={(event) =>
                        updateDraft({ baseUrl: event.target.value })
                      }
                      placeholder="https://api.example.com"
                      inputMode="url"
                    />
                  </label>
                  {draft.protocol ? (
                    <label className={styles.providerSwitchRow}>
                      <span>自动附加 {draft.defaultPath}</span>
                      <input
                        type="checkbox"
                        className={styles.iosSwitch}
                        checked={draft.appendDefaultPath}
                        onChange={(event) =>
                          toggleAppendDefaultPath(event.target.checked)
                        }
                      />
                    </label>
                  ) : (
                    <div className={styles.providerStaticRow}>
                      <strong>路径</strong>
                      <span>选择服务商后设置</span>
                    </div>
                  )}
                  <div
                    className={styles.providerProtocolRow}
                    data-provider-api-format={draft.protocol || undefined}
                  >
                    <span className={styles.providerProtocolCopy}>
                      <strong>API 格式</strong>
                      <small>
                        {draft.protocol
                          ? getAiApiFormat(draft.protocol).description
                          : "选择一种协议格式"}
                      </small>
                    </span>
                    <select
                      aria-label="API 格式"
                      value={draft.protocol}
                      onChange={(event) =>
                        changeProtocol(event.target.value as AiProviderProtocol)
                      }
                    >
                      <option value="" disabled>
                        请选择
                      </option>
                      {AI_API_FORMATS.map((format) => (
                        <option key={format.protocol} value={format.protocol}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className={styles.providerConfigureSection}>
                <div className={styles.providerGroupHeader}>
                  <p className={styles.providerGroupLabel}>模型</p>
                  <button
                    type="button"
                    className={styles.providerRefreshButton}
                    onClick={refreshModels}
                    disabled={refreshingModels}
                    aria-busy={refreshingModels}
                  >
                    {refreshingModels ? "刷新中..." : "刷新"}
                  </button>
                </div>
                <div className={styles.providerListCard}>
                <AnimatePresence initial={false} mode="popLayout">
                {draft.models.length > 0 ? (
                  draft.models.map((model) => (
                    <m.div
                      key={model.id}
                      layout={reduceMotion ? false : "position"}
                      className={styles.providerModelRow}
                      data-selected={draft.model === model.id ? "true" : undefined}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                      animate={
                        reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
                      }
                      exit={{
                        opacity: 0,
                        y: reduceMotion ? 0 : 6,
                        transition: getRoleTransition("state-exit", reduceMotion),
                      }}
                      transition={getRoleTransition("state-enter", reduceMotion)}
                    >
                      <button
                        type="button"
                        className={styles.providerModelSelect}
                        aria-pressed={draft.model === model.id}
                        onClick={() => updateDraft({ model: model.id })}
                      >
                        <span className={styles.providerChoiceText}>
                          <strong>{model.label}</strong>
                          <small>
                            {model.id}
                            <span
                              className={styles.providerModelSource}
                              data-provider-model-source={model.source}
                            >
                              {model.source === "remote" ? "远程" : "手动"}
                            </span>
                          </small>
                        </span>
                        <span className={styles.providerModelCheck} aria-hidden="true">
                          {draft.model === model.id ? <CheckIcon /> : null}
                        </span>
                      </button>
                      {model.source === "manual" && (
                        <button
                          type="button"
                          className={styles.providerModelDelete}
                          aria-label={`删除 ${model.label}`}
                          onClick={() => removeModel(model.id)}
                        >
                          删除
                        </button>
                      )}
                    </m.div>
                  ))
                ) : (
                  <m.div
                    key="model-empty"
                    className={styles.providerEmptyState}
                    data-motion-role="inline-status"
                    role="status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{
                      opacity: 0,
                      transition: getRoleTransition("state-exit", reduceMotion),
                    }}
                    transition={getRoleTransition("state-enter", reduceMotion)}
                  >
                    还没有模型。可以刷新，或手动添加。
                  </m.div>
                )}
                </AnimatePresence>
                <div className={styles.providerManualModelRow}>
                  <input
                    value={manualModel}
                    onChange={(event) => setManualModel(event.target.value)}
                    placeholder="输入模型 ID，例如 deepseek-chat"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addManualModel();
                    }}
                  />
                  <button type="button" onClick={addManualModel}>
                    添加
                  </button>
                </div>
                </div>
              </section>
              <div className={styles.providerInlineStatusHost}>
                <AnimatePresence initial={false} mode="sync">
                  {inlineModelStatus ? (
                    <m.p
                      key={inlineModelStatus}
                      className={styles.providerHelpText}
                      data-motion-role="inline-status"
                      role="status"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{
                        opacity: 0,
                        transition: getRoleTransition("state-exit", reduceMotion),
                      }}
                      transition={getRoleTransition("state-enter", reduceMotion)}
                    >
                      {inlineModelStatus}
                    </m.p>
                  ) : null}
                </AnimatePresence>
              </div>
              <AnimatePresence initial={false}>
                {modelRefreshFailure ? (
                  <m.div
                    className={styles.providerRefreshError}
                    data-provider-refresh-error="true"
                    data-error-code={modelRefreshFailure.code}
                    data-retryable={modelRefreshFailure.retryable}
                    role="alert"
                    initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                    transition={getRoleTransition("state-enter", reduceMotion)}
                  >
                    <span>{modelRefreshErrorMessage(modelRefreshFailure.code)}</span>
                    {modelRefreshFailure.retryable ? (
                      <button
                        type="button"
                        data-provider-retry="true"
                        onClick={retryableRefresh}
                      >
                        重试
                      </button>
                    ) : null}
                  </m.div>
                ) : null}
              </AnimatePresence>

              {editingProviderId && (
                <button type="button" className={styles.providerDangerButton} onClick={deleteDraft}>
                  删除 AI 服务商
                </button>
              )}

              <div
                className={styles.providerStickyActions}
                data-provider-sticky-actions="true"
              >
                {saveHint ? (
                  <p
                    id="provider-save-requirements"
                    className={styles.providerSaveHint}
                  >
                    {saveHint}
                  </p>
                ) : null}
                <button
                  type="button"
                  className={styles.providerPrimaryButton}
                  onClick={saveDraft}
                  disabled={!canSave}
                  aria-describedby={
                    saveHint ? "provider-save-requirements" : undefined
                  }
                >
                  保存并使用
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
