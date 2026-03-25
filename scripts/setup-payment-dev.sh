#!/usr/bin/env bash
#
# NocoDB Payment Dev Environment
#
# Starts everything needed for local payment development in one command:
#   - Patches frontend to enable payment UI
#   - Launches Stripe webhook listener
#   - Starts backend with Stripe env vars
#   - Starts frontend
#   - Seeds Stripe plans once backend is ready
#   - On Ctrl+C: kills all processes and reverts patches
#
# Prerequisites:
#   - Stripe CLI installed (brew install stripe/stripe-cli/stripe)
#   - Dependencies installed (pnpm install)
#
# Usage:
#   ./scripts/setup-payment-dev.sh
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

EE_CONFIG="$ROOT_DIR/packages/nc-gui/ee/composables/useEeConfig.ts"
PAYMENT_SERVICE="$ROOT_DIR/packages/nocodb/src/ee/modules/payment/payment.service.ts"

FE_ORIGINAL='const isPaymentEnabled = computed(() => appInfo.value?.isCloud && !appInfo.value?.isOnPrem)'
FE_PATCHED='const isPaymentEnabled = computed(() => true)'

PIDS=()

cleanup() {
  echo -e "\n${CYAN}Shutting down...${NC}"

  if [[ ${#PIDS[@]} -gt 0 ]]; then
    for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
    sleep 1
    for pid in "${PIDS[@]}"; do kill -9 "$pid" 2>/dev/null || true; done
  fi

  echo -e "${CYAN}Reverting patches...${NC}"
  perl -i -pe "s/\Q${FE_PATCHED}\E/${FE_ORIGINAL}/" "$EE_CONFIG"
  perl -i -pe 's|http://localhost:3000|\${req.ncSiteUrl}|g' "$PAYMENT_SERVICE"

  echo -e "${GREEN}All done.${NC}"
}

trap cleanup SIGINT SIGTERM EXIT

echo -e "\n${BOLD}=== NocoDB Payment Dev Environment ===${NC}\n"

# --- Step 1: Patch source files ---
echo -e "${CYAN}[1/4] Patching source files...${NC}"

if grep -qF "$FE_PATCHED" "$EE_CONFIG"; then
  echo -e "${DIM}  Frontend: already patched.${NC}"
elif grep -qF "$FE_ORIGINAL" "$EE_CONFIG"; then
  perl -i -pe "s/\Q${FE_ORIGINAL}\E/${FE_PATCHED}/" "$EE_CONFIG"
  echo -e "${GREEN}  Frontend: patched.${NC}"
else
  echo -e "${RED}Could not find isPaymentEnabled line to patch. Check: $EE_CONFIG${NC}"
  exit 1
fi

perl -i -pe 's|\$\{req\.ncSiteUrl\}|http://localhost:3000|g' "$PAYMENT_SERVICE"
echo -e "${GREEN}  Backend: patched.${NC}"

# --- Step 2: Start Stripe listener ---
echo -e "${CYAN}[2/4] Starting Stripe webhook listener...${NC}"

stripe listen \
  --api-key rk_test_51QhRouHU2WPCjTxwW5E3gAERMGGR8njl2xpKNv22uy8502t0tL7aG6ZTTqBiyODZq8zIdYQRfuCc4ymEnVx0G6Q400tnSrTbRm \
  --forward-to localhost:8080/api/payment/webhook &
PIDS+=($!)
echo -e "${GREEN}Stripe listener started (PID: $!).${NC}"

# --- Step 3: Start backend and frontend ---
echo -e "${CYAN}[3/4] Starting backend and frontend...${NC}"

(
  cd "$ROOT_DIR"
  NC_STRIPE_SECRET_KEY=sk_test_51QhRouHU2WPCjTxweMUynOZZFBCuPYvvRq9uUSMCdN8O8s65XQuNotWpINQQMqxnUTpcjSXArv8vd5C4XIIsOOEW00OBPNYSah \
  NC_STRIPE_WEBHOOK_SECRET=whsec_85d32ece6231204cb9ea639a08976884cf28587e86beec0d7010b010973a13ab \
  NC_STRIPE_PUBLISHABLE_KEY=pk_test_51QhRouHU2WPCjTxw3ranXD6shPR0VbOjLflMfidsanV0m9mM0vZKQfYk3PserPAbnZAIJJhv701DV8FrwP6zJhaf00KYKhz11c \
  NC_MARKETING_ROOT_URL=https://marketing.nocodb.dev \
  NC_DB="pg://localhost:5432?u=postgres&p=password&d=ncdb_payment" pnpm --filter=nocodb watch:run:ee-cloud
) &
PIDS+=($!)
echo -e "${GREEN}Backend starting (PID: $!).${NC}"

(cd "$ROOT_DIR" && pnpm --filter=nc-gui dev:ee) &
PIDS+=($!)
echo -e "${GREEN}Frontend starting (PID: $!).${NC}"

# --- Step 4: Seed plans once backend is ready ---
echo -e "${CYAN}[4/4] Waiting for backend to be ready to seed plans...${NC}"

(
  for i in $(seq 1 60); do
    curl -sf http://localhost:8080/api/v1/health > /dev/null 2>&1 && break
    if [[ $i -eq 60 ]]; then
      echo -e "${RED}Backend did not start within 120s. Seed plans manually.${NC}"
      exit 1
    fi
    sleep 2
  done

  echo -e "${GREEN}Backend is ready! Seeding plans...${NC}"
  for product_id in prod_SaK8h4KagTQavJ prod_SaK8gzecovh0CZ prod_SeXvkoZTuwgjXd; do
    echo -e "${DIM}  Creating plan: ${product_id}${NC}"
    curl -s -o /dev/null -X POST "http://localhost:8080/api/internal/payment/plan" \
      -H "Content-Type: application/json" \
      -H "Authorization: Basic ZGVmYXVsdHVzZXJuYW1lOmRlZmF1bHRwYXNzd29yZA==" \
      -d "{\"stripe_product_id\":\"${product_id}\"}" || true
  done
  echo -e "${GREEN}Plans seeded!${NC}"
) &
PIDS+=($!)

# --- Keep running ---
echo -e "\n${BOLD}${GREEN}All services starting. Press Ctrl+C to stop everything.${NC}\n"

wait -n 2>/dev/null || true
echo -e "${YELLOW}A process exited. Press Ctrl+C to shut down all services.${NC}"
wait
