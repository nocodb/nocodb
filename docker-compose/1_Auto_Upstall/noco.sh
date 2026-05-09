#!/usr/bin/env bash
#
# NocoDB — Auto-upstall installer
# Single image (community + enterprise). License is activated post-install via Admin Panel.
#
set -euo pipefail

if [ "${1:-}" = "--debug" ]; then
  set -x
  shift
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_DIR="${PWD}/nocodb"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ── State (set by prompts or flags) ───────────────────────────────────────────
DOMAIN=""
MODE=""              # local | production | production-ip
ACME_EMAIL=""
PG_MODE=""           # bundled | external
PG_HOST="db"
PG_PORT="5432"
PG_DATABASE="nocodb"
PG_USER="nocodb"
PG_PASSWORD=""
PG_SSL=""            # managed | none | custom
PG_CA_FILE=""
REDIS_MODE=""        # bundled | external
REDIS_URL="redis://redis:6379"
HOST_PORT="8080"
NON_INTERACTIVE=0

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
  read -r REPLY
  REPLY="${REPLY:-$default}"
}

ask_secret() {
  printf '  %s: ' "$1"
  read -rs REPLY
  echo
}

pick() {
  local i=1
  for opt in "$@"; do
    printf '  %b%d%b) %s\n' "$BOLD" "$i" "$NC" "$opt"
    ((i++))
  done
  printf '  > '
  read -r REPLY
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

# ── OS guard ──────────────────────────────────────────────────────────────────
check_os() {
  case "$(uname -s)" in
    Linux) ;;
    Darwin)
      printf '\n%bNocoDB Production install needs Linux.%b\n' "$BOLD" "$NC"
      printf '  For local evaluation on macOS, use Quickstart:\n'
      printf '    %bcurl -fsSL https://install.nocodb.com/docker-compose.yml -o docker-compose.yml%b\n' "$DIM" "$NC"
      printf '    %bdocker compose up -d%b\n\n' "$DIM" "$NC"
      printf '  Docs: https://nocodb.com/docs/self-hosting/installation/quickstart\n\n'
      exit 0
      ;;
    *)
      fail "Unsupported OS: $(uname -s). Linux required for the Production installer."
      ;;
  esac
}

# ── Prerequisites ─────────────────────────────────────────────────────────────
install_pkg() {
  local pkg="$1"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq && sudo apt-get install -y -qq "$pkg"
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y -q "$pkg"
  elif command -v yum >/dev/null 2>&1; then
    sudo yum install -y -q "$pkg"
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --quiet "$pkg"
  else
    fail "No supported package manager found; install $pkg manually and re-run."
  fi
}

check_prereqs() {
  printf '\n%bNocoDB Auto-upstall%b\n' "$BOLD" "$NC"
  printf '%b═══════════════════════════════════════════%b\n' "$DIM" "$NC"

  for tool in curl wget lsof openssl; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      warn "$tool not installed; attempting to install"
      install_pkg "$tool"
    fi
  done

  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker not installed; installing via get.docker.com"
    wget -qO- https://get.docker.com/ | sh
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose V2 is required (run: docker compose version)"
  fi

  ok "Docker:  $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo unknown)"
  ok "Compose: $(docker compose version --short 2>/dev/null || echo unknown)"
}

check_ports() {
  [ "$MODE" = "production" ] || return 0
  for port in 80 443; do
    if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      warn "Port $port is in use — Traefik will fail to bind. Free it before continuing."
    fi
  done
}

check_existing() {
  if [ -f "$WORK_DIR/docker-compose.yml" ]; then
    warn "Existing configuration found at $WORK_DIR/"
    if [ "$NON_INTERACTIVE" -eq 0 ]; then
      printf '  Overwrite? [y/N] '
      read -r confirm
      [[ "$confirm" =~ ^[Yy] ]] || { info "Aborted."; exit 0; }
    fi
  fi
}

# ── Prompts ───────────────────────────────────────────────────────────────────
collect_domain() {
  [ -n "$DOMAIN" ] && return 0
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
    warn "Mode: Production via IP ($DOMAIN) — SSL not available"
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
      PG_PASSWORD="$(generate_password)"
      ok "Bundled Postgres — auto-generated password"
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
      pick "Managed DB $(printf '%b(RDS/Azure/Cloud SQL — public CA)%b' "$DIM" "$NC")" \
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
    read -r confirm
    [[ "$confirm" =~ ^[Nn] ]] && { info "Aborted."; exit 0; }
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
  cat > "$WORK_DIR/docker.env" <<EOF
# Database
NC_DB_JSON_FILE=/usr/app/data/db.json

# Redis
NC_REDIS_URL=${REDIS_URL}

# Settings
NC_ALLOW_LOCAL_EXTERNAL_DBS=true
NC_SECURE_ATTACHMENTS=true
NC_DISABLE_MUX=true
EOF
  ok "docker.env"
}

