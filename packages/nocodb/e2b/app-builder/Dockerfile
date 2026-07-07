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

# NOTE: the MCP stdio server script is written into the sandbox at runtime
# (Task 8 sandbox.files.write), NOT baked into this image. This keeps the
# image minimal and lets the MCP server change without an image rebuild.

# The app repo lands here at runtime (git clone / git init).
RUN mkdir -p /home/user/app
WORKDIR /home/user/app
