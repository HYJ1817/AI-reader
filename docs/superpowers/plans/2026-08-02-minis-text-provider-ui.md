# Minis 风格文字 AI 服务商 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** 在现有 PWA provider 数据路径上实现 Minis 风格的文字服务商列表、添加流程、配置表单、模型刷新与错误恢复体验，并兼容浅色/深色系统主题。

**Architecture:** 保留 AiProviderConfig、AiSettingsSurface、/api/models 和现有导航边界；新增纯函数 presentation/error helpers，把敏感数据和上游错误分类留在独立模块。UI 继续使用受控 React state、现有 Motion role 与 CSS module，列表、协议卡片、配置字段和模型分组按 Minis 的 grouped-form 信息架构重排。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / CSS Modules / Motion / Vitest / Playwright。

---

## Task 1: 定义模型刷新错误契约并覆盖生产失败路径

**Files:**
- Create: lib/aiModelRefresh.ts
- Test: lib/aiModelRefresh.test.ts
- Modify: app/api/models/route.ts:52-87
- Test: lib/aiRequestSecurity.test.ts:90-120

- [ ] **Step 1: Write the failing classification tests**

    import { describe, expect, it } from "vitest";
    import { classifyAiModelRefreshFailure } from "./aiModelRefresh";

    describe("classifyAiModelRefreshFailure", () => {
      it.each([
        [401, "auth", false],
        [402, "billing", false],
        [429, "rate-limit", true],
        [408, "network", true],
        [502, "network", true],
      ] as const)("maps %s to %s", (status, code, retryable) => {
        expect(classifyAiModelRefreshFailure(status)).toEqual({ code, retryable });
      });

      it("classifies an exception without status as a retryable network failure", () => {
        expect(classifyAiModelRefreshFailure(null)).toEqual({
          code: "network",
          retryable: true,
        });
      });
    });

- [ ] **Step 2: Run the focused test and verify the expected RED failure**

Run: npm.cmd test -- --run lib/aiModelRefresh.test.ts  
Expected: FAIL because lib/aiModelRefresh.ts does not exist yet.

- [ ] **Step 3: Implement the minimal error contract**

    export type AiModelRefreshErrorCode =
      | "auth"
      | "billing"
      | "rate-limit"
      | "network"
      | "invalid-response";

    export interface AiModelRefreshFailure {
      code: AiModelRefreshErrorCode;
      retryable: boolean;
    }

    export function classifyAiModelRefreshFailure(
      status: number | null
    ): AiModelRefreshFailure {
      if (status === 401 || status === 403) return { code: "auth", retryable: false };
      if (status === 402) return { code: "billing", retryable: false };
      if (status === 429) return { code: "rate-limit", retryable: true };
      if (status === 408) return { code: "network", retryable: true };
      if (status !== null && status >= 400 && status < 500) {
        return { code: "invalid-response", retryable: false };
      }
      return { code: "network", retryable: true };
    }

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: npm.cmd test -- --run lib/aiModelRefresh.test.ts  
Expected: PASS with all classification cases passing.

- [ ] **Step 5: Expose the safe contract from /api/models**

Update the route so every upstream failure returns { error, errorCode, retryable }, preserves a valid upstream HTTP status when available, maps thrown fetch failures to network/502, and never includes the API key or raw response body. Add source-level assertions in lib/aiRequestSecurity.test.ts for errorCode, retryable, and classifyAiModelRefreshFailure.

- [ ] **Step 6: Run the route/security tests**

Run: npm.cmd test -- --run lib/aiModelRefresh.test.ts lib/aiRequestSecurity.test.ts  
Expected: PASS; existing request-size and SSRF tests remain green.

- [ ] **Step 7: Commit the error contract**

    git add lib/aiModelRefresh.ts lib/aiModelRefresh.test.ts app/api/models/route.ts lib/aiRequestSecurity.test.ts
    git commit -m "fix: classify model refresh failures"

