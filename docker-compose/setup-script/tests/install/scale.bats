#!/usr/bin/env bats

NOCO_HOME="${HOME}/.nocodb"
export NOCO_HOME



setup() {
  cd "${WORKING_DIR}/install" || exit 1
  ./setup.sh
}

teardown() {
  cd "${WORKING_DIR}/install" || exit 1
  ./setup.sh
}

@test "Check if two instances of NoCoDB can be run" {
    # Mock nproc to return 4
    nproc() {
        echo 4
    }

    ../expects/install/scale.sh

    cd "${NOCO_HOME}"

    # Get scale from docker compose ps
    scale=$(docker compose ps | grep -c "nocodb/nocodb")
    [ "$scale" -eq 2 ]
}
