# AI Reader

本地优先的 AI 阅读器 PWA，面向 iPhone Safari 和主屏幕 PWA。它可以导入 EPUB/TXT，保存书籍、进度、标注和设置，并在阅读上下文中对选中文本提问。

Production: [881817.xyz](https://881817.xyz)

## 产品边界

- 书籍和阅读状态默认保存在当前浏览器的 IndexedDB 中。
- 没有账号系统，也没有默认云同步。
- AI 只发送完成当前问题所需的阅读上下文，不发送整本书。
- PWA 依赖 HTTPS、manifest 和 service worker，目标设备是 iPhone Safari。

## 当前能力

### 书库

- 导入 EPUB/TXT，并提取标题、封面和基础元数据。
- 搜索、分组、重命名、删除、批量选择和继续阅读。
- 书架、阅读统计、每日阅读目标和本地备份恢复。

### 阅读器

- TXT 滚动和分页两种阅读模式。
- EPUB 分页、目录、进度恢复和阅读设置。
- 主题、字号、行高、内容宽度、自定义背景。
- 高亮、标注、标注列表和选中文本操作。
- 书籍打开过渡、阅读器手势、控制栏和减少动态效果支持。

### Workspace 和 AI

- 每本书拥有自己的阅读 Workspace。
- Workspace 保存会话、消息、材料和生成中的结果。
- 支持 OpenAI-compatible provider 配置、流式回答、停止、重试和离线可读状态。
- AI 请求只组装书名、格式、选中文本、附近正文、问题和必要的最近对话。

## 代码地图

```text
app/                     Next.js 页面、PWA UI 和交互组合层
├── page.tsx             应用入口，连接书库、阅读器、导航和 Workspace
├── *Surface.tsx         页面级 surface，例如 Library、Settings、Workspace
├── *Session / *Reader*  阅读器渲染、阅读手势和阅读生命周期
├── *Workspace*          Workspace 会话、消息、材料和滚动跟随
├── Navigation*          根页面、push 页面、sheet 和 history 导航
├── Motion*              页面、书籍、sheet 的动效外壳
└── use*.ts              UI 生命周期和交互状态 hook

lib/                     与 React 无关的领域、存储和状态模块
├── db.ts                IndexedDB / Dexie 数据访问
├── importBook.ts        EPUB/TXT 导入和元数据提取
├── reader*.ts / epub*   阅读位置、分页、目录、标注和阅读器状态
├── library*.ts          书库筛选、分组、书架和进度
├── ai*.ts               provider、模型、请求安全和流式处理
├── appNavigation*.ts    导航状态、history、手势和 motion profile
├── workspace*.ts        Workspace 持久化、流式滚动和备份
└── *.test.ts            领域模块和集成行为测试

public/                  manifest、service worker、图标和静态资源
e2e/                     iPhone 尺寸浏览器验收、交互和性能测试
android-twa/             Android TWA 打包配置，不参与 PWA 主运行时
scripts/                 构建、部署和性能探针脚本
docs/                    架构、设计规格、QA、性能和部署记录
```

## 架构原则

```text
用户操作
   ↓
app/ UI surface + interaction hooks
   ↓
lib/ domain services and state reducers
   ├── IndexedDB / local browser storage
   └── /api/chat → configured AI provider
```

- `app/` 负责渲染、手势、焦点、生命周期和页面组合；新 UI 不应把 Dexie 查询细节扩散到多个组件。
- `lib/` 负责可测试的业务规则、持久化协议、导航状态和 AI 请求边界；领域模块不依赖 React 组件。
- `e2e/` 验证真实用户路径；`lib/*.test.ts` 验证规则和状态转换。
- `docs/superpowers/specs/` 记录已经做出的交互和架构决策，`docs/qa/` 记录验收证据，不把测试输出目录当成源码提交。

详细的模块职责、与 OpenMinis 的对应关系和后续拆分顺序见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 本地开发

```bash
npm ci
npm run dev
```

默认地址：`http://localhost:3000`

生产构建预览：

```bash
npm run build
npm run start
```

## 验证

提交前至少运行：

```bash
npm run test
npm run lint
npm run build
```

完整的浏览器验收：

```bash
npm run test:e2e
```

Cloudflare 部署说明见 [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md)，Android TWA 说明见 [docs/android-twa.md](docs/android-twa.md)。

## GitHub 协作

新贡献先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。实现新功能时，先明确它属于哪个 surface 和哪个领域模块，再补对应的领域测试或 E2E 路径。不要提交 `.next/`、`.open-next/`、`.wrangler/`、`test-results/`、`node_modules/` 或本地书籍文件。

## 许可证

MIT
