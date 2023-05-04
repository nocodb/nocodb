apt-get update && apt-get install -y wget


 wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

echo "waiting for MSSQL........... "


dockerize -wait http://$DOCKER_DB_HOST:80 -wait-retry-interval 5s -timeout 20m

echo  "MSSQL is UP >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"

