#!/bin/bash
# docker-compose start 
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

COMPONENT_DIR=${SCRIPT_DIR}/../
cd ${COMPONENT_DIR}
docker-compose up -d 