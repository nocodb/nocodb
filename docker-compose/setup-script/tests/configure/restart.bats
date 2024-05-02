#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME



setup() {
  cd "${WORKING_DIR}/configure" || exit 1
  ./setup.sh "setup"
}

teardown() {
  cd "${WORKING_DIR}/configure" || exit 1
  ./setup.sh
}

@test "Check Redis, WatchTower and NocoDB are restarted" {
    ../expects/configure/restart.sh

    cd "${NOCO_HOME}" || exit 1

    # Verify container is running
    docker compose ps | grep -q 'redis'
    docker compose ps | grep -q 'watchtower'
    docker compose ps | grep -q 'nocodb'
}
