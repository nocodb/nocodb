#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME

WORKING_DIR="$(pwd)"

setup() {
  cd "${WORKING_DIR}" || exit 1
  ./setup.sh
}

teardown() {
  cd "${WORKING_DIR}" || exit 1
  ./setup.sh
}

@test "Check Redis, WatchTower and NocoDB are up with custom ip" {
    ../expects/install/ip.sh

    cd "${NOCO_HOME}"

    # Check Docker Compose file to verify configuration
    grep -q 'redis' docker-compose.yml
    grep -q 'watchtower' docker-compose.yml
    grep -q 'nocodb' docker-compose.yml

    # Verify container is running
    docker compose ps | grep -q 'redis'
    docker compose ps | grep -q 'watchtower'
    docker compose ps | grep -q 'nocodb'
}
