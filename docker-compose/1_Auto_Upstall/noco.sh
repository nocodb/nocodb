#!/usr/bin/env bash
#
# NocoDB Auto-upstall installer.
# Single image (community + enterprise). License activates post-install via Admin Panel.
#
set -euo pipefail

if [ "${1:-}" = "--debug" ]; then
  set -x
  shift
fi

# Generated files (db.json, docker.env) hold DB credentials. Create them
# owner-only from the start, not just chmod 600 after the fact.
umask 077

WORK_DIR="${PWD}/nocodb"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── State (set by prompts or flags) ───────────────────────────────────────────
DOMAIN=""
MODE=""              # local | production | production-ip
ACME_EMAIL=""
PG_MODE=""           # bundled | external
PG_HOST=""           # external only; bundled hardcodes "db". Required for external.
PG_PORT="5432"
PG_DATABASE="nocodb"
PG_USER=""           # defaulted to "nocodb" on bundled paths. Required for external.
PG_PASSWORD=""
PG_SSL=""            # managed | none | custom
PG_CA_FILE=""
REDIS_MODE=""        # bundled | external
REDIS_URL=""         # set on bundled paths. Required for external.
HOST_PORT="8080"
IMAGE_TAG="latest"   # docker tag for nocodb/nocodb
NON_INTERACTIVE=0
NOCO_SKIP_PREFLIGHT="${NOCO_SKIP_PREFLIGHT:-}"   # when set, skip OS/Docker/port checks (testing & re-runs)
SELINUX_SUFFIX=""    # ":Z" when SELinux is enforcing
STACK_STARTED=0      # set to 1 once 'docker compose up -d' succeeds

# ── Helpers ───────────────────────────────────────────────────────────────────
header() { printf '\n%b── %s ──────────────────────────────────%b\n' "$BOLD" "$1" "$NC"; }
info()   { printf '  %s\n' "$1"; }
ok()     { printf '  %b✓%b %s\n' "$GREEN" "$NC" "$1"; }
warn()   { printf '  %b!%b %s\n' "$YELLOW" "$NC" "$1"; }
fail()   { printf '  %bError: %s%b\n' "$RED" "$1" "$NC" >&2; exit 1; }

ask() {
  local prompt="$1" default="${2:-}"
  if [ -n "$default" ]; then
    printf '  %s %b[%s]%b: ' "$prompt" "$DIM" "$default" "$NC"
  else
    printf '  %s: ' "$prompt"
  fi
  read -r REPLY </dev/tty
  REPLY="${REPLY:-$default}"
}

ask_secret() {
  printf '  %s: ' "$1"
  read -rs REPLY </dev/tty
  echo
}

pick() {
  local i=1
  for opt in "$@"; do
    printf '  %b%d%b) %s\n' "$BOLD" "$i" "$NC" "$opt"
    ((i++))
  done
  printf '  > '
  read -r REPLY </dev/tty
}

generate_password() {
  local pw
  pw="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 24 || true)"
  if [ -n "$pw" ] && [ "${#pw}" -ge 24 ]; then
    printf '%s' "$pw"
  else
    printf 'CHANGE_ME_%s' "$(date +%s)"
  fi
}

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

is_valid_domain() {
  local re="^([a-zA-Z0-9]([-a-zA-Z0-9]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([-a-zA-Z0-9]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}$"
  [[ "$1" =~ $re ]]
}

get_public_ip() {
  curl -s --max-time 3 https://api.ipify.org 2>/dev/null \
    || curl -s --max-time 3 https://ifconfig.me 2>/dev/null \
    || echo ""
}

# ── Prerequisites ─────────────────────────────────────────────────────────────
# Runs on Linux, macOS, and Windows (Git Bash / WSL). We don't install anything
# for you: if a dependency is missing, we point you at it and ask you to re-run.
check_prereqs() {
  [ -n "$NOCO_SKIP_PREFLIGHT" ] && return 0
  printf '\n%bNocoDB Auto-upstall%b\n' "$BOLD" "$NC"
  printf '%b═══════════════════════════════════════════%b\n' "$DIM" "$NC"

  local missing=""
  if ! command -v docker >/dev/null 2>&1; then
    missing="${missing}  • Docker (https://docs.docker.com/get-docker/)\n"
  elif ! docker compose version >/dev/null 2>&1; then
    missing="${missing}  • Docker Compose V2 plugin (https://docs.docker.com/compose/install/)\n"
  fi
  command -v curl >/dev/null 2>&1 || missing="${missing}  • curl\n"

  if [ -n "$missing" ]; then
    printf '\n%bMissing required tools:%b\n' "$BOLD" "$NC"
    printf '%b' "$missing"
    printf '\nInstall the tool(s) above, then re-run this installer.\n\n'
    exit 1
  fi

  ok "Docker:  $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo unknown)"
  ok "Compose: $(docker compose version --short 2>/dev/null || echo unknown)"
}

