#!/bin/bash

REG_TOKEN=$REG_TOKEN

cd /home/docker/actions-runner

./config.sh --url https://github.com/nocodb/nocohub --token ${REG_TOKEN}

cleanup() {
    echo "Removing runner..."
    ./config.sh remove --unattended --token ${REG_TOKEN}
}

trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

./run.sh & wait $!