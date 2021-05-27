#!/bin/sh

FILE="/usr/src/app/package.json"
#sleep 5

if [ ! -f "$FILE" ]
then
  tar -xzf /usr/src/appEntry/app.tar.gz -C /usr/src/app/
fi

DEBUG=xc* node docker/main.js