#!/bin/sh

if [ ! -d "${NC_TOOL_DIR}" ] ; then
  mkdir -p "$NC_TOOL_DIR"
fi

# ensure backwards compatibility of renamed env vars
if [ -z "${LITESTREAM_S3_ACCESS_KEY_ID}" ] && [ -n "${AWS_ACCESS_KEY_ID}" ] ; then
  export LITESTREAM_S3_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}"
fi
if [ -z "${LITESTREAM_S3_SECRET_ACCESS_KEY}" ] && [ -n "${AWS_SECRET_ACCESS_KEY}" ] ; then
  export LITESTREAM_S3_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}"
fi
if [ -z "${LITESTREAM_S3_PATH}" ] && [ -n "${AWS_BUCKET_PATH}" ] ; then
  export LITESTREAM_S3_PATH="${AWS_BUCKET_PATH}"
fi
if [ -z "${LITESTREAM_S3_BUCKET}" ] && [ -n "${AWS_BUCKET}" ] ; then
  export LITESTREAM_S3_BUCKET="${AWS_BUCKET}"
fi


use_litestream() {
     [ -z "${NC_DB}" ] \
  && [ -z "${NC_DB_JSON}" ] \
  && [ -z "${NC_DB_JSON_FILE}" ] \
  && [ -z "${DATABASE_URL}" ] \
  && [ -z "${DATABASE_URL_FILE}" ] \
  && [ -z "${NC_MINIMAL_DBS}" ] \
  && [ -n "${LITESTREAM_S3_BUCKET}" ] \
  && [ -n "${LITESTREAM_S3_ACCESS_KEY_ID}" ] \
  && [ -n "${LITESTREAM_S3_SECRET_ACCESS_KEY}" ]
}

if use_litestream ; then

  # set default bucket path if not provided
  : "${LITESTREAM_S3_PATH:=nocodb}"

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
