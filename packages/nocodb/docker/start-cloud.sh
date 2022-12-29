#!/bin/sh

FILE="/usr/src/app/package.json"
#sleep 5

if [ ! -z "${NC_TOOL_DIR}"  ]; then
  mkdir -p $NC_TOOL_DIR
fi


if [ ! -f "$FILE" ]
then
  tar -xzf /usr/src/appEntry/app.tar.gz -C /usr/src/app/
fi

node docker/index.js