## Task 2: Add Minis-style provider presentation metadata

**Files:**
- Create: lib/aiProviderPresentation.ts
- Test: lib/aiProviderPresentation.test.ts
- Modify: lib/aiProviders.ts:20-100
- Test: lib/aiProviders.test.ts

- [ ] **Step 1: Write failing presentation tests**

    import { describe, expect, it } from "vitest";
    import { createAiProviderFromPreset } from "./aiProviders";
    import {
      getAiProviderHealth,
      getAiProviderCredentialSummary,
    } from "./aiProviderPresentation";

    describe("provider presentation", () => {
      it("masks a configured key and reports the model count", () => {
        const provider = createAiProviderFromPreset("openai", {
          apiKey: "sk-test-1234567890",
          models: [{ id: "gpt-5", label: "GPT-5", source: "remote" }],
        });
        expect(getAiProviderCredentialSummary(provider)).toBe("API Key · sk-t…7890");
        expect(getAiProviderHealth(provider)).toBe("ready");
      });

      it("marks a provider with no key or model as needing attention", () => {
        const provider = createAiProviderFromPreset("openai");
        expect(getAiProviderHealth(provider)).toBe("needs-attention");
      });
    });

- [ ] **Step 2: Run the focused tests and verify RED**

Run: npm.cmd test -- --run lib/aiProviderPresentation.test.ts  
Expected: FAIL because the presentation module and helpers are missing.

- [ ] **Step 3: Implement pure presentation helpers and catalog descriptions**

Extend AiProviderPresetOption with description and vendors, populate the six text presets including the custom compatible endpoint, and implement:

    export type AiProviderHealth = "ready" | "needs-attention" | "empty";

    export function getAiProviderHealth(provider: AiProviderConfig): AiProviderHealth {
      if (!provider.apiKey.trim() && !provider.models.length) return "empty";
      if (!provider.apiKey.trim() || !provider.models.length) return "needs-attention";
      return "ready";
    }

    export function getAiProviderCredentialSummary(provider: AiProviderConfig) {
      const key = provider.apiKey.trim();
      if (!key) return "未配置 API Key";
      if (key.length <= 8) return "API Key · " + "•".repeat(key.length);
      return "API Key · " + key.slice(0, 4) + "…" + key.slice(-4);
    }

- [ ] **Step 4: Run provider tests and verify GREEN**

Run: npm.cmd test -- --run lib/aiProviderPresentation.test.ts lib/aiProviders.test.ts  
Expected: PASS, including existing address/path normalization tests.

- [ ] **Step 5: Commit presentation metadata**

    git add lib/aiProviderPresentation.ts lib/aiProviderPresentation.test.ts lib/aiProviders.ts lib/aiProviders.test.ts
    git commit -m "feat: add provider presentation metadata"

## Task 3: Rebuild the service-provider list and add flow around Minis grouped forms

**Files:**
- Modify: app/AiSettingsSurface.tsx:91-630
- Modify: app/AiSettingsSheet.tsx:10-45
- Modify: app/AppPushSurfaces.tsx:10-65
- Test: lib/aiSettingsSheetIntegration.test.ts
- Test: lib/accessibilityIntegration.test.ts

- [ ] **Step 1: Add failing source/integration assertions for the new list states**

Add assertions that the surface contains data-provider-add-menu, data-provider-list-row, data-provider-status, aria-label="添加 AI 服务商", a role="menu", and the presentation helpers. Add an accessibility assertion that the status dot has an accessible text label and the add menu has an Escape/return-focus path.

- [ ] **Step 2: Run the focused integration tests and verify RED**

Run: npm.cmd test -- --run lib/aiSettingsSheetIntegration.test.ts lib/accessibilityIntegration.test.ts  
Expected: FAIL because the new markers and behavior do not exist.

- [ ] **Step 3: Implement the list header and provider rows**

