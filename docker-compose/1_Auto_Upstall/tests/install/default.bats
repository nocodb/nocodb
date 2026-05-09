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

@test "Default install (local mode, bundled PG + bundled Redis)" {
    ../expects/install/default.sh

    cd "${NOCO_HOME}"

    # Verify compose file structure
    grep -q 'image: nocodb/nocodb:latest' docker-compose.yml
    grep -q 'image: postgres' docker-compose.yml
    grep -q 'image: redis' docker-compose.yml
    grep -q 'NC_WORKER_CONTAINER' docker-compose.yml

    # No Traefik in local mode
    ! grep -q 'traefik' docker-compose.yml

    # No removed features
    ! grep -q 'minio' docker-compose.yml
    ! grep -q 'watchtower' docker-compose.yml

    # docker-compose.yml validates
    docker compose config > /dev/null
}
