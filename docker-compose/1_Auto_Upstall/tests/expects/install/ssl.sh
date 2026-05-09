#!/usr/bin/env bash
#
# Drives noco.sh in production mode with a real domain — exercises Traefik + LE config.
#
set -e
RANDOM_NUMBER="${1:-1}"
DOMAIN="${RANDOM_NUMBER}.ssl.nocodb.dev"
export PATH="$WORKING_DIR/mocks:$PATH"
bash ../../noco.sh \
  --domain="$DOMAIN" \
  --acme-email='ssl-test@nocodb.com' \
  --pg=bundled \
  --redis=bundled
