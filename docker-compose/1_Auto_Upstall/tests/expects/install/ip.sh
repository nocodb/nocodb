#!/usr/bin/env bash
#
# Drives noco.sh with an IP-as-domain (production-ip mode, no SSL, port 80).
#
set -e
IP="${1:-1.2.3.4}"
export PATH="$WORKING_DIR/mocks:$PATH"
bash ../../noco.sh \
  --domain="$IP" \
  --pg=bundled \
  --redis=bundled
