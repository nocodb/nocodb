#!/bin/bash
# starts the docker containers configured in this components 
# docker compose dir
#
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

COMPONENT_DIR=${SCRIPT_DIR}/../
cd ${COMPONENT_DIR}
mkdir -p ${COMPONENT_DIR}/data
chmod -R 777 ${COMPONENT_DIR}/data
docker-compose restart nginx

