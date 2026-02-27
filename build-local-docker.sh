#!/bin/bash
set -euo pipefail

#
# Build local Docker images for CE and On-Prem editions.
# Useful for testing migration scenarios (CE → On-Prem, version upgrades, etc.)
#
# Usage:
#   ./build-local-docker.sh              # Build both CE and On-Prem
#   ./build-local-docker.sh ce           # Build CE only
#   ./build-local-docker.sh onprem       # Build On-Prem only
#
# Images produced:
#   nocodb-local:ce       — Community Edition (no EE features)
#   nocodb-local:onprem   — Enterprise On-Prem Edition
#
# Both images expose port 8080 and expect NC_DB for the database connection.
#
# Example docker-compose usage:
#   NC_DB="pg://host.docker.internal:5432?u=postgres&p=password&d=nocodb"
#   docker run -p 8080:8080 -e NC_DB="$NC_DB" nocodb-local:ce
#   docker run -p 8080:8080 -e NC_DB="$NC_DB" -e NC_LICENSE_KEY="..." nocodb-local:onprem
#

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
NOCODB_DIR="$REPO_ROOT/packages/nocodb"
NC_GUI_DIR="$REPO_ROOT/packages/nc-gui"
SDK_DIR="$REPO_ROOT/packages/nocodb-sdk"

CE_IMAGE="nocodb-local:ce"
ONPREM_IMAGE="nocodb-local:onprem"

TARGET="${1:-all}"

export NODE_OPTIONS="--max_old_space_size=8192"

log() { echo -e "\n\033[1;36m▶ $1\033[0m"; }
err() { echo -e "\033[1;31m✗ $1\033[0m" >&2; exit 1; }

# ─── Step 1: Build SDK ───────────────────────────────────────────────
build_sdk() {
  log "Building nocodb-sdk (EE)..."
  cd "$SDK_DIR"
  pnpm run build:ee
}

# ─── Step 2: Build Frontend ──────────────────────────────────────────
build_gui_ce() {
  log "Building nc-gui (CE)..."
  cd "$NC_GUI_DIR"
  pnpm run generate
  log "Copying CE frontend to nocodb/docker/nc-gui..."
  rm -rf "$NOCODB_DIR/docker/nc-gui"
  rsync -ah --delete ./dist/ "$NOCODB_DIR/docker/nc-gui/"
}

build_gui_ee() {
  log "Building nc-gui (EE)..."
  cd "$NC_GUI_DIR"
  pnpm run generate:ee
  log "Copying EE frontend to nocodb/docker/nc-gui..."
  rm -rf "$NOCODB_DIR/docker/nc-gui"
  rsync -ah --delete ./ee/dist/ "$NOCODB_DIR/docker/nc-gui/"
}

# ─── Step 3: Build Backend ───────────────────────────────────────────
build_backend_ce() {
  log "Building backend (CE) with rspack..."
  cd "$NOCODB_DIR"
  pnpm exec rspack --config docker/rspack.config.js
}

build_backend_onprem() {
  log "Building backend (On-Prem EE) with rspack..."
  cd "$NOCODB_DIR"
  EE=true pnpm exec rspack --config rspack.ee-on-prem.config.js
}

# ─── Step 4: Build Docker Image ──────────────────────────────────────
build_docker_ce() {
  log "Building Docker image: $CE_IMAGE"
  cd "$NOCODB_DIR"
  docker build -f Dockerfile.local -t "$CE_IMAGE" .
}

build_docker_onprem() {
  log "Building Docker image: $ONPREM_IMAGE"
  cd "$NOCODB_DIR"
  docker build -f src/ee-on-prem/Dockerfile-on-prem.local -t "$ONPREM_IMAGE" .
}

# ─── Orchestration ───────────────────────────────────────────────────
case "$TARGET" in
  ce)
    build_sdk
    build_gui_ce
    build_backend_ce
    build_docker_ce
    log "Done! CE image ready: $CE_IMAGE"
    ;;
  onprem)
    build_sdk
    build_gui_ee
    build_backend_onprem
    build_docker_onprem
    log "Done! On-Prem image ready: $ONPREM_IMAGE"
    ;;
  all)
    build_sdk

    # Build CE
    build_gui_ce
    build_backend_ce
    build_docker_ce

    # Build On-Prem (rebuilds frontend + backend for EE)
    build_gui_ee
    build_backend_onprem
    build_docker_onprem

    log "Done! Both images ready:"
    echo "  $CE_IMAGE"
    echo "  $ONPREM_IMAGE"
    ;;
  *)
    err "Unknown target: $TARGET (use: ce, onprem, or all)"
    ;;
esac

echo ""
echo "Quick start with PostgreSQL:"
echo "  docker run -p 8081:8080 -e NC_DB=\"pg://host.docker.internal:5432?u=postgres&p=password&d=nocodb\" $CE_IMAGE"
echo "  docker run -p 8082:8080 -e NC_DB=\"pg://host.docker.internal:5432?u=postgres&p=password&d=nocodb\" $ONPREM_IMAGE"
