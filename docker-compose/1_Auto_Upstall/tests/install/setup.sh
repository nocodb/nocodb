#!/bin/bash

if [ -z "$NOCO_HOME" ]; then
    NOCO_HOME="./nocodb"
fi

if [ -d "$NOCO_HOME" ]; then
    cd "$NOCO_HOME" || exit
    docker compose down
fi

rm -rf "$NOCO_HOME"
