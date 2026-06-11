#!/usr/bin/env bats
#
# Non-interactive flag validation: missing or incompatible flags must fail fast
# with a clear message (exit 1); --help must succeed. No Docker required.

load ../lib/helpers

run_noco() {
  run env NOCO_SKIP_PREFLIGHT=1 bash "$(noco_sh)" "$@"
}

@test "missing --pg fails" {
  run_noco --domain=localhost --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"--pg=bundled or --pg=external is required"* ]]
}

@test "external PG without --pg-host fails" {
  run_noco --domain=localhost --pg=external --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"--pg-host is required when --pg=external"* ]]
}

@test "external PG without --pg-user fails" {
  run_noco --domain=localhost --pg=external --pg-host=db.example.com --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"--pg-user is required when --pg=external"* ]]
}

@test "external PG without --pg-password fails" {
  run_noco --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"--pg-password is required when --pg=external"* ]]
}

@test "missing --redis fails" {
  run_noco --domain=localhost --pg=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"--redis=bundled or --redis=external is required"* ]]
}

@test "external Redis without --redis-url fails" {
  run_noco --domain=localhost --pg=bundled --redis=external
  [ "$status" -eq 1 ]
  [[ "$output" == *"--redis-url is required when --redis=external"* ]]
}

@test "unknown flag fails" {
  run_noco --domain=localhost --pg=bundled --redis=bundled --bogus
  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown flag"* ]]
}

@test "production domain without --acme-email fails" {
  run_noco --domain=demo.example.com --pg=bundled --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"--acme-email is required"* ]]
}

@test "external PG with a CA path that does not exist fails" {
  run_noco --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=/no/such/ca.pem --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"CA file not found"* ]]
}

@test "misspelled --pg-ssl value fails instead of writing an empty CA" {
  run_noco --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=mananged --redis=bundled
  [ "$status" -eq 1 ]
  [[ "$output" == *"CA file not found"* ]]
}

@test "removed subcommands point to the new workflow" {
  run_noco upgrade
  [ "$status" -eq 1 ]
  [[ "$output" == *"no longer a subcommand"* ]]
}

@test "--help exits 0 and prints usage" {
  run_noco --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Non-interactive flags"* ]]
}
