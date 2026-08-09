# AI Reader Architecture

## 目标

AI Reader 是一个单运行时的本地优先阅读器：Next.js 负责 PWA 页面和交互，浏览器 IndexedDB 保存书籍与阅读状态，AI 请求只通过明确的上下文组装层发送到用户配置的 provider。

这份文档解决两个问题：新贡献者从哪里开始读代码，以及一个新功能应该放在哪一层。

## 和 OpenMinis 的对应关系

OpenMinis 用平台边界组织仓库：`src/ios`、`src/android`、`src/shared`，再把 `docs/specs`、`deps` 和 `scripts` 单独放在顶层。AI Reader 只有一个 Web/PWA 运行时，因此不照搬平台目录，而是采用“界面 surface + 领域模块 + 运行时资源”的边界。

| OpenMinis 的做法 | AI Reader 的对应位置 | 说明 |
| --- | --- | --- |
| `src/ios`, `src/android` | `app/` | PWA 的页面、surface、阅读器、Workspace 和导航 UI |
| `src/shared` | `lib/`、`public/` | 可测试领域规则、共享文本、PWA 静态资源 |
| `docs/specs` | `docs/superpowers/specs/` | 交互、视觉和架构决策 |
| `deps`, `scripts` | `scripts/`、`android-twa/` | 构建、部署和 Android 包装，不混入产品 UI |
| 平台测试目录 | `lib/*.test.ts`、`e2e/` | 领域测试和真实浏览器路径分层 |

借鉴的是“让仓库首页能解释产品、让顶层目录表达边界、让设计决策有单独位置”，不是把 PWA 改成 SwiftUI 或复制原生平台代码。

## 运行时分层

```text
┌────────────────────────────────────────────────────────────┐
│ app/                                                        │
│ App entry · root navigation · surfaces · reader · Workspace │
│ Motion wrappers · focus · gestures · lifecycle              │
└───────────────────────────────┬────────────────────────────┘
                                │ calls domain APIs
┌───────────────────────────────▼────────────────────────────┐
│ lib/                                                        │
│ DB · import · reader · library · navigation · AI · workspace│
│ Pure rules, reducers, persistence coordinators, serializers  │
└───────────────┬───────────────────────────┬─────────────────┘
                │                           │
     ┌──────────▼──────────┐      ┌─────────▼─────────┐
     │ Browser local state  │      │ /api/chat         │
     │ IndexedDB / storage  │      │ selected context  │
     └─────────────────────┘      └───────────────────┘
```

### `app/`：界面与交互组合层

入口文件和职责：

- `page.tsx`：当前应用组合入口，连接书库、阅读器、根导航和 Workspace。后续拆分应优先从这里提取 feature controller，不改变用户路径。
- `NavigationProvider.tsx`、`NavigationStack.tsx`、`AppPushSurfaces.tsx`：根 tab、push 页面、返回手势和 history。
- `MotionSheet.tsx`、`SheetPageStack.tsx`、`BottomSheet.tsx`：sheet 生命周期、内部页面和拖动关闭。
- `Library*`、`ReadingDashboard.tsx`：书库、分组、阅读统计和阅读目标 surface。
- `ReadingSession.tsx`、`EpubReader.tsx`、`Reader*`、`TocDrawer.tsx`：TXT/EPUB 阅读器和阅读控制。
- `ReadingWorkspaceSheet.tsx`、`Workspace*`、`useWorkspace*`：按书籍归属的 Workspace 和消息流。
- `AppOverlays.tsx`、`AppPushSurfaces.tsx`：只负责把路由状态映射成 surface；业务规则应继续放入 `lib/`。

### `lib/`：领域和基础设施层

- 存储：`db.ts`、`backup.ts`、`workspaceBackup.ts`、`storagePersistence.ts`。
- 书籍：`importBook.ts`、`epub*`、`txt*`、`bookFileExport.ts`、`bookCover*`。
- 书库：`library*`、`collectionList.ts`、`librarySelection.ts`、`libraryProgress.ts`。
- 阅读：`reader*`、`readingGoal*`、`readingInsights.ts`、`ambientBookBackground.ts`。
- 导航与动效：`appNavigation*`、`navigation*`、`motion*`、`sheet*`、`sharedBookTransition.ts`。
- AI 与 Workspace：`ai*.ts`、`workspace*.ts`、`aiRequestSecurity.ts`。

`lib/` 中的规则模块应该能在 Vitest 中运行，不应读取 React context，也不应把组件 DOM 当成业务状态。需要浏览器能力的少数 adapter（例如下载、EPUB 文档画布和 localStorage）要保持边界小，并单独测试。

### `e2e/`：用户路径而不是实现细节

E2E 按用户任务命名：导入并打开书、阅读设置、目录、标注、Workspace、导航和交互流畅度。性能预算放在 `e2e/helpers/interactionMetrics.ts`，避免在产品组件中散落测量逻辑。

## 新功能放置规则

1. 先写一句用户任务，例如“从目录跳到章节并保持 sheet 高度”。
2. 把数据规则放进 `lib/<domain>.ts`，先为边界写 Vitest。
3. 把页面组合放进现有的 feature surface；不要在 `page.tsx` 继续堆新的数据访问和事件处理。
4. 需要跨页面的状态才进入导航或共享 hook；单页面状态留在 surface 内。
5. 补一条 E2E 用户路径，只有真实浏览器行为才放在 E2E。
6. 更新对应的 `docs/superpowers/specs/` 或 `docs/qa/`，让 GitHub 上的决策和代码一致。

## 当前整理重点

当前最大的可读性成本是历史迭代形成的入口文件：

- `app/page.tsx`：页面组合、书库事件、阅读生命周期、备份和 Workspace 连接集中在一个文件。
- `app/page.module.css`：全局 surface 样式、reader 样式、Workspace 样式和 motion token 集中在一个 CSS Module。
- `app/AppOverlays.tsx`：多种 sheet 和 overlay 的路由映射集中在一个文件。

后续拆分按以下顺序进行，每一步都应保持行为不变：

1. 从 `page.tsx` 提取 `useLibraryController`、`useReaderController` 和 `useBackupController`，只移动状态和事件，不改 UI。
2. 把 `AppOverlays.tsx` 按 `library`、`reader`、`settings`、`workspace` surface 拆成小的 route renderer。
3. 将 `page.module.css` 拆成 motion tokens、library、reader、sheet、workspace 五个 CSS Module；公共 token 只保留在 `globals.css`。
4. 每次拆分后运行单元测试、lint、build 和受影响的 E2E，再合并小提交。

这四步完成前，不进行大范围目录搬迁。Next.js 的 `app/` 入口、CSS Module 相对路径和现有部署配置优先保持稳定。

## 读代码顺序

```text
README.md
  → app/page.tsx
  → app/AppNavigation.tsx + app/NavigationStack.tsx
  → app/LibrarySurface.tsx / app/ReadingSession.tsx / app/ReadingWorkspaceSheet.tsx
  → lib/db.ts + 对应领域模块
  → 相关 lib/*.test.ts
  → 相关 e2e/*.spec.ts
```

如果只想了解某个功能，不需要先读完整的 `HANDOFF.md`；它是跨会话交接和历史证据，不是产品架构入口。
