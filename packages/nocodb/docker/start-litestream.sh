#!/bin/sh

FILE="/usr/src/app/package.json"
#sleep 5


if [[ ! -z $AWS_ACCESS_KEY_ID && ! -z $AWS_SECRET_ACCESS_KEY && ! -z $AWS_BUCKET ]]; then
  /usr/src/appEntry/litestream restore -o noco.db s3://$AWS_BUCKET/noco.db;
  if [ ! -f "noco.db" ]
  then
    touch noco.db
  fi
  /usr/src/appEntry/litestream replicate noco.db s3://$AWS_BUCKET/noco.db &
fi

if [ ! -f "$FILE" ]
then
  tar -xzf /usr/src/appEntry/app.tar.gz -C /usr/src/app/
fi

DEBUG=xc* node docker/main.js