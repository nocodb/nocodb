#!/bin/sh
cd /usr/src/app/
node index.js -h $DATABASE_HOST -p $DATABASE_PASSWORD -d $DATABASE_NAME -u $DATABASE_USER -n 80 -r 0.0.0.0
