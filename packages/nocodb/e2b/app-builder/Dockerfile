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
# claude-code is PINNED: `@latest` once silently drifted across a rebuild to a
# version whose startup config handling broke the build turn. Bump deliberately
# (and re-run the build smoke) rather than tracking latest.
RUN npm install -g @anthropic-ai/claude-code@2.1.187 tsx@4

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
 && chmod 0777 node_modules
# This RUN executes as root, but the sandbox runs as the unprivileged `user`, who
# symlinks this node_modules into the app dir and runs `vite build`. tsc + vite must
# create temp dirs AT the node_modules root (.tmp for *.tsbuildinfo, .vite, .vite-temp).
# Two rules make that work, and both matter:
#   1. Do NOT run `npm run build` here. A bake-time build would create those temp dirs
#      as root (0755) — then the runtime `user` can't write into them (EACCES), and a
#      top-level `chmod` can't fix a pre-existing root-owned *subdir*. `npm ci` leaves
#      only read-only package files (root:root, world-readable — builds only read them),
#      so no root-owned temp dirs exist to collide with.
#   2. `chmod 0777 node_modules` (top dir only) lets `user` create those temp dirs fresh,
#      owning them. The starter template's own compile is verified by the build smoke,
#      not at image-bake time.

# The app repo lands here at runtime (git clone / git init / seed from starter).
RUN mkdir -p /home/user/app
WORKDIR /home/user/app
