#!/bin/sh
# https://stackoverflow.com/questions/25503412/how-do-i-know-when-my-docker-mysql-container-is-up-and-mysql-is-ready-for-taking

set -e

until nc -z -v -w30 $DATABASE_HOST 3306
do
  echo "Waiting for database connection..."
  # wait for 5 seconds before check again
  sleep 5
done

echo "Mysql is up - executing command"

exec "$@"