generate_compose() {
  local f="$WORK_DIR/docker-compose.yml"

  cat > "$f" <<'EOF'
services:

  nocodb:
    image: nocodb/nocodb:latest
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

  cat >> "$f" <<'EOF'
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    networks:
      - nocodb-network
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

  cat >> "$f" <<'EOF'

  worker:
    image: nocodb/nocodb:latest
    env_file: docker.env
    environment:
      NC_WORKER_CONTAINER: 'true'
    depends_on:
      - nocodb
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    networks:
      - nocodb-network
EOF

  if [ "$PG_MODE" = "bundled" ]; then
    cat >> "$f" <<EOF

  db:
    image: postgres:16.6
    environment:
      POSTGRES_USER: ${PG_USER}
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: ${PG_DATABASE}
    volumes:
      - ./postgres:/var/lib/postgresql/data
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
    cat >> "$f" <<'EOF'

  redis:
    image: redis:7
    volumes:
      - ./redis:/data
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
      - ./letsencrypt:/letsencrypt
    restart: unless-stopped
    networks:
      - nocodb-network
EOF
  fi

  cat >> "$f" <<'EOF'

networks:
  nocodb-network:
    driver: bridge
EOF

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

# ── Flag parsing ──────────────────────────────────────────────────────────────
parse_flags() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --domain=*)        DOMAIN="${1#*=}"; NON_INTERACTIVE=1 ;;
      --acme-email=*)    ACME_EMAIL="${1#*=}" ;;
      --pg=bundled)      PG_MODE="bundled"; PG_PASSWORD="$(generate_password)" ;;
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
NocoDB Auto-upstall — interactive: just run with no flags.

Non-interactive flags:
  --domain=HOST           Domain or IP (blank/localhost = local mode)
  --acme-email=EMAIL      Let's Encrypt email (production mode only)
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
      *) fail "Unknown flag: $1 (try --help)" ;;
    esac
    shift
  done
}

# ── Validation ────────────────────────────────────────────────────────────────
validate_non_interactive() {
  [ "$NON_INTERACTIVE" -eq 1 ] || return 0

  [ -n "$PG_MODE" ] || fail "--pg=bundled or --pg=external is required in non-interactive mode"
  if [ "$PG_MODE" = "external" ]; then
    [ -n "$PG_HOST" ]     || fail "--pg-host is required when --pg=external"
    [ -n "$PG_USER" ]     || fail "--pg-user is required when --pg=external"
    [ -n "$PG_PASSWORD" ] || fail "--pg-password is required when --pg=external"
    [ -n "$PG_SSL" ]      || PG_SSL="managed"
  fi

  [ -n "$REDIS_MODE" ] || fail "--redis=bundled or --redis=external is required in non-interactive mode"
  if [ "$REDIS_MODE" = "external" ]; then
    [ -n "$REDIS_URL" ] || fail "--redis-url is required when --redis=external"
  fi
}

# ── Display ───────────────────────────────────────────────────────────────────
display_completion() {
  echo
  printf '%b═══════════════════════════════════════════%b\n' "$DIM" "$NC"
  printf '  %bDone.%b\n\n' "$BOLD" "$NC"
  printf '  Files generated in: %s/\n' "$WORK_DIR"
  printf '    docker-compose.yml, docker.env, nocodb/db.json, update.sh\n\n'
  printf '  %bNext:%b\n' "$BOLD" "$NC"
  printf '    cd %s\n' "$WORK_DIR"
  printf '    docker compose up -d\n'
  printf '    docker compose logs -f nocodb\n\n'
  if [ "$MODE" = "production" ]; then
    printf '  %bNocoDB will be available at:%b https://%s\n\n' "$GREEN" "$NC" "$DOMAIN"
  elif [ "$MODE" = "production-ip" ]; then
    printf '  %bNocoDB will be available at:%b http://%s\n\n' "$GREEN" "$NC" "$DOMAIN"
  else
    printf '  %bNocoDB will be available at:%b http://localhost:%s\n\n' "$GREEN" "$NC" "$HOST_PORT"
  fi
  printf '  %bActivate your license:%b open NocoDB → Admin Panel → License → paste your key\n\n' "$BOLD" "$NC"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  parse_flags "$@"
  validate_non_interactive
  check_os
  check_prereqs
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

  display_completion
}

main "$@"
