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

@test "Install with IP (no SSL, production-ip mode)" {
    ../expects/install/ip.sh "1.2.3.4"

    cd "${NOCO_HOME}"

    # production-ip mode: no Traefik, port 80 binding
    ! grep -q 'image: traefik' docker-compose.yml
    grep -q "'80:8080'" docker-compose.yml

    # Compose validates
    docker compose config > /dev/null
}
