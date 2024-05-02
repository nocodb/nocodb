#!/bin/bash

if [ -z "$NOCO_HOME" ]; then
    NOCO_HOME="${HOME}/.nocodb"
fi

if [ -d "$NOCO_HOME" ]; then
    cd "$NOCO_HOME" || exit
    docker compose down
fi

cd /tmp || exit
rm -rf "$NOCO_HOME"

../noco.sh <<< $'\n\nN\n'

cd "$NOCO_HOME" || exit
docker compose down