#!/usr/bin/env bash
#
# Drives noco.sh in non-interactive mode with external Redis.
#
set -e
export PATH="$WORKING_DIR/mocks:$PATH"
bash ../../noco.sh \
  --domain=localhost \
  --pg=bundled \
  --redis=external --redis-url='redis://localhost:6379'
