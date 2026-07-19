# Cloudflare Deployment

AI Reader deploys to Cloudflare Workers through OpenNext for Cloudflare.

The app has Next.js API routes under `/api/chat` and `/api/models`, so do not deploy it as a static-only Pages upload. The Worker route covers the production domain:

```text
881817.xyz/*
```

## Commands

```powershell
npm.cmd run deploy:cf
```

This runs:

```powershell
opennextjs-cloudflare build
opennextjs-cloudflare deploy
```

If a deployment serves a stale server chunk, remove local build outputs and deploy again:

```powershell
Remove-Item -LiteralPath .next,.open-next -Recurse -Force
npm.cmd run deploy:cf
```

The project build script intentionally uses `next build --webpack` because OpenNext on Windows failed to load a Turbopack server chunk at runtime.

## Current Production

- Worker: `ai-reader-pwa`
- Workers preview URL: `https://ai-reader-pwa.hyjsb1817.workers.dev`
- Production URL: `https://881817.xyz`
- Route: `881817.xyz/*`

Required Android TWA files are served from the same origin:

```text
https://881817.xyz/manifest.webmanifest
https://881817.xyz/.well-known/assetlinks.json
https://881817.xyz/downloads/ai-reader-twa.apk
```
