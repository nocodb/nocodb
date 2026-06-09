#!/usr/bin/env bats
#
# Verifies noco.sh generates the right artifacts for each install scenario.
# Pure file generation — no Docker required. Set TEST_DOCKER=1 to also validate
# the generated compose with `docker compose config`.

load ../lib/helpers

teardown() { noco_scratch_cleanup; }

# ── docker-compose.yml golden snapshots ─────────────────────────────────────────

@test "local: bundled PG + bundled Redis compose matches golden" {
  generate --domain=localhost --pg=bundled --redis=bundled
  assert_golden local
}

@test "production-ip: IP domain compose matches golden (port 80, no traefik)" {
  generate --domain=1.2.3.4 --pg=bundled --redis=bundled
  assert_golden production-ip
}

@test "production-ssl: real domain compose matches golden (traefik + Let's Encrypt)" {
  generate --domain=demo.example.com --acme-email=ssl@nocodb.com --pg=bundled --redis=bundled
  assert_golden production-ssl
}

@test "external-redis: external Redis compose matches golden (no bundled redis)" {
  generate --domain=localhost --pg=bundled --redis=external --redis-url=redis://localhost:6379
  assert_golden external-redis
}

@test "external-pg-managed: external PG (managed SSL) compose matches golden" {
  generate --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=managed --redis=bundled
  assert_golden external-pg-managed
}

@test "external-pg-none: external PG (no SSL) compose matches golden" {
  generate --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=none --redis=bundled
  assert_golden external-pg-none
}

@test "external-pg-custom: external PG (custom CA) compose matches golden" {
  generate --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl="$(fake_ca)" --redis=bundled
  assert_golden external-pg-custom
}

@test "external-pg-and-redis: fully external compose matches golden" {
  generate --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=managed --redis=external --redis-url=redis://redis.example.com:6379
  assert_golden external-pg-and-redis
}

# ── db.json ─────────────────────────────────────────────────────────────────────

@test "bundled PG: db.json points at the bundled db service, no SSL block" {
  generate --domain=localhost --pg=bundled --redis=bundled
  grep -q '"client": "pg"' "$GEN_DIR/nocodb/db.json"
  grep -q '"host": "db"' "$GEN_DIR/nocodb/db.json"
  grep -q '"port": "5432"' "$GEN_DIR/nocodb/db.json"
  grep -q '"database": "nocodb"' "$GEN_DIR/nocodb/db.json"
  ! grep -q '"ssl"' "$GEN_DIR/nocodb/db.json"
}

@test "external PG (no SSL): db.json targets the external host with no SSL block" {
  generate --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl=none --redis=bundled
  grep -q '"host": "db.example.com"' "$GEN_DIR/nocodb/db.json"
  ! grep -q '"ssl"' "$GEN_DIR/nocodb/db.json"
}

@test "external PG (custom CA): db.json embeds the CA certificate" {
  generate --domain=localhost --pg=external --pg-host=db.example.com --pg-user=nocodb --pg-password=secretpass --pg-ssl="$(fake_ca)" --redis=bundled
  grep -q '"rejectUnauthorized": true' "$GEN_DIR/nocodb/db.json"
  grep -q 'BEGIN CERTIFICATE' "$GEN_DIR/nocodb/db.json"
}

# ── bundled password (the one dynamic value) ────────────────────────────────────

@test "bundled PG: a strong password is generated and shared by compose + db.json" {
  generate --domain=localhost --pg=bundled --redis=bundled
  local pw_env pw_json
  pw_env=$(grep 'POSTGRES_PASSWORD:' "$GEN_DIR/docker-compose.yml" | sed -E 's/.*POSTGRES_PASSWORD: //')
  pw_json=$(grep '"password"' "$GEN_DIR/nocodb/db.json" | sed -E 's/.*"password": "([^"]*)".*/\1/')
  [ "${#pw_env}" -ge 24 ]
  [[ "$pw_env" =~ ^[A-Za-z0-9]+$ ]]
  [ "$pw_env" = "$pw_json" ]
}

# ── docker.env ──────────────────────────────────────────────────────────────────

@test "docker.env carries the fixed settings block" {
  generate --domain=localhost --pg=bundled --redis=bundled
  grep -q '^NC_DB_JSON_FILE=/usr/app/data/db.json$' "$GEN_DIR/docker.env"
  grep -q '^NC_ALLOW_LOCAL_EXTERNAL_DBS=true$' "$GEN_DIR/docker.env"
  grep -q '^NC_SECURE_ATTACHMENTS=true$' "$GEN_DIR/docker.env"
  grep -q '^NC_DISABLE_MUX=true$' "$GEN_DIR/docker.env"
}

@test "docker.env: bundled Redis URL" {
  generate --domain=localhost --pg=bundled --redis=bundled
  grep -q '^NC_REDIS_URL=redis://redis:6379$' "$GEN_DIR/docker.env"
}

@test "docker.env: external Redis URL is honoured" {
  generate --domain=localhost --pg=bundled --redis=external --redis-url=redis://localhost:6379
  grep -q '^NC_REDIS_URL=redis://localhost:6379$' "$GEN_DIR/docker.env"
}

@test "docker.env: NC_SITE_URL is the localhost URL in local mode" {
  generate --domain=localhost --pg=bundled --redis=bundled
  grep -q '^NC_SITE_URL=http://localhost:8080$' "$GEN_DIR/docker.env"
}

@test "docker.env: NC_SITE_URL is http://<ip> in production-ip mode" {
  generate --domain=1.2.3.4 --pg=bundled --redis=bundled
  grep -q '^NC_SITE_URL=http://1.2.3.4$' "$GEN_DIR/docker.env"
}

@test "docker.env: NC_SITE_URL is https://<domain> in production mode" {
  generate --domain=demo.example.com --acme-email=ssl@nocodb.com --pg=bundled --redis=bundled
  grep -q '^NC_SITE_URL=https://demo.example.com$' "$GEN_DIR/docker.env"
}

# ── supporting files ────────────────────────────────────────────────────────────

@test "secret files are locked down to 0600" {
  generate --domain=localhost --pg=bundled --redis=bundled
  local mode
  mode=$(stat -c '%a' "$GEN_DIR/docker.env" 2>/dev/null || stat -f '%Lp' "$GEN_DIR/docker.env")
  [ "$mode" = "600" ]
}

@test "update.sh and .gitignore are generated" {
  generate --domain=localhost --pg=bundled --redis=bundled
  [ -x "$GEN_DIR/update.sh" ]
  grep -q '^docker.env$' "$GEN_DIR/.gitignore"
  grep -q '^nocodb/db.json$' "$GEN_DIR/.gitignore"
}

# ── optional Docker smoke (gated) ───────────────────────────────────────────────

@test "compose validates with docker compose config" {
  [ -n "$TEST_DOCKER" ] || skip "set TEST_DOCKER=1 to run docker compose config"
  generate --domain=localhost --pg=bundled --redis=bundled
  ( cd "$GEN_DIR" && docker compose config >/dev/null )
}
