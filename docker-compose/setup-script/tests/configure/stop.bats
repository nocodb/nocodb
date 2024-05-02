#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME



setup() {
  cd "${WORKING_DIR}/configure" || exit 1
  ./setup.sh
}

teardown() {
  cd "${WORKING_DIR}/configure" || exit 1
  ./setup.sh
}

@test "Check all containers are down" {
    ../expects/configure/stop.sh

    cd "${NOCO_HOME}" || exit 1

    # Verify container is not running
    docker compose ps | grep -q 'redis' && exit 1
    docker compose ps | grep -q 'watchtower' && exit 1
    docker compose ps | grep -q 'nocodb' && exit 1
}
