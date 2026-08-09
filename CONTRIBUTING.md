# Contributing to AI Reader

感谢参与 AI Reader。先阅读 [README.md](README.md) 和 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，再开始修改代码。

## 选择修改位置

- 新的页面交互放在 `app/`，并复用现有的导航、sheet、reader 和 Workspace surface。
- 可独立测试的业务规则放在 `lib/`，不要把 IndexedDB、AI 请求和复杂状态转换直接写进 JSX。
- 用户路径放在 `e2e/`；领域规则放在相邻的 `lib/*.test.ts`。
- 交互约束、视觉决策和验收证据分别放在 `docs/superpowers/specs/`、`docs/qa/` 和 `docs/performance/`。

## 本地流程

```bash
npm ci
npm run test
npm run lint
npm run build
```

涉及导航、阅读器、sheet、Workspace 或 PWA 生命周期时，再运行相关 E2E：

```bash
npm run test:e2e -- e2e/native-navigation.spec.ts
npm run test:e2e -- e2e/reading-workspace.spec.ts
```

完整 E2E 运行前，确认本机没有把旧的 `.next/` 或测试输出误当成源码提交。

## 修改原则

- 一个提交只解决一个可描述的问题。
- 不使用 reset、clean 覆盖现有工作；不删除用户已有的本地书籍或测试证据。
- 新行为先补失败测试，再写最小实现；纯重构必须保持现有测试结果。
- 不把 API Key、书籍正文、IndexedDB 导出或设备截图提交到仓库。
- 不直接提交 `.next/`、`.open-next/`、`.wrangler/`、`test-results/`、`node_modules/` 和本地构建产物。
- UI 改动要同时检查减少动态效果、键盘/VoiceOver 标签、44px 触控目标和窄屏布局。

## 提交信息

使用简短的 Conventional Commit 前缀：

```text
feat: add ...
fix: correct ...
refactor: split ...
test: cover ...
docs: clarify ...
chore: update ...
```

提交正文说明用户可见变化和验证命令。不要在提交信息中声称完成了实体 iPhone 验收，除非确实有设备证据。

## 隐私和 AI 请求

AI Reader 是本地优先产品。任何新增 AI 能力都必须明确发送哪些字段、为什么需要这些字段，并保持“选择性上下文”边界；不得为了方便把整本书或完整 IndexedDB 导出发送给 provider。
