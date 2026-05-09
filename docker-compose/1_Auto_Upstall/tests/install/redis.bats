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

@test "External Redis URL is honoured" {
    ../expects/install/redis.sh

    cd "${NOCO_HOME}"

    # External Redis URL should appear in docker.env
    grep -q 'NC_REDIS_URL=redis://localhost:6379' docker.env

    # Bundled Redis service should NOT be in compose
    ! grep -q 'image: redis' docker-compose.yml

    # Compose validates
    docker compose config > /dev/null
}
