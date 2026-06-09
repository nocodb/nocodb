#!/usr/bin/env bats
#
# The installer's external-Postgres db.json must stay structurally in sync with the
# committed docker-compose/examples/ that document the same setups. We compare the
# jq-normalized structure (keys + ssl shape, values stripped) so docs and installer
# can't silently drift apart. Byte-identity is intentionally NOT required — the
# example docker.env files legitimately differ from installer output.

load ../lib/helpers

norm_json() { jq -S 'walk(if type == "string" then "X" else . end)' "$1"; }

# assert_same_structure <generated db.json> <example db.json>
assert_same_structure() {
  diff <(norm_json "$1") <(norm_json "$2")
}

setup() {
  command -v jq >/dev/null || skip "jq not installed"
}

teardown() { noco_scratch_cleanup; }

@test "external PG (managed SSL) matches the managed-postgres example" {
  generate --domain=localhost --pg=external --pg-host=h --pg-user=u --pg-password=p --pg-ssl=managed --redis=bundled
  assert_same_structure "$GEN_DIR/nocodb/db.json" "$(examples_dir)/managed-postgres/nocodb/db.json"
}

@test "external PG (custom CA) matches the postgres-private-ca example" {
  generate --domain=localhost --pg=external --pg-host=h --pg-user=u --pg-password=p --pg-ssl="$(fake_ca)" --redis=bundled
  assert_same_structure "$GEN_DIR/nocodb/db.json" "$(examples_dir)/postgres-private-ca/nocodb/db.json"
}

@test "external PG + Redis matches the external-postgres-and-redis example" {
  generate --domain=localhost --pg=external --pg-host=h --pg-user=u --pg-password=p --pg-ssl=managed --redis=external --redis-url=redis://r:6379
  assert_same_structure "$GEN_DIR/nocodb/db.json" "$(examples_dir)/external-postgres-and-redis/nocodb/db.json"
}
