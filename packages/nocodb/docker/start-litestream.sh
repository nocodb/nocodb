#!/bin/sh

#sleep 5

if [ -n "${NC_TOOL_DIR}" ]; then
  mkdir -p "$NC_TOOL_DIR"
fi

if [ -n "${AWS_ACCESS_KEY_ID}" ] && [ -n "${AWS_SECRET_ACCESS_KEY}" ] && [ -n "${AWS_BUCKET}" ] && [ -n "${AWS_BUCKET_PATH}" ]; then

  if [ -f "${NC_TOOL_DIR}noco.db" ]
  then
    rm "${NC_TOOL_DIR}noco.db"
    rm "${NC_TOOL_DIR}noco.db-shm"
    rm "${NC_TOOL_DIR}noco.db-wal"
  fi

  litestream restore -o "${NC_TOOL_DIR}noco.db" "s3://$AWS_BUCKET/$AWS_BUCKET_PATH"
  if [ ! -f "${NC_TOOL_DIR}noco.db" ]
  then
    touch "${NC_TOOL_DIR}noco.db"
  fi
  litestream replicate "${NC_TOOL_DIR}noco.db" "s3://$AWS_BUCKET/$AWS_BUCKET_PATH" &
fi

node docker/main.js
