#!/usr/bin/env sh
NC_DB="pg://${DB_HOST}:5432?u=${DB_USER}&p=${DB_PASSWORD}&d=${DB_NAME}"
export NC_DB
/usr/bin/dumb-init -- /usr/src/appEntry/start.sh