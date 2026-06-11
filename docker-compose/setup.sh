#!/usr/bin/env bash
#
# Thin wrapper that invokes the auto-upstall script when run from a cloned repo.
# Same wizard as `bash <(curl -sSL install.nocodb.com/noco.sh)`, just local.
#
set -e
exec bash "$(dirname "$0")/1_Auto_Upstall/noco.sh" "$@"
