#!/usr/bin/env bats



RANDOM_NUMBER=$RANDOM

setup() {
  cd "${WORKING_DIR}/install" || exit 1
  ./setup.sh
}

teardown() {
  cd "${WORKING_DIR}/install" || exit 1
  ./setup.sh
}

@test "Should create SSL certificates" {
    ../expects/install/ssl.sh "$RANDOM_NUMBER"

    curl -ksS --head "https://${RANDOM_NUMBER}.ssl.nocodb.dev" > /dev/null
}
