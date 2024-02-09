#!/bin/bash
# expects nginx to be up and running with conf.d/certbot.conf
# dns to be mapped to the machine where cert is generated
#

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

SERVER_NAME=${1}
if [[ -z "$SERVER_NAME" ]]
then
    echo "required argument servername"
    echo "usage ex: ./gen_certs my.nocodb.com"
    exit 1
fi

echo "Creating configs for SERVER_NAME: ${SERVER_NAME}"
cd ${SCRIPT_DIR}/../conf/nginx/conf.d
sed "s,<SERVER_NAME>,${SERVER_NAME},g" ${SCRIPT_DIR}/../nginx/conf-templates/certbot_conf.template > certbot.conf

cd ${SCRIPT_DIR}/../bin
./nginx_start.sh 
./nginx_reload.sh 

echo "Triggering certbot to create ssl configs: ${SERVER_NAME}"
cd ${SCRIPT_DIR}/..
docker-compose run --rm  certbot certonly --webroot --webroot-path /var/www/certbot/  -d ${SERVER_NAME} 
result=$?

if [[ $result == 1 ]]; then
    echo "cert generation failed"
    echo "rolling back the certs and reloading nginx"    
else
    echo "Now reload nginx with new ssl configs for your site : ${SERVER_NAME}"
    cd ${SCRIPT_DIR}/../conf/nginx/conf.d
    rm -f certbot.conf 
    sed "s,<SERVER_NAME>,${SERVER_NAME},g" ${SCRIPT_DIR}/../nginx/conf-templates/ssl_server_name_conf.template > ${SERVER_NAME}.conf
fi    
rm -rf ${SCRIPT_DIR}/../conf/nginx/conf.d/certbot.conf
${SCRIPT_DIR}/../bin/nginx_reload.sh
