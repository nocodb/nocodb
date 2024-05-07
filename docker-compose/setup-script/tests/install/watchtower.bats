#!/usr/bin/env bats

NOCO_HOME="./nocodb"
export NOCO_HOME

setup() {
  cd "${WORKING_DIR}/install" || exit 1
  ./setup.sh
}

teardown() {
    if [ -n "$SKIP_TEARDOWN" ]; then
        return
    fi

    cd "${WORKING_DIR}/install" || exit 1
    ./setup.sh
}

@test "Check WatchTower is enabled when specified" {
    ../expects/install/watchtower.sh

    cd "${NOCO_HOME}"

    # Check Docker Compose file to verify WatchTower configuration
    grep -q 'watchtower' docker-compose.yml

    # Verify WatchTower container is running
    docker compose ps | grep -q 'watchtower'
}
