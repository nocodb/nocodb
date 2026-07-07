# App Builder E2B Template

This directory defines the dedicated E2B sandbox template for the **App Build Engine** (Phase C). One ephemeral sandbox is created per build turn; this image is what runs inside it.

> **Separate from the AI code-interpreter template.** The existing `E2B_TEMPLATE_ID` env var points to `e2b/code-interpreter-v1`, used by `execute-code.tool.ts`. This template is different — it is referenced by the new env var `APP_BUILDER_E2B_TEMPLATE_ID` and is consumed by the build processor's `Sandbox.create(APP_BUILDER_E2B_TEMPLATE_ID, …)` call (Task 8).

---

## What is baked in

| Layer | What | Why |
|---|---|---|
| `node:24-slim` (linux/amd64) | Node 24 on Debian slim | Native binaries assume glibc; platform-pinned for Apple-Silicon build hosts |
| `git` | In-sandbox repo hydrate / commit / snapshot | Build turns may clone, commit, and snapshot the app repo |
| `ca-certificates` | HTTPS trust roots | Required for `claude` to reach Anthropic + MCP callback URLs |
| `@anthropic-ai/claude-code@latest` | Claude Code CLI | The build processor spawns `claude` to run one build turn |
| `tsx@4` | TypeScript runner | Executes the runtime-injected MCP stdio server script |
| `/opt/mcp/node_modules` (`@modelcontextprotocol/sdk@^1.26.0`) | MCP SDK for the stdio server | Baked so the runtime-injected `server.mjs` can resolve the SDK without a network install inside the sandbox |
| `/opt/starter-template` (+ pre-installed `node_modules`) | Static Vite + React 19 + Tailwind v4 + shadcn/ui scaffold | Seeds a brand-new app; `npm ci` is run at image-build time so per-turn `vite build` needs no network install |

## `/opt/mcp` — the MCP SDK mount point

`/opt/mcp` is an ESM package directory (`"type": "module"`) with `@modelcontextprotocol/sdk` pre-installed in its `node_modules`. The build processor writes the MCP stdio server source to `/opt/mcp/server.mjs` at runtime (Task 8, `sandbox.files.write`), and Claude Code spawns it via `node /opt/mcp/server.mjs`. Node resolves `@modelcontextprotocol/sdk` from the sibling `node_modules` directory — no network access or `npm install` needed inside the sandbox at runtime.

## `/opt/starter-template` — the static app scaffold

A complete, build-green Vite SPA (React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui new-york
+ react-router `HashRouter`). It is configured for static serving under a deep, opaque path:
`vite.config.ts` sets `base: "./"` (relative asset URLs) and the router is hash-based (no server
rewrites needed). Its `CLAUDE.md` is the authoring contract Claude Code auto-loads each turn — it
enforces the **static-only** rule (no `fetch`/server/`eval`) and documents the theme-token swap
seam and the future routines data layer.

The image runs `npm ci` (so `node_modules` is pre-installed) and a throwaway `npm run build` (to
validate the scaffold and warm the `tsc` incremental cache). A new app is seeded by copying the
scaffold **without** `node_modules`; the per-turn build re-provides `node_modules` by symlinking
back to `/opt/starter-template/node_modules` (deps are pinned, so one install serves every app).

## What is NOT baked in (injected at runtime)

The MCP stdio server source (`/opt/mcp/server.mjs`) and its `--mcp-config` JSON are **written into the sandbox per-turn** by the build processor (`sandbox.files.write`). Only the SDK `node_modules` dependency is baked. This keeps the server source hot-swappable without an image rebuild.

---

## Build & register

> Prerequisites: `e2b` CLI installed and authenticated (`e2b auth login`), local Docker daemon running.

```bash
cd packages/nocodb/e2b/app-builder
e2b template create nocodb-app-builder --cpu-count 2 --memory-mb 4096
```

> The legacy `e2b template build` (v1) is deprecated and now exits without building — use `e2b template create` (v2). Passing the existing template name (`nocodb-app-builder`) **rebuilds that template in place**, preserving its `template_id`. CPU/memory are v2 CLI flags (the `cpu_count`/`memory_mb` keys in `e2b.toml` are v1 and ignored by v2). The Dockerfile in this directory is auto-detected.

After the build, set the new env var in your deployment environment:

```
APP_BUILDER_E2B_TEMPLATE_ID=<template_id written into e2b.toml>
```

This is distinct from `E2B_TEMPLATE_ID` (the code-interpreter template). Both must be set for the full system to function.

---

## Credentials forwarded at `Sandbox.create` time

The build processor passes these env vars into the sandbox so `claude` can authenticate:

| Env var | Purpose |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Code (preferred if set) |
| `ANTHROPIC_API_KEY` | API key fallback if `CLAUDE_CODE_OAUTH_TOKEN` is not set |

`E2B_API_KEY` is used by the `Sandbox.create` call itself (host-side) and is not forwarded into the sandbox.

---

## Dev shortcut (before a dedicated template is built)

Until you have run `e2b template build` here, `APP_BUILDER_E2B_TEMPLATE_ID` can point at any existing equivalent template that already bakes `node` + `git` + `@anthropic-ai/claude-code` + `tsx` (for example, the nocovibe-builder template). Because the MCP server is injected at runtime, nothing else needs to be pre-baked.

---

## Verification (manual, post-build)

After `e2b template build` completes:

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create(process.env.APP_BUILDER_E2B_TEMPLATE_ID, {
  apiKey: process.env.E2B_API_KEY,
})
const result = await sandbox.commands.run('claude --version && git --version && node --version')
console.log(result.stdout)
await sandbox.kill()
```

All three version strings should print without error.

> **Note:** This smoke test is deferred until after the user runs `e2b template build`. It requires a live E2B account and cannot be executed as part of authoring this template.
