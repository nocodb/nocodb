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

## What is NOT baked in (injected at runtime)

The MCP stdio server script and its `--mcp-config` JSON are **written into the sandbox per-turn** by the build processor (`sandbox.files.write`). Nothing MCP-related is baked into this image. This keeps the image minimal and allows the MCP server to change without requiring an image rebuild.

---

## Build & register

> Prerequisites: `e2b` CLI installed and authenticated (`e2b auth login`), local Docker daemon running.

```bash
cd packages/nocodb/e2b/app-builder
e2b template build
```

`e2b template build` builds the Docker image, pushes it to E2B, and writes the resulting `template_id` back into `e2b.toml`.

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
