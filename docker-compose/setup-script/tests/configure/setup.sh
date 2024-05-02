#!/bin/bash

WORKING_DIR=$(dirname "$0")

if [ -z "$NOCO_HOME" ]; then
    NOCO_HOME="${HOME}/.nocodb"
fi

if [ -d "$NOCO_HOME" ]; then
    cd "$NOCO_HOME" || exit
    docker compose down
fi

cd "$WORKING_DIR" || exit
rm -rf "$NOCO_HOME"

if [ "$1" = "setup" ]; then
  ../../noco.sh <<< $'\n\nN\n'

  cd "$NOCO_HOME" || exit
  docker compose down
fi
