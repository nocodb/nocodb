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

@test "Check Redis is enabled when specified" {
    ../expects/install/redis.sh

    cd "${NOCO_HOME}"

    # Check Docker Compose file to verify Redis configuration
    grep -q 'redis' docker-compose.yml

    # Verify Redis container is running
    docker compose ps | grep -q 'redis'
}
