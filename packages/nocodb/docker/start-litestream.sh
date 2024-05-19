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

  # enable age encryption in Litestream config if indicated
  LITESTREAM_CONFIG_PATH='/etc/litestream.yml'

  if [ -n "${LITESTREAM_AGE_PUBLIC_KEY}" ] \
  && [ -n "${LITESTREAM_AGE_SECRET_KEY}" ] \
  && ! dasel --file "${LITESTREAM_CONFIG_PATH}" --read yaml 'dbs.first().replicas.first().age' > /dev/null 2>&1 ; then
    # shellcheck disable=SC2016
    dasel put --file "${LITESTREAM_CONFIG_PATH}" \
              --read yaml \
              --type json \
              --value '{ "identities": [ "${LITESTREAM_AGE_SECRET_KEY}" ], "recipients": [ "${LITESTREAM_AGE_PUBLIC_KEY}" ] }' \
              --selector 'dbs.first().replicas.first().age'
  fi

  # remove any possible local DB leftovers
  if [ -f "${NC_TOOL_DIR}noco.db" ] ; then
    rm "${NC_TOOL_DIR}noco.db"
    rm -f "${NC_TOOL_DIR}noco.db-shm"
    rm -f "${NC_TOOL_DIR}noco.db-wal"
  fi

  # restore DB from Litestream replica
  litestream restore "${NC_TOOL_DIR}noco.db"

  # create empty DB file if no Litestream replica exists
  if [ ! -f "${NC_TOOL_DIR}noco.db" ] ; then
    touch "${NC_TOOL_DIR}noco.db"
  fi

  # start Litestream replication
  litestream replicate &
fi

# start NocoDB
node docker/main.js
