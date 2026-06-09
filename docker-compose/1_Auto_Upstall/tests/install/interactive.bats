#!/usr/bin/env bats
#
# UX guard for the interactive wizard, driven by expect. The flag-driven tests
# cover artifact generation; this one exercises the actual prompt flow.
# Gated: run with TEST_INTERACTIVE=1.

load ../lib/helpers

setup() {
  [ -n "$TEST_INTERACTIVE" ] || skip "set TEST_INTERACTIVE=1 to run the interactive wizard test"
  command -v expect >/dev/null || skip "expect not installed"
}

teardown() { noco_scratch_cleanup; }

@test "interactive wizard produces a valid local install" {
  noco_scratch
  cd "$NOCO_SCRATCH"
  "${BATS_TEST_DIRNAME}/../expects/install/interactive.sh"

  [ -f "$NOCO_SCRATCH/nocodb/docker-compose.yml" ]
  grep -q "'8080:8080'" "$NOCO_SCRATCH/nocodb/docker-compose.yml"
  grep -q 'image: postgres' "$NOCO_SCRATCH/nocodb/docker-compose.yml"
  grep -q 'image: redis' "$NOCO_SCRATCH/nocodb/docker-compose.yml"
}
