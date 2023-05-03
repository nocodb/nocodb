#!/bin/sh

FILE="/usr/src/app/package.json"
#sleep 5

if [ ! -z "${NC_TOOL_DIR}"  ]; then
  mkdir -p $NC_TOOL_DIR
fi

if [[ ! -z "${AWS_ACCESS_KEY_ID}" && ! -z "${AWS_SECRET_ACCESS_KEY}" && ! -z "${AWS_BUCKET}" && ! -z "${AWS_BUCKET_PATH}" ]]; then

  if [ -f "${NC_TOOL_DIR}noco.db" ]
  then
    rm "${NC_TOOL_DIR}noco.db"
    rm "${NC_TOOL_DIR}noco.db-shm"
    rm "${NC_TOOL_DIR}noco.db-wal"
  fi

  /usr/src/appEntry/litestream restore -o "${NC_TOOL_DIR}noco.db" s3://$AWS_BUCKET/$AWS_BUCKET_PATH;
  if [ ! -f "${NC_TOOL_DIR}noco.db" ]
  then
    touch "${NC_TOOL_DIR}noco.db"
  fi
  /usr/src/appEntry/litestream replicate "${NC_TOOL_DIR}noco.db" s3://$AWS_BUCKET/$AWS_BUCKET_PATH &
fi

if [ ! -f "$FILE" ]
then
  tar -xzf /usr/src/appEntry/app.tar.gz -C /usr/src/app/
fi

node docker/main.js
