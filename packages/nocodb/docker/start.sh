#!/bin/sh

FILE="/usr/src/app/package.json"

if [ ! -f "$FILE" ]
then
  tar -xzf /usr/src/appEntry/app.tar.gz -C /usr/src/app/
fi

# TODO: relocate
node docker/main.js &
node .output/server/index.mjs &
wait