check_selinux() {
  if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
    SELINUX_SUFFIX=":Z"
    warn "SELinux Enforcing detected. Applying :Z to bind mounts."
  fi
}

check_ports() {
  [ -n "$NOCO_SKIP_PREFLIGHT" ] && return 0
  [ "$MODE" = "production" ] || return 0
  for port in 80 443; do
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      warn "Port $port is in use. Free it before continuing or Traefik will fail to bind."
    fi
  done
}

check_existing() {
  if [ -f "$WORK_DIR/docker-compose.yml" ]; then
    warn "Existing configuration found at $WORK_DIR/"
    if [ "$NON_INTERACTIVE" -eq 0 ]; then
      printf '  Overwrite? [y/N] '
      read -r confirm </dev/tty
      [[ "$confirm" =~ ^[Yy] ]] || { info "Aborted."; exit 0; }
    fi
  fi
}

# ── Prompts ───────────────────────────────────────────────────────────────────
collect_domain() {
  [ -n "$DOMAIN" ] && return 0
  [ "$NON_INTERACTIVE" -eq 1 ] && return 0
  header "Domain"
  info "Enter the domain or IP for this NocoDB instance."
  info "Leave blank for local mode (http://localhost:8080, no SSL)."

  local pub_ip; pub_ip="$(get_public_ip)"
  ask "Domain or IP" "${pub_ip:-localhost}"
  DOMAIN="$REPLY"
}

determine_mode() {
  if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
    MODE="local"
    ok "Mode: Local (port 8080, no SSL)"
  elif is_valid_domain "$DOMAIN"; then
    MODE="production"
    ok "Mode: Production (Traefik + Let's Encrypt)"
  else
    MODE="production-ip"
    warn "Mode: Production via IP ($DOMAIN). SSL not available."
  fi
}

collect_pg() {
  [ -n "$PG_MODE" ] && return 0
  header "Postgres"
  info "Either provide an existing Postgres or let us run it."
  pick "Bundled  $(printf '%b(we run it for you)%b' "$DIM" "$NC")" \
       "Existing $(printf '%b(you provide host + credentials)%b' "$DIM" "$NC")"
  case "$REPLY" in
    1)
      PG_MODE="bundled"
      PG_USER="nocodb"
      PG_PASSWORD="$(generate_password)"
      ok "Bundled Postgres. Auto-generated password."
      ;;
    2)
      PG_MODE="external"
      ask "Host"; PG_HOST="$REPLY"
      ask "Port" "5432"; PG_PORT="$REPLY"
      ask "Database" "nocodb"; PG_DATABASE="$REPLY"
      ask "Username"; PG_USER="$REPLY"
      ask_secret "Password"; PG_PASSWORD="$REPLY"
      [ -n "$PG_HOST" ] && [ -n "$PG_USER" ] && [ -n "$PG_PASSWORD" ] \
        || fail "Host, username, and password are required"
      info "SSL options:"
      pick "Managed DB $(printf '%b(RDS/Azure/Cloud SQL, public CA)%b' "$DIM" "$NC")" \
           "Custom CA certificate" \
           "No SSL"
      case "$REPLY" in
        1) PG_SSL="managed" ;;
        2)
          PG_SSL="custom"
          ask "Path to CA certificate file"
          PG_CA_FILE="$REPLY"
          [ -f "$PG_CA_FILE" ] || fail "File not found: $PG_CA_FILE"
          ;;
        3) PG_SSL="none" ;;
        *) PG_SSL="managed" ;;
      esac
      ;;
    *) fail "Invalid choice" ;;
  esac
}

collect_redis() {
  [ -n "$REDIS_MODE" ] && return 0
  header "Redis"
  pick "Bundled" "Existing"
  case "$REPLY" in
    1) REDIS_MODE="bundled"; REDIS_URL="redis://redis:6379" ;;
    2)
      REDIS_MODE="external"
      ask "Redis URL" "redis://host:6379"
      REDIS_URL="$REPLY"
      ;;
    *) fail "Invalid choice" ;;
  esac
}

