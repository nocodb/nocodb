# App Builder E2B Template

This directory defines the dedicated E2B sandbox template for the **App Build Engine** (Phase C). One ephemeral sandbox is created per build turn; this image is what runs inside it.

> **Separate from the AI code-interpreter template.** The existing `E2B_TEMPLATE_ID` env var points to `e2b/code-interpreter-v1`, used by `execute-code.tool.ts`. This template is different — it is named by `DEFAULT_TEMPLATES` in the E2B compute provider and consumed by its app-builder workload (`ComputeWorkload.AppBuilder`). It is not configurable by env.

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
| `…/node_modules/@nocodb/app-ctx` (compiled from `runtime-modules/app-ctx/`) | The action runtime apps import (`ctx.actions[…]`) | A real resolvable package in the shared `node_modules`, symlinked into every app — no per-app alias/source file |

## `/opt/mcp` — the MCP SDK mount point

`/opt/mcp` is an ESM package directory (`"type": "module"`) with `@modelcontextprotocol/sdk` pre-installed in its `node_modules`. The build processor writes the MCP stdio server source to `/opt/mcp/server.mjs` at runtime (Task 8, `sandbox.files.write`), and Claude Code spawns it via `node /opt/mcp/server.mjs`. Node resolves `@modelcontextprotocol/sdk` from the sibling `node_modules` directory — no network access or `npm install` needed inside the sandbox at runtime.

## `/opt/tunnel` — the reverse-tunnel sidecar

`/opt/tunnel` is a CommonJS package directory with `ws` pre-installed in its `node_modules`. At runtime the build processor writes the sidecar source to `/opt/tunnel/server.js` (`appTunnelServer.ts` → `sandbox.files.write`) and starts it in the background (`node /opt/tunnel/server.js`, listening on 8585). The backend dials a WebSocket into the sidecar via `sandbox.getHost(8585)`; the in-sandbox MCP server calls `http://localhost:8585/api/internal/app-mcp/<token>/…` and the sidecar proxies each call over that socket to the backend, which performs the final fetch on its own internal network.

This **replaces the old `APP_MCP_BASE_URL` public-URL callback** — the backend is never publicly reachable from the sandbox, so no cloudflared (local) or public ingress (on-prem) is needed for the MCP callback. The `ws` dep is baked; the server source is injected at runtime (hot-swappable without an image rebuild, same as `/opt/mcp`).

## `/opt/starter-template` — the static app scaffold

A complete, build-green Vite SPA (React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui new-york
+ react-router `HashRouter`). It is configured for static serving under a deep, opaque path:
`vite.config.ts` sets `base: "./"` (relative asset URLs) and the router is hash-based (no server
rewrites needed). Its `CLAUDE.md` is the authoring contract Claude Code auto-loads each turn — it
enforces the **static-only** rule (no `fetch`/server/`eval`) and documents the theme-token swap
seam and the future actions data layer.

`CLAUDE.md` is **platform-owned, not app-owned**: the build runner re-copies it from this baked
template into the app dir at the start of *every* turn (not just at seed time). A brand-new app
copies it in via the seed, but a hydrated app would otherwise keep the frozen copy committed when
it was first created — so a guidance fix would never reach existing apps. Re-overlaying it means a
contract change rolls out to **all** apps after a template rebuild, with no per-app migration. The
overlay is scoped to `CLAUDE.md` only — `package.json` / `vite.config.ts` / `tsconfig*` can be
edited per app (e.g. an added dependency), so they are left as the app committed them. The action
runtime (`@nocodb/app-ctx`) does not need overlaying — it is a baked `node_modules` package (see
below), which the per-turn `node_modules` symlink already re-provides to every app.

The image runs `npm ci` (so `node_modules` is pre-installed) and a throwaway `npm run build` (to
validate the scaffold and warm the `tsc` incremental cache). A new app is seeded by copying the
scaffold **without** `node_modules`; the per-turn build re-provides `node_modules` by symlinking
back to `/opt/starter-template/node_modules` (deps are pinned, so one install serves every app).

## `@nocodb/app-ctx` — the action runtime

App code reads and writes the user's data through **actions**, called via a small typed runtime:

```ts
import { ctx, IntegrationError } from '@nocodb/app-ctx'
const rows = await ctx.actions['listFeatures']({ status: 'open' })
const me = ctx.user // { id, email?, displayName?, role? } | undefined
```

