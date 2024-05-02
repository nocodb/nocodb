#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME

WORKING_DIR="$(pwd)"

setup() {
  cd "${WORKING_DIR}" || exit 1
  ./setup.sh "setup"
}

teardown() {
  cd "${WORKING_DIR}" || exit 1
  ./setup.sh
}

@test "Check NocoDB is scaled to 3 instances" {
    ../expects/configure/scale.sh

    cd "${NOCO_HOME}" || exit 1

    result=$(docker-compose ps | grep -c "nocodb/nocodb")
    [ "${result}" -eq 3 ]
}
