#!/bin/sh

#sleep 5

if [ -n "${NC_TOOL_DIR}" ]; then
  mkdir -p "$NC_TOOL_DIR"
fi

if [ -n "${LITESTREAM_S3_ENDPOINT}" ] && [ -n "${LITESTREAM_S3_BUCKET}" ] && [ -n "${LITESTREAM_ACCESS_KEY_ID}" ] && [ -n "${LITESTREAM_SECRET_ACCESS_KEY}" ] ; then

  if [ -f "${NC_TOOL_DIR}noco.db" ] ; then
    rm "${NC_TOOL_DIR}noco.db"
    rm "${NC_TOOL_DIR}noco.db-shm"
    rm "${NC_TOOL_DIR}noco.db-wal"
  fi

  litestream restore "${NC_TOOL_DIR}noco.db"

  if [ ! -f "${NC_TOOL_DIR}noco.db" ] ; then
    touch "${NC_TOOL_DIR}noco.db"
  fi

  litestream replicate &
fi

node docker/main.js
