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

@test "Check NocoDB is scaled to 3 instances" {
    nproc() {
        echo 4
    }

    ../expects/configure/scale.sh

    cd "${NOCO_HOME}" || exit 1

    result=$(docker-compose ps | grep -c "nocodb/nocodb")
    [ "${result}" -eq 3 ]
}
