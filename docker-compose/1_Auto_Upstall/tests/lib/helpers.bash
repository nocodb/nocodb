#!/usr/bin/env bash
# Shared helpers for the auto-upstall installer tests.
#
# All generation runs with NOCO_SKIP_PREFLIGHT set, so the installer skips the
# OS/Docker/port preflight and the generation logic runs on any OS without Docker.

noco_sh()      { echo "${BATS_TEST_DIRNAME}/../../noco.sh"; }
golden_dir()   { echo "${BATS_TEST_DIRNAME}/../golden"; }
examples_dir() { echo "${BATS_TEST_DIRNAME}/../../../examples"; }

# Per-test scratch dir. Don't use $BATS_TEST_TMPDIR: it only exists since
# bats 1.4.0, and ubuntu-22.04 (CI) ships bats 1.2.1 where it's empty.
# noco_scratch must run in the test shell (not a $() subshell) so NOCO_SCRATCH
# persists for reuse and for teardown() to clean up.
noco_scratch()         { [ -n "${NOCO_SCRATCH:-}" ] || NOCO_SCRATCH="$(mktemp -d)"; }
noco_scratch_cleanup() { [ -n "${NOCO_SCRATCH:-}" ] && rm -rf "$NOCO_SCRATCH"; return 0; }

# fake_ca — write a throwaway CA file to the scratch dir and echo its path.
# Generated at runtime rather than committed (repo .gitignore excludes *.pem).
# Content only needs to be PEM-shaped text; the installer embeds it verbatim.
fake_ca() {
  noco_scratch
  local f="$NOCO_SCRATCH/fake-ca.pem"
  cat > "$f" <<'PEM'
-----BEGIN CERTIFICATE-----
TEST0NLYnotARealCertificateForBatsFixturesXXXXXXXXXXXXXXXXXXXXXXXXX
YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY
-----END CERTIFICATE-----
PEM
  echo "$f"
}

# generate <flags...> — run the installer into an isolated tmp dir.
# Afterwards GEN_DIR is the deploy directory:
#   $GEN_DIR/docker-compose.yml
#   $GEN_DIR/docker.env
#   $GEN_DIR/nocodb/db.json
generate() {
  noco_scratch
  GEN_DIR="$NOCO_SCRATCH/run"
  rm -rf "$GEN_DIR"
  mkdir -p "$GEN_DIR"
  ( cd "$GEN_DIR" && NOCO_SKIP_PREFLIGHT=1 bash "$(noco_sh)" "$@" ) >/dev/null 2>&1
  GEN_DIR="$GEN_DIR/nocodb"
}

# normalize <file> — replace the random bundled Postgres password with a stable
# placeholder so golden diffs don't churn on every run.
normalize() {
  LC_ALL=C sed -E \
    -e 's/(POSTGRES_PASSWORD: ).*/\1__PASSWORD__/' \
    -e 's/("password"[[:space:]]*:[[:space:]]*")[^"]*(")/\1__PASSWORD__\2/' \
    "$1"
}

# assert_golden <scenario> — diff the generated (normalized) compose file against
# the committed golden. A mismatch prints a unified diff and fails the test.
assert_golden() {
  diff -u "$(golden_dir)/$1/docker-compose.yml" <(normalize "$GEN_DIR/docker-compose.yml")
}
