#!/bin/sh

if [ ! -d "${NC_TOOL_DIR}" ] ; then
  mkdir -p "$NC_TOOL_DIR"
fi

use_litestream() {
     [ -z "${NC_DB}" ] \
  && [ -z "${NC_DB_JSON}" ] \
  && [ -z "${NC_DB_JSON_FILE}" ] \
  && [ -z "${DATABASE_URL}" ] \
  && [ -z "${DATABASE_URL_FILE}" ] \
  && [ -z "${NC_MINIMAL_DBS}" ] \
  && [ -n "${LITESTREAM_S3_ENDPOINT}" ] \
  && [ -n "${LITESTREAM_S3_BUCKET}" ] \
  && [ -n "${LITESTREAM_ACCESS_KEY_ID}" ] \
  && [ -n "${LITESTREAM_SECRET_ACCESS_KEY}" ]
}

if use_litestream ; then

  if [ -f "${NC_TOOL_DIR}noco.db" ] ; then
    rm "${NC_TOOL_DIR}noco.db"
    rm -f "${NC_TOOL_DIR}noco.db-shm"
    rm -f "${NC_TOOL_DIR}noco.db-wal"
  fi

  litestream restore "${NC_TOOL_DIR}noco.db"

  if [ ! -f "${NC_TOOL_DIR}noco.db" ] ; then
    touch "${NC_TOOL_DIR}noco.db"
  fi

  litestream replicate &
fi

node docker/main.js
