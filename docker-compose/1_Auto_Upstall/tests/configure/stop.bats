#!/usr/bin/env bats

NOCO_HOME="./nocodb"
export NOCO_HOME



setup() {
  cd "${WORKING_DIR}/configure" || exit 1
  ./setup.sh setup
}

teardown() {
    if [ -n "$SKIP_TEARDOWN" ]; then
        return
    fi

    cd "${WORKING_DIR}/install" || exit 1
    ./setup.sh
}

@test "Check all containers are down" {
    ../expects/configure/stop.sh

    cd "${NOCO_HOME}" || exit 1

    # Verify container is not running
    count=$(docker compose ps -q | wc -l)
    [ "$count" -eq 0 ]
}
