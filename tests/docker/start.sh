#!/bin/bash

service postgresql start && \
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'password';" && \
    sudo -u postgres psql -c "ALTER USER postgres WITH SUPERUSER;" && \
    sudo service postgresql restart

export RUNNER_ALLOW_RUNASROOT="1"

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