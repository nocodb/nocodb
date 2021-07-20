#!/bin/sh

FILE="/usr/src/app/package.json"

if [ ! -f "$FILE" ]
then
  tar -xzf /usr/src/appEntry/app.tar.gz -C /usr/src/app/
fi

node docker/main.js