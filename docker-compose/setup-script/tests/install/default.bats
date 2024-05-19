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

@test "Check installation with all default options" {
    ../expects/install/default.sh

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