collect_acme_email() {
  [ "$MODE" = "production" ] || return 0
  [ -n "$ACME_EMAIL" ] && return 0
  [ "$NON_INTERACTIVE" -eq 1 ] && fail "--acme-email is required in production mode (Let's Encrypt SSL)"
  header "Let's Encrypt"
  ask "Email for SSL certificate notifications"
  ACME_EMAIL="$REPLY"
  [ -n "$ACME_EMAIL" ] || fail "ACME email is required for SSL"
}

show_summary() {
  header "Summary"
  printf '  Domain:     %b%s%b\n' "$BOLD" "$DOMAIN" "$NC"
  printf '  Mode:       %b%s%b\n' "$BOLD" "$MODE" "$NC"
  if [ "$PG_MODE" = "bundled" ]; then
    printf '  Postgres:   %bBundled%b\n' "$GREEN" "$NC"
  else
    printf '  Postgres:   %b%s:%s%b  SSL: %s\n' "$GREEN" "$PG_HOST" "$PG_PORT" "$NC" "${PG_SSL:-none}"
  fi
  if [ "$REDIS_MODE" = "bundled" ]; then
    printf '  Redis:      %bBundled%b\n' "$GREEN" "$NC"
  else
    printf '  Redis:      %bExternal%b (%s)\n' "$GREEN" "$NC" "$REDIS_URL"
  fi
  [ "$MODE" = "production" ] && printf '  ACME email: %s\n' "$ACME_EMAIL"

  if [ "$NON_INTERACTIVE" -eq 0 ]; then
    printf '\n  Proceed? [Y/n] '
    read -r confirm </dev/tty
    if [[ "$confirm" =~ ^[Nn] ]]; then
      info "Aborted."
      exit 0
    fi
  fi
}

# ── Generators ────────────────────────────────────────────────────────────────
generate_db_json() {
  mkdir -p "$WORK_DIR/nocodb"
  local ssl_block=""

  if [ "$PG_MODE" = "external" ]; then
    case "$PG_SSL" in
      managed)
        ssl_block=',
      "ssl": {
        "rejectUnauthorized": true
      }'
        ;;
      custom)
        local ca_escaped
        ca_escaped="$(json_escape "$(cat "$PG_CA_FILE")")"
        ssl_block=",
      \"ssl\": {
        \"rejectUnauthorized\": true,
        \"ca\": \"${ca_escaped}\"
      }"
        ;;
    esac
    cat > "$WORK_DIR/nocodb/db.json" <<EOF
{
  "client": "pg",
  "connection": {
    "host": "$(json_escape "$PG_HOST")",
    "port": "$(json_escape "$PG_PORT")",
    "user": "$(json_escape "$PG_USER")",
    "password": "$(json_escape "$PG_PASSWORD")",
    "database": "$(json_escape "$PG_DATABASE")"${ssl_block}
  }
}
EOF
  else
    cat > "$WORK_DIR/nocodb/db.json" <<EOF
{
  "client": "pg",
  "connection": {
    "host": "db",
    "port": "5432",
    "user": "$(json_escape "$PG_USER")",
    "password": "$(json_escape "$PG_PASSWORD")",
    "database": "$(json_escape "$PG_DATABASE")"
  }
}
EOF
  fi
  ok "nocodb/db.json"
}

generate_env() {
  # Public base URL. Required for email links (verification, invites, password reset)
  # to resolve correctly; webhooks and OAuth redirects rely on it too.
  local site_url
  case "$MODE" in
    production)    site_url="https://${DOMAIN}" ;;
    production-ip) site_url="http://${DOMAIN}" ;;
    *)             site_url="http://localhost:${HOST_PORT}" ;;
  esac

  cat > "$WORK_DIR/docker.env" <<EOF
# Database
NC_DB_JSON_FILE=/usr/app/data/db.json

# Redis
NC_REDIS_URL=${REDIS_URL}

# Public URL (email links, webhooks, OAuth redirects)
NC_SITE_URL=${site_url}

# Settings
NC_SECURE_ATTACHMENTS=true
NC_DISABLE_MUX=true
EOF
  ok "docker.env"
}

