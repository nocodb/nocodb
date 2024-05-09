#!/bin/sh

if [[ -f /usr/src/appEntry/configure.sh ]]; then
  . /usr/src/appEntry/configure.sh
fi

#sleep 5

if [ ! -z "${NC_TOOL_DIR}"  ]; then
  mkdir -p $NC_TOOL_DIR
fi

node docker/index.js