This is nocovibe's `@nocovibe/ctx` pattern. The runtime source is `runtime-modules/app-ctx/index.ts`;
the image compiles it (via the esbuild that ships with the starter's `vite`) into a real package at
`/opt/starter-template/node_modules/@nocodb/app-ctx/` (`index.js` + `package.json` + `index.d.ts`).
Because every app symlinks its `node_modules` to this baked dir each turn, the import resolves with
**no per-app alias, `tsconfig` path, or source file** — and a runtime change reaches every app (new
*and* hydrated) on the next image rebuild. Two window globals (`window.__nc_app_invoke_url__`,
`window.__nc_app_user__`) are injected into the served HTML by the preview controller; the runtime
reads them at call time. The browser↔broker contract is guarded by a backend unit test
(`tests/unit/rest/tests/internal/ee/app-ctx-module.test.ts`).

## What is NOT baked in (injected at runtime)

The MCP stdio server source (`/opt/mcp/server.mjs`) and its `--mcp-config` JSON are **written into the sandbox per-turn** by the build processor (`sandbox.files.write`). Only the SDK `node_modules` dependency is baked. This keeps the server source hot-swappable without an image rebuild.

---

## Build & register

> Prerequisites: `e2b` CLI installed and authenticated (`e2b auth login`), local Docker daemon running.

```bash
cd packages/nocodb/e2b/app-builder
e2b template create nocodb-app-builder --cpu-count 2 --memory-mb 4096
```

> The legacy `e2b template build` (v1) is deprecated and now exits without building — use `e2b template create` (v2). CPU/memory are v2 CLI flags (the `cpu_count`/`memory_mb` keys in `e2b.toml` are v1 and ignored by v2). The Dockerfile in this directory is auto-detected. **Passing an existing template name rebuilds that template in place, preserving its `template_id`; a new name mints a new template with a new id.**

### Reverse-tunnel migration — cutover complete

The reverse-tunnel image (bakes `/opt/tunnel` + `ws`) was first staged under a **new** name, **`nocodb-app-builder-staging`** (id `irephy9zglmtzuaycwji`), so the pre-tunnel backend + its `nocodb-app-builder` template stayed untouched during the transition. Once the tunnel backend was verified and deployed to dogfood, the **canonical `nocodb-app-builder` template (id `pqij35l3krqpk7gylga6`) was rebuilt in place** with the tunnel image (`e2b template create nocodb-app-builder …`, id preserved). `e2b.toml` now points at the canonical template again.

The backend reaches it as `nocodb-app-builder` (id `pqij35l3krqpk7gylga6`), from
`DEFAULT_TEMPLATES[ComputeWorkload.AppBuilder]`.

The staging template has since been deleted — canonical is the only app-builder template.

This is distinct from `E2B_TEMPLATE_ID` (the code-interpreter template). Both must be set for the full system to function.

---

## Credentials forwarded at `Sandbox.create` time

The build processor passes these env vars into the sandbox so `claude` can authenticate:

| Env var | Purpose |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth token for Claude Code (preferred if set) |
| `ANTHROPIC_API_KEY` | API key fallback if `CLAUDE_CODE_OAUTH_TOKEN` is not set |

`NC_COMPUTE_E2B_API_KEY` is used by the `Sandbox.create` call itself (host-side) and is not forwarded into the sandbox.

---

## Pointing at a different bake

To bisect a bad bake, or to run against your own team's template, pass
`opts.templates[ComputeWorkload.AppBuilder]` when constructing the provider — a
value carrying an explicit `:` target is used verbatim. Any equivalent image
works as long as it bakes `node` + `git` + `@anthropic-ai/claude-code` + `tsx`;
the MCP server is injected at runtime.

---

## Verification (manual, post-build)

After `e2b template build` completes:

```ts
import { Sandbox } from 'e2b'

const sandbox = await Sandbox.create('nocodb-app-builder', {
  apiKey: process.env.NC_COMPUTE_E2B_API_KEY,
})
const result = await sandbox.commands.run('claude --version && git --version && node --version')
console.log(result.stdout)
await sandbox.kill()
```

All three version strings should print without error.

> **Note:** This smoke test is deferred until after the user runs `e2b template build`. It requires a live E2B account and cannot be executed as part of authoring this template.
