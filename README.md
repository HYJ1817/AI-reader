# AI Reader PWA

一个本地优先的个人阅读器 PWA，面向 iPhone Safari 使用。它可以导入本地 EPUB/TXT 书籍，保存阅读进度，并对选中的文字发起 OpenAI-compatible AI 问答。

## 功能

- 本地书库：导入 EPUB/TXT，搜索，继续阅读，阅读进度展示。
- 分组管理：一本书可加入多个自定义分组。
- 阅读体验：TXT 滚动阅读，EPUB 分页阅读，目录跳转，进度恢复。
- 阅读设置：主题、字号、行高、内容宽度，本地持久化。
- 阅读目标：每日阅读时间圆环和目标设置。
- AI 问答：可能发送书名、格式、选中文本、当前页面附近正文、当前问题和最近对话；不会发送整本书。
- 备份恢复：导出/导入本地 JSON 备份，不导出 API Key。
- PWA：包含 manifest 和 service worker，可部署到 HTTPS 后添加到 iPhone 主屏幕。

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- IndexedDB / Dexie
- epub.js
- Vitest
- ESLint

## 本地开发

```bash
npm install
npm run dev
```

默认打开：

```text
http://localhost:3000
```

## 生产预览

```bash
npm run build
npm run start
```

指定端口示例：

```bash
npm run start -- --hostname 127.0.0.1 --port 3004
```

## 验证

```bash
npm run test
npm run lint
npm run build
npm audit --json
```

当前 v0.4 验收结果：

- `npm run test`：338 tests passed
- `npm run lint`：passed
- `npm run build`：passed
- `npm audit --json`：0 vulnerabilities

## AI 配置

在应用的「设置」页填写：

- 接口地址，例如 `https://api.openai.com/v1`
- 模型名
- API Key

API Key 只保存在本机浏览器。提问时可能发送书名、格式、选中文本、当前页面附近正文、当前问题和最近对话；不会发送整本书，也不会在备份中导出 API Key。

## iPhone PWA 安装

iPhone 上真实安装和离线能力需要可信 HTTPS。

推荐部署到：

- Vercel
- Cloudflare Pages
- Netlify

部署后，用 iPhone Safari 打开 HTTPS 地址，点分享按钮，选择「添加到主屏幕」。

## 隐私说明

- 书籍文件、阅读进度、分组、阅读目标默认只保存在当前浏览器本地。
- 没有账号系统，没有云同步。
- AI 问答会把书名、格式、选中文本、当前页面附近正文、当前问题和最近对话发送到你配置的 API 服务商，但不会发送整本书。

## 许可证

MIT
