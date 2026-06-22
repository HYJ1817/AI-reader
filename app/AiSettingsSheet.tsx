"use client";

import { useMemo, useState } from "react";
import BottomSheet from "./BottomSheet";
import styles from "./page.module.css";
import {
  AI_API_FORMATS,
  createEmptyAiProvider,
  getAiApiFormat,
  sanitizeAiProviderSettings,
  type AiProviderConfig,
  type AiProviderModel,
  type AiProviderProtocol,
  type AiProviderSettings,
} from "@/lib/aiProviders";

type SheetMode = "list" | "configure";
type DraftProvider = Omit<AiProviderConfig, "protocol"> & {
  protocol: AiProviderProtocol | "";
};

type Props = {
  settings: AiProviderSettings;
  onSave: (settings: AiProviderSettings) => void;
  onClose: () => void;
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

export default function AiSettingsSheet({ settings, onSave, onClose }: Props) {
  const [mode, setMode] = useState<SheetMode>(
    settings.providers.length > 0 ? "list" : "configure"
  );
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    settings.providers.length > 0 ? null : null
  );
  const [draft, setDraft] = useState<DraftProvider | null>(
    settings.providers.length > 0 ? null : createDraft()
  );
  const [manualModel, setManualModel] = useState("");
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [modelRefreshStatus, setModelRefreshStatus] = useState("");
  const [modeMotion, setModeMotion] = useState<
    "forward" | "backward" | null
  >(null);
  const activeProvider = useMemo(
    () =>
      settings.providers.find((provider) => provider.id === settings.activeProviderId) ??
      null,
    [settings]
  );
  const modeMotionClass =
    modeMotion === "forward"
      ? styles.subviewEnterForward
      : modeMotion === "backward"
        ? styles.subviewEnterBackward
        : "";

  function openAddProvider() {
    setModeMotion("forward");
    setEditingProviderId(null);
    setDraft(createDraft());
    setManualModel("");
    setModelRefreshStatus("");
    setMode("configure");
  }

  function openEditProvider(provider: AiProviderConfig) {
    setModeMotion("forward");
    setEditingProviderId(provider.id);
    setDraft(toDraft(provider));
    setManualModel("");
    setModelRefreshStatus("");
    setMode("configure");
  }

  function updateDraft(next: Partial<DraftProvider>) {
    if (!draft) return;
    setDraft({ ...draft, ...next });
  }

  function changeProtocol(protocol: AiProviderProtocol) {
    const format = getAiApiFormat(protocol);
    if (!draft) return;
    setDraft({
      ...draft,
      protocol,
      defaultPath: format.defaultPath,
      baseUrl: draft.baseUrl || format.defaultBaseUrl,
      appendDefaultPath: true,
    });
    setModelRefreshStatus("");
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
  }

  function removeModel(id: string) {
    if (!draft) return;
    const nextModels = draft.models.filter((model) => model.id !== id);
    setDraft({
      ...draft,
      models: nextModels,
      model: draft.model === id ? nextModels[0]?.id ?? "" : draft.model,
    });
  }

  async function refreshModels() {
    if (!draft || !draft.protocol || !draft.baseUrl.trim() || !draft.apiKey.trim()) {
      setModelRefreshStatus("请先填写 API 地址、API Key，并选择 API 格式。");
      return;
    }
    setRefreshingModels(true);
    setModelRefreshStatus("");
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: draft }),
      });
      const data = (await response.json()) as {
        models?: AiProviderModel[];
        error?: string;
      };
      if (!response.ok || !Array.isArray(data.models)) {
        throw new Error(data.error || "刷新失败");
      }
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
    } catch (err) {
      setModelRefreshStatus(
        err instanceof Error ? err.message : "刷新失败，可手动添加模型。"
      );
    } finally {
      setRefreshingModels(false);
    }
  }

  function saveDraft() {
    if (!draft || !draft.protocol) return;
    const now = new Date().toISOString();
    const normalized: AiProviderConfig = {
      ...draft,
      protocol: draft.protocol,
      label: draft.label.trim(),
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
      models: dedupeModels(draft.models),
      updatedAt: now,
    };
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
    setEditingProviderId(normalized.id);
    setDraft(null);
    setModeMotion("backward");
    setMode("list");
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
    setDraft(null);
    setEditingProviderId(null);
    if (providers.length > 0) setModeMotion("backward");
    setMode(providers.length > 0 ? "list" : "configure");
    if (providers.length === 0) {
      setDraft(createDraft());
    }
  }

  const canSave =
    !!draft &&
    !!draft.protocol &&
    draft.label.trim().length > 0 &&
    draft.baseUrl.trim().length > 0 &&
    draft.apiKey.trim().length > 0 &&
    draft.model.trim().length > 0;
  const title = mode === "list" ? "AI 服务商" : editingProviderId ? "配置服务商" : "添加服务商";

  return (
    <BottomSheet
      onClose={onClose}
      className={styles.providerSheet}
      ariaLabel={title}
      showGrabber={false}
    >
      {(close) => (
        <>
        <div className={styles.providerSheetChrome} />
        <div
          key={mode}
          className={`${styles.providerSubview} ${modeMotionClass}`}
        >
        <div className={styles.providerSheetHeader}>
          {mode === "list" ? (
            <button type="button" className={styles.providerNavButton} onClick={() => close()}>
              关闭
            </button>
          ) : (
            <button
              type="button"
              className={styles.providerNavButton}
              onClick={() => {
                if (settings.providers.length > 0) {
                  setDraft(null);
                  setEditingProviderId(null);
                  setModeMotion("backward");
                  setMode("list");
                } else {
                  close();
                }
              }}
            >
              {settings.providers.length > 0 ? "返回" : "取消"}
            </button>
          )}
          <h2>{title}</h2>
          <span className={styles.providerHeaderSpacer} />
        </div>

        <div className={styles.providerSheetBody}>
          {mode === "list" && (
            <>
              <p className={styles.providerGroupLabel}>当前服务商</p>
              <div className={styles.providerListCard}>
                {settings.providers.length > 0 ? (
                  settings.providers.map((provider) => {
                    const active = provider.id === activeProvider?.id;
                    return (
                      <button
                        type="button"
                        key={provider.id}
                        className={styles.providerChoiceRow}
                        onClick={() => openEditProvider(provider)}
                      >
                        <span className={styles.providerChoiceText}>
                          <strong>{provider.label}</strong>
                          <small>
                            {provider.model || "未选择模型"} · {apiFormatLabel(provider.protocol)}
                          </small>
                        </span>
                        {active && <span className={styles.providerActiveBadge}>使用中</span>}
                        <span className={styles.providerChoiceChevron}>›</span>
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.providerEmptyState}>还没有添加 AI 服务商</div>
                )}
              </div>

              <button
                type="button"
                className={styles.providerPrimaryButton}
                onClick={openAddProvider}
              >
                添加 AI 服务商
              </button>
              <p className={styles.providerHelpText}>
                API Key 只保存在本机浏览器。提问时只发送书名、格式、选中文本和问题，不会发送整本书。
              </p>
            </>
          )}

          {mode === "configure" && draft && (
            <>
              <p className={styles.providerGroupLabel}>名称</p>
              <div className={styles.providerListCard}>
                <label className={styles.providerFormRow}>
                  <input
                    value={draft.label}
                    onChange={(event) => updateDraft({ label: event.target.value })}
                    placeholder="例如：DeepSeek"
                  />
                </label>
              </div>

              <p className={styles.providerGroupLabel}>API Key</p>
              <div className={styles.providerListCard}>
                <label className={styles.providerFormRow}>
                  <input
                    value={draft.apiKey}
                    onChange={(event) => updateDraft({ apiKey: event.target.value })}
                    placeholder="sk-..."
                    type="password"
                    autoComplete="off"
                  />
                </label>
              </div>

              <p className={styles.providerGroupLabel}>API 地址</p>
              <div className={styles.providerListCard}>
                <label className={styles.providerFormRow}>
                  <input
                    value={draft.baseUrl}
                    onChange={(event) => updateDraft({ baseUrl: event.target.value })}
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
                        updateDraft({ appendDefaultPath: event.target.checked })
                      }
                    />
                  </label>
                ) : (
                  <div className={styles.providerStaticRow}>
                    <strong>路径</strong>
                    <span>选择 API 格式后设置</span>
                  </div>
                )}
              </div>

              <p className={styles.providerGroupLabel}>API 格式</p>
              <div className={styles.providerListCard}>
                {AI_API_FORMATS.map((format) => (
                  <button
                    key={format.protocol}
                    type="button"
                    className={styles.providerModelRow}
                    onClick={() => changeProtocol(format.protocol)}
                  >
                    <span className={styles.providerChoiceText}>
                      <strong>{format.label}</strong>
                      <small>{format.description}</small>
                    </span>
                    <span className={styles.providerModelCheck}>
                      {draft.protocol === format.protocol ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>

              <div className={styles.providerGroupHeader}>
                <p className={styles.providerGroupLabel}>模型</p>
                <button
                  type="button"
                  className={styles.providerRefreshButton}
                  onClick={refreshModels}
                  disabled={refreshingModels}
                >
                  {refreshingModels ? "刷新中..." : "刷新"}
                </button>
              </div>
              <div className={styles.providerListCard}>
                {draft.models.length > 0 ? (
                  draft.models.map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      className={styles.providerModelRow}
                      onClick={() => updateDraft({ model: model.id })}
                    >
                      <span className={styles.providerChoiceText}>
                        <strong>{model.label}</strong>
                        <small>{model.id}</small>
                      </span>
                      <span className={styles.providerModelActions}>
                        {model.source === "manual" && (
                          <span
                            role="button"
                            tabIndex={0}
                            className={styles.providerModelDelete}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeModel(model.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                removeModel(model.id);
                              }
                            }}
                          >
                            删除
                          </span>
                        )}
                        <span className={styles.providerModelCheck}>
                          {draft.model === model.id ? "✓" : ""}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className={styles.providerEmptyState}>还没有模型。可以刷新，或手动添加。</div>
                )}
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
              {modelRefreshStatus && (
                <p className={styles.providerHelpText}>{modelRefreshStatus}</p>
              )}

              <button
                type="button"
                className={styles.providerPrimaryButton}
                onClick={saveDraft}
                disabled={!canSave}
              >
                保存并使用
              </button>

              {editingProviderId && (
                <button type="button" className={styles.providerDangerButton} onClick={deleteDraft}>
                  删除 AI 服务商
                </button>
              )}
            </>
          )}
        </div>
        </div>
        </>
      )}
    </BottomSheet>
  );
}
