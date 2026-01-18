#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUI_DIR="$ROOT_DIR/packages/nc-gui"

# Allow node to use 8 GB of ram (preserve existing NODE_OPTIONS if present)
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192"

echo "Building nocodb-sdk..."
pnpm --dir "$ROOT_DIR" --filter=nocodb-sdk run build

echo "Linking local nocodb-sdk into consumers..."
pnpm --dir "$ROOT_DIR" run install:local-sdk

echo "Cleaning previous GUI build artifacts..."
rm -rf "$GUI_DIR/.nuxt" "$GUI_DIR/.output" "$GUI_DIR/dist"

echo "Building GUI and copying to nc-lib-gui..."
pnpm --dir "$GUI_DIR" run build:copy

echo "Restarting nocodb service..."
sudo systemctl restart nocodb.service

echo "Done."