Add a compact Minis-style header with back/edit/add controls. Render each provider row with a status dot, label, masked credential summary, model count, active/attention text, and chevron. Keep the existing onPushConfigure(provider.id) route and current settings save callback.

- [ ] **Step 4: Implement the add popover with focus and keyboard ownership**

Use the existing ReaderSettingsPanel popover pattern: a trigger ref, popover ref, document keydown Escape listener, outside pointerdown close, animated role="menu", and focus return to the plus button. Menu actions are “添加 AI 服务商” (push a blank configure draft) and “导入服务商配置” (open the existing JSON file input/import callback or show the current explicit unsupported state without claiming iCloud support).

- [ ] **Step 5: Implement the text-provider catalog cards**

Keep the existing preset selection semantics but render each card with icon, title, description, vendor examples, selected checkmark, and aria-pressed. Do not render voice providers. Selecting a card updates the existing draft via changeProviderKind and preserves any manually typed key only when the provider kind remains compatible.

- [ ] **Step 6: Run the focused integration tests and verify GREEN**

Run: npm.cmd test -- --run lib/aiSettingsSheetIntegration.test.ts lib/accessibilityIntegration.test.ts  
Expected: PASS with the list/menu/catalog contracts covered.

## Task 4: Match the configuration and model-management interaction states

**Files:**
- Modify: app/AiSettingsSurface.tsx:150-290,437-630
- Modify: app/page.module.css:7062-7730
- Test: lib/aiSettingsSheetIntegration.test.ts
- Test: lib/motionCss.test.ts

- [ ] **Step 1: Add failing model-state and configuration assertions**

Cover the required behavior with tests that assert:

    expect(aiSettingsSource).toContain("errorCode");
    expect(aiSettingsSource).toContain('data-provider-model-source="remote"');
    expect(aiSettingsSource).toContain('data-provider-model-source="manual"');
    expect(aiSettingsSource).toContain("retryable");
    expect(pageCss).toMatch(/\.providerStatusDot[\s\S]*?border-radius:\s*999px/);

- [ ] **Step 2: Run the focused tests and verify RED**

Run: npm.cmd test -- --run lib/aiSettingsSheetIntegration.test.ts lib/motionCss.test.ts  
Expected: FAIL because the new state markers and status styles are absent.

- [ ] **Step 3: Update configuration controls to match the screenshots**

Keep the current controlled fields, but add the eye button for API Key, a descriptive footer under the custom URL and /v1 switch, and an API format grouped row. Keep save disabled until label, key, base URL, and a model are present; ensure the model section remains reachable while the sticky save bar is visible.

- [ ] **Step 4: Update refresh handling to preserve models and expose typed status**

Read errorCode/retryable from /api/models. On success replace only remote models and retain manual models. On failure keep the existing draft models, render a localized status with a retry button when retryable, and include a short “可手动添加模型” action. Never render the response body or API key.

- [ ] **Step 5: Add source and origin markers to model rows**

Render remote/manual source badges and selected state without relying only on color. Keep manual deletion, default-model fallback, Enter-to-add, duplicate prevention, and request-generation guards.

- [ ] **Step 6: Restyle the provider surface for light/dark system themes**

Update app/page.module.css to provide grouped surfaces, separators, icon tiles, status dots, popover rows, error/success status blocks, and 44px touch targets. Use var(--app-bg), var(--surface-primary), var(--control-fill), var(--text-*), var(--tint), and color-mix; add prefers-reduced-motion rules that remove scale/opacity transitions from provider controls. Keep the existing sticky action safe-area calculation.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: npm.cmd test -- --run lib/aiSettingsSheetIntegration.test.ts lib/motionCss.test.ts  
Expected: PASS with no regressions to existing motion-role contracts.

