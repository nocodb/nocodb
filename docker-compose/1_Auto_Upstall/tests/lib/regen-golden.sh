#!/usr/bin/env bash
#
# Regenerate the golden docker-compose.yml files. Run this ONLY after an
# intentional change to noco.sh's compose generation, then review the resulting
# git diff before committing.
#
# Keep the scenario list here in sync with tests/install/generate.bats.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOCO="$here/../../noco.sh"
GOLDEN="$here/../golden"

# Throwaway CA for the custom-CA scenario (matches tests/lib/helpers.bash fake_ca).
CA="$(mktemp)"; trap 'rm -f "$CA"' EXIT
printf -- '-----BEGIN CERTIFICATE-----\nTEST0NLYnotARealCertificateForBatsFixturesXXXXXXXXXXXXXXXXXXXXXXXXX\n-----END CERTIFICATE-----\n' > "$CA"

normalize() {
  LC_ALL=C sed -E \
    -e 's/(POSTGRES_PASSWORD: ).*/\1__PASSWORD__/' \
    -e 's/("password"[[:space:]]*:[[:space:]]*")[^"]*(")/\1__PASSWORD__\2/' \
    "$1"
}

gen() {
  local name="$1"; shift
  local work; work="$(mktemp -d)"
  ( cd "$work" && NOCO_SKIP_PREFLIGHT=1 bash "$NOCO" "$@" >/dev/null 2>&1 )
  mkdir -p "$GOLDEN/$name"
  normalize "$work/nocodb/docker-compose.yml" > "$GOLDEN/$name/docker-compose.yml"
  rm -rf "$work"
  echo "regenerated golden/$name/docker-compose.yml"
}

gen local                 --domain=localhost --pg=bundled --redis=bundled
gen production-ip         --domain=1.2.3.4 --pg=bundled --redis=bundled
gen production-ssl        --domain=demo.example.com --acme-email=ssl@nocodb.com --pg=bundled --redis=bundled
gen external-redis        --domain=localhost --pg=bundled --redis=external --redis-url=redis://localhost:6379
gen external-pg-managed   --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=managed --redis=bundled
gen external-pg-none      --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=none --redis=bundled
gen external-pg-custom    --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl="$CA" --redis=bundled
gen external-pg-and-redis --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=managed --redis=external --redis-url=redis://redis.example.com:6379
