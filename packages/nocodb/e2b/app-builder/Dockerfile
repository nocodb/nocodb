# e2b sandboxes run x86_64. Pin the platform so native binaries are
# linux/amd64 even when the template is built from Apple Silicon via the
# local Docker daemon (qemu). Debian slim, NOT alpine — native binaries
# assume glibc.
FROM --platform=linux/amd64 node:24-slim

# git: in-sandbox repo hydrate / commit / snapshot. ca-certificates: HTTPS
# for claude + the MCP callback. No build-essential — nothing native is
# compiled here.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# claude: the build engine (the build processor spawns `claude` per turn).
# tsx: runs the runtime-injected MCP stdio server script.
# Pin both — replace `latest` with the resolved versions after the first
# successful build for reproducibility.
RUN npm install -g @anthropic-ai/claude-code@latest tsx@4

# Bake the MCP SDK into a dedicated ESM package dir. The build processor writes
# the MCP stdio server to /opt/mcp/server.mjs at runtime and Claude spawns it
# via `node /opt/mcp/server.mjs`; the .mjs resolves @modelcontextprotocol/sdk
# from this sibling node_modules. (Server source is injected at runtime, not baked.)
RUN mkdir -p /opt/mcp \
 && cd /opt/mcp \
 && npm init -y \
 && npm pkg set type=module \
 && npm install @modelcontextprotocol/sdk@^1.26.0

# NOTE: the MCP stdio server script is written into the sandbox at runtime
# (Task 8 sandbox.files.write), NOT baked into this image. This keeps the
# image minimal and lets the MCP server change without an image rebuild.

# Bake the static starter template (Vite + React + Tailwind v4 + shadcn/ui).
# A brand-new app is seeded by copying /opt/starter-template into the app dir;
# `npm ci` here pre-installs node_modules so per-turn `vite build` needs no
# network install. The app's own node_modules is git-ignored and is re-provided
# each turn by symlinking back to this baked copy (deps are pinned, so one
# install serves every app and every revision).
COPY starter-template /opt/starter-template
RUN cd /opt/starter-template \
 && npm ci \
 && npm run build \
 && rm -rf dist

# The app repo lands here at runtime (git clone / git init / seed from starter).
RUN mkdir -p /home/user/app
WORKDIR /home/user/app