- [ ] **Step 8: Commit the provider UI implementation**

    git add app/AiSettingsSurface.tsx app/AiSettingsSheet.tsx app/AppPushSurfaces.tsx app/page.module.css lib/aiSettingsSheetIntegration.test.ts lib/accessibilityIntegration.test.ts lib/motionCss.test.ts
    git commit -m "feat: recreate Minis text provider settings UI"

## Task 5: Add browser coverage for the real provider-management journey

**Files:**
- Modify: e2e/interaction-fluidity.spec.ts:310-360
- Create: e2e/provider-settings.spec.ts
- Modify: playwright.config.ts only if the existing mobile projects do not cover 393x852 and dark color scheme

- [ ] **Step 1: Write the failing Playwright journey**

The test must:

1. Open Settings → AI 服务商.
2. Open the plus menu and assert both menu items.
3. Enter the text provider catalog and choose OpenAI-compatible.
4. Fill a fixture key, base URL, and manual model.
5. Intercept /api/models with a typed 401 failure and assert the old/manual model remains, the error text is visible, and retry is available only for retryable errors.
6. Fulfill a successful model response and assert remote/manual source markers and the selected checkmark.
7. Switch to dark color scheme and assert no horizontal overflow.
8. Set html font-size to 200% and assert no horizontal overflow or clipped provider labels.

- [ ] **Step 2: Run the new test and verify RED**

Run: npx.cmd playwright test e2e/provider-settings.spec.ts --project='iphone-15-pro-max' --trace=off  
Expected: FAIL on the new menu/status/source markers before implementation.

- [ ] **Step 3: Implement only test fixtures and selectors needed for the journey**

Use page.route("**/api/models", ...) with deterministic JSON; do not use a real provider or API key. Keep selectors semantic (getByRole, labels, data-provider-*) and avoid timing-based sleeps except for the existing interaction metric helper.

- [ ] **Step 4: Run the journey and verify GREEN**

Run the same Playwright command.  
Expected: PASS with one worker, zero retries, and --trace=off.

- [ ] **Step 5: Commit browser coverage**

    git add e2e/provider-settings.spec.ts e2e/interaction-fluidity.spec.ts playwright.config.ts
    git commit -m "test: cover Minis-style provider settings journey"

## Task 6: Full verification, documentation, and handoff

**Files:**
- Modify: HANDOFF.md
- Create: docs/qa/2026-08-02-minis-text-provider-ui-checklist.md

- [ ] **Step 1: Run the complete local verification suite**

Run, in order:

    npm.cmd test -- --run
    npm.cmd run lint
    npm.cmd run build
    git diff --check

Expected: all tests pass, lint/build exit 0, and no whitespace errors.

- [ ] **Step 2: Run the focused mobile browser matrix**

Run:

    npx.cmd playwright test e2e/provider-settings.spec.ts --project='iphone-14' --project='iphone-15-pro-max' --trace=off --workers=1 --retries=0

Expected: both projects pass the provider journey with no horizontal overflow; record any retained small issue instead of silently changing thresholds.

- [ ] **Step 3: Write the QA checklist and update HANDOFF**

Record the exact commands, pass counts, theme/font checks, known limitations (no physical iPhone evidence, no production deployment), commit SHAs, and the fact that no API Key was used in tests. Append an authoritative section to HANDOFF.md with the design commit, implementation commits, and current verification state.

- [ ] **Step 4: Re-run status/log and review the diff**

Run:

    git status -sb
    git log -8 --oneline --decorate
    git diff HEAD~6..HEAD --stat

Confirm only intended provider UI, tests, docs, and handoff files changed; do not use git reset, git clean, or broad checkout commands.

- [ ] **Step 5: Commit documentation and handoff**

    git add HANDOFF.md docs/qa/2026-08-02-minis-text-provider-ui-checklist.md
    git commit -m "docs: record Minis-style provider UI verification"

## Integration note

After all verification passes, follow the repository handoff policy: preserve this feature branch and choose a pull request for the broad UI change. Do not deploy production without a separate user request.