generate_compose() {
  local f="$WORK_DIR/docker-compose.yml"

  cat > "$f" <<EOF
services:

  nocodb:
    image: nocodb/nocodb:${IMAGE_TAG}
    env_file: docker.env
    deploy:
      mode: replicated
      replicas: 1
EOF

  if [ "$PG_MODE" = "bundled" ] || [ "$REDIS_MODE" = "bundled" ]; then
    echo "    depends_on:" >> "$f"
    [ "$PG_MODE" = "bundled" ]    && cat >> "$f" <<'EOF'
      db:
        condition: service_healthy
EOF
    [ "$REDIS_MODE" = "bundled" ] && cat >> "$f" <<'EOF'
      redis:
        condition: service_healthy
EOF
  fi

  cat >> "$f" <<EOF
    restart: unless-stopped
    volumes:
      - nocodb_data:/usr/app/data
      - ./nocodb/db.json:/usr/app/data/db.json${SELINUX_SUFFIX}
    networks:
      - nocodb-network
    healthcheck:
      test: ['CMD-SHELL', 'wget -q --tries=1 --spider http://localhost:8080/api/v1/health || exit 1']
      interval: 30s
      timeout: 5s
      retries: 5
      start_period: 30s
EOF

  if [ "$MODE" = "production" ]; then
    cat >> "$f" <<EOF
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.nocodb.rule=Host(\`${DOMAIN}\`)'
      - 'traefik.http.routers.nocodb.entrypoints=websecure'
      - 'traefik.http.routers.nocodb.tls.certresolver=letsencrypt'
EOF
  elif [ "$MODE" = "production-ip" ]; then
    cat >> "$f" <<EOF
    ports:
      - '80:8080'
EOF
  else
    cat >> "$f" <<EOF
    ports:
      - '${HOST_PORT}:8080'
EOF
  fi

  cat >> "$f" <<EOF

  worker:
    image: nocodb/nocodb:${IMAGE_TAG}
    env_file: docker.env
    environment:
      NC_WORKER_CONTAINER: 'true'
    depends_on:
      nocodb:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - nocodb_data:/usr/app/data
      - ./nocodb/db.json:/usr/app/data/db.json${SELINUX_SUFFIX}
    networks:
      - nocodb-network
EOF

  if [ "$PG_MODE" = "bundled" ]; then
    cat >> "$f" <<EOF

  db:
    image: postgres:17.10
    environment:
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: ${PG_DATABASE}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${PG_USER} -d ${PG_DATABASE}']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nocodb-network
EOF
  fi

  if [ "$REDIS_MODE" = "bundled" ]; then
    cat >> "$f" <<EOF

  redis:
    image: redis:7
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nocodb-network
EOF
  fi

  if [ "$MODE" = "production" ]; then
    cat >> "$f" <<EOF

  traefik:
    image: traefik:v3.6
    command:
      - '--providers.docker=true'
      - '--providers.docker.exposedbydefault=false'
      - '--entryPoints.web.address=:80'
      - '--entryPoints.websecure.address=:443'
      - '--entryPoints.web.http.redirections.entryPoint.to=websecure'
      - '--entryPoints.web.http.redirections.entryPoint.scheme=https'
      - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'
      - '--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}'
      - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt${SELINUX_SUFFIX}
    restart: unless-stopped
    networks:
      - nocodb-network
EOF
  fi

  cat >> "$f" <<'EOF'

networks:
  nocodb-network:
    driver: bridge

volumes:
  nocodb_data:
EOF
  [ "$PG_MODE" = "bundled" ]    && echo "  postgres_data:" >> "$f"
  [ "$REDIS_MODE" = "bundled" ] && echo "  redis_data:" >> "$f"

  ok "docker-compose.yml"
}

generate_update_script() {
  cat > "$WORK_DIR/update.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "Pulling latest images..."
docker compose pull
echo "Restarting services..."
docker compose up -d
echo "Cleaning up old images..."
docker image prune -f
echo "Done."
EOF
  chmod +x "$WORK_DIR/update.sh"
  ok "update.sh"
}

generate_gitignore() {
  # Protects secrets if the deploy dir is ever committed to a repo.
  cat > "$WORK_DIR/.gitignore" <<'EOF'
# Credentials. Never commit.
docker.env
nocodb/db.json

# Runtime data (named volumes are managed by Docker, not stored here)
letsencrypt/
nocodb/
EOF
  ok ".gitignore"
}

tighten_perms() {
  # Restrict files containing credentials to the deploy user.
  chmod 600 "$WORK_DIR/docker.env" "$WORK_DIR/nocodb/db.json" 2>/dev/null || true
}

# ── Flag parsing ──────────────────────────────────────────────────────────────
parse_flags() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --non-interactive) NON_INTERACTIVE=1 ;;
      --quick)
        NON_INTERACTIVE=1
        [ -z "$PG_MODE" ]    && PG_MODE="bundled"
        [ -z "$REDIS_MODE" ] && { REDIS_MODE="bundled"; REDIS_URL="redis://redis:6379"; }
        ;;
      --domain=*)        DOMAIN="${1#*=}"; NON_INTERACTIVE=1 ;;
      --acme-email=*)    ACME_EMAIL="${1#*=}" ;;
      --image-tag=*)     IMAGE_TAG="${1#*=}" ;;
      --pg=bundled)      PG_MODE="bundled" ;;
      --pg=external)     PG_MODE="external" ;;
      --pg-host=*)       PG_HOST="${1#*=}" ;;
      --pg-port=*)       PG_PORT="${1#*=}" ;;
      --pg-database=*)   PG_DATABASE="${1#*=}" ;;
      --pg-user=*)       PG_USER="${1#*=}" ;;
      --pg-password=*)   PG_PASSWORD="${1#*=}" ;;
      --pg-ssl=managed)  PG_SSL="managed" ;;
      --pg-ssl=none)     PG_SSL="none" ;;
      --pg-ssl=*)        PG_SSL="custom"; PG_CA_FILE="${1#*=}" ;;
      --redis=bundled)   REDIS_MODE="bundled"; REDIS_URL="redis://redis:6379" ;;
      --redis=external)  REDIS_MODE="external" ;;
      --redis-url=*)     REDIS_URL="${1#*=}" ;;
      --help|-h)
        cat <<HELP
NocoDB Auto-upstall. Interactive: run with no flags.

Common shortcuts:
  --quick                 Install with bundled Postgres + Redis, local mode (port 8080).
                          Combine with --domain= for production HTTPS.

Non-interactive flags:
  --non-interactive       Disable prompts. Fail if required values are missing.
  --domain=HOST           Domain or IP. Blank or localhost selects local mode.
                          Also enables --non-interactive.
  --acme-email=EMAIL      Let's Encrypt email. Required in production mode.
  --image-tag=TAG         Pin nocodb/nocodb image tag. Default: latest.
  --pg=bundled|external
  --pg-host=HOST          (when --pg=external)
  --pg-port=PORT
  --pg-database=NAME
  --pg-user=USER
  --pg-password=PASS
  --pg-ssl=managed|none|/path/to/ca.pem
  --redis=bundled|external
  --redis-url=URL         (when --redis=external)
HELP
        exit 0
        ;;
      upgrade|start|stop|restart|scale|monitor|status|logs|down)
        fail "'$1' is no longer a subcommand. This installer only generates the stack; manage it from the deploy dir (cd nocodb && docker compose ...), or run ./nocodb/update.sh to upgrade."
        ;;
      *) fail "Unknown flag: $1 (try --help)" ;;
    esac
    shift
  done
}

# ── Validation ────────────────────────────────────────────────────────────────
apply_bundled_defaults() {
  # Bundled Postgres needs a user + password. Fill any the operator omitted here,
  # after all flags are parsed, so flag order (e.g. --pg-password before
  # --pg=bundled) never clobbers an explicit value.
  [ "$PG_MODE" = "bundled" ] || return 0
  [ -n "$PG_USER" ]     || PG_USER="nocodb"
  [ -n "$PG_PASSWORD" ] || PG_PASSWORD="$(generate_password)"
}

validate_non_interactive() {
  [ "$NON_INTERACTIVE" -eq 1 ] || return 0

  [ -n "$PG_MODE" ] || fail "--pg=bundled or --pg=external is required in non-interactive mode"
  if [ "$PG_MODE" = "external" ]; then
    [ -n "$PG_HOST" ]     || fail "--pg-host is required when --pg=external"
    [ -n "$PG_USER" ]     || fail "--pg-user is required when --pg=external"
    [ -n "$PG_PASSWORD" ] || fail "--pg-password is required when --pg=external"
    [ -n "$PG_SSL" ]      || PG_SSL="managed"
    if [ "$PG_SSL" = "custom" ]; then
      [ -f "$PG_CA_FILE" ] || fail "CA file not found: ${PG_CA_FILE:-<unset>}. --pg-ssl must be 'managed', 'none', or a path to an existing CA certificate."
    fi
  fi

  [ -n "$REDIS_MODE" ] || fail "--redis=bundled or --redis=external is required in non-interactive mode"
  if [ "$REDIS_MODE" = "external" ]; then
    [ -n "$REDIS_URL" ] || fail "--redis-url is required when --redis=external"
  fi

  # In non-interactive mode without --domain, default to local mode (port 8080, no SSL).
  if [ -z "$DOMAIN" ]; then
    DOMAIN=""
    MODE="local"
  fi

  # A real domain selects production (Traefik + Let's Encrypt), which needs an email.
  if [ -n "$DOMAIN" ] && is_valid_domain "$DOMAIN" && [ -z "$ACME_EMAIL" ]; then
    fail "--acme-email is required when --domain is a domain name (production SSL)"
  fi
}

# ── Run ───────────────────────────────────────────────────────────────────────
# Fail fast when prompts are needed but no terminal is attached (e.g. a bare
# `curl ... | bash` in a non-interactive context). Interactive prompts read from
# /dev/tty, so a piped install still works as long as a terminal is present.
require_tty() {
  [ "$NON_INTERACTIVE" -eq 1 ] && return 0
  if ! { true >/dev/tty; } 2>/dev/null; then
    fail "No terminal available for interactive prompts. Re-run with flags, e.g.: curl -fsSL https://install.nocodb.com/noco.sh | bash -s -- --quick"
  fi
}

# Bring the stack up. Skipped under NOCO_SKIP_PREFLIGHT (tests and config-only re-runs).
start_stack() {
  [ -n "$NOCO_SKIP_PREFLIGHT" ] && return 0
  header "Starting NocoDB"
  info "Pulling images and starting containers (first run can take a few minutes)…"
  if ( cd "$WORK_DIR" && docker compose up -d ); then
    STACK_STARTED=1
  else
    fail "Configuration is ready, but 'docker compose up -d' failed. Fix the issue above, then run: cd $WORK_DIR && docker compose up -d"
  fi
}

# ── Display ───────────────────────────────────────────────────────────────────
display_completion() {
  echo
  printf '%b═══════════════════════════════════════════%b\n' "$DIM" "$NC"
  printf '  %bDone.%b\n\n' "$BOLD" "$NC"

  if [ "$STACK_STARTED" -eq 1 ]; then
    if [ "$MODE" = "production" ]; then
      printf '  %bNocoDB is starting at:%b https://%s\n' "$GREEN" "$NC" "$DOMAIN"
      printf '    The TLS certificate can take a minute to issue on first run.\n\n'
    elif [ "$MODE" = "production-ip" ]; then
      printf '  %bNocoDB is starting at:%b http://%s%b (plaintext, no SSL)%b\n\n' "$GREEN" "$NC" "$DOMAIN" "$YELLOW" "$NC"
    else
      printf '  %bNocoDB is starting at:%b http://localhost:%s\n\n' "$GREEN" "$NC" "$HOST_PORT"
    fi
    printf '  %bManage the stack:%b\n' "$BOLD" "$NC"
    printf '    cd %s\n' "$WORK_DIR"
    printf '    docker compose logs -f nocodb   # follow startup logs\n'
    printf '    docker compose ps               # container status\n'
    printf '    docker compose down             # stop (keeps data)\n\n'
  else
    printf '  Files generated in: %s/\n' "$WORK_DIR"
    printf '    docker-compose.yml, docker.env, nocodb/db.json, update.sh, .gitignore\n\n'
    printf '  %bStart it:%b\n' "$BOLD" "$NC"
    printf '    cd %s\n' "$WORK_DIR"
    printf '    docker compose up -d\n'
    printf '    docker compose logs -f nocodb\n\n'
    if [ "$MODE" = "production" ]; then
      printf '  %bNocoDB will be available at:%b https://%s\n\n' "$GREEN" "$NC" "$DOMAIN"
    elif [ "$MODE" = "production-ip" ]; then
      printf '  %bNocoDB will be available at:%b http://%s%b (plaintext, no SSL)%b\n\n' "$GREEN" "$NC" "$DOMAIN" "$YELLOW" "$NC"
    else
      printf '  %bNocoDB will be available at:%b http://localhost:%s\n\n' "$GREEN" "$NC" "$HOST_PORT"
    fi
  fi

  printf '  %bActivate your license:%b open NocoDB → Admin Panel → License → paste your key\n\n' "$BOLD" "$NC"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  parse_flags "$@"
  apply_bundled_defaults
  validate_non_interactive
  require_tty
  check_prereqs
  check_selinux
  check_existing
  collect_domain
  determine_mode
  check_ports
  collect_pg
  collect_redis
  collect_acme_email
  show_summary

  echo
  mkdir -p "$WORK_DIR"
  generate_db_json
  generate_env
  generate_compose
  generate_update_script
  generate_gitignore
  tighten_perms

  start_stack
  display_completion
}

main "$@"
