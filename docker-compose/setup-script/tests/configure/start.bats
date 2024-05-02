#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME

WORKING_DIR="$(pwd)"

setup() {
  cd "${WORKING_DIR}" || exit 1
  setup.sh
}

teardown() {
  cd "${WORKING_DIR}" || exit 1
  setup.sh
}

@test "Check Redis, WatchTower and NocoDB are up" {
    ../expects/configure/start.sh

    cd "${NOCO_HOME}" || exit 1

    # Verify container is running
    docker compose ps | grep -q 'redis'
    docker compose ps | grep -q 'watchtower'
    docker compose ps | grep -q 'nocodb'
}
