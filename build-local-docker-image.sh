#!/bin/bash
# script to build local docker image. 
# highlevel steps involved
# 1. build nocodb-sdk
# 2. build nc-gui
#   2a. static build of nc-gui
#   2b. copy nc-gui build to nocodb dir
# 3. build nocodb 

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

#build nocodb-sdk
echo "Building nocodb-sdk"
cd ${SCRIPT_DIR}/packages/nocodb-sdk 
npm ci 
npm run build

# build nc-gui
echo "Building nc-gui"
export NODE_OPTIONS="--max_old_space_size=16384"
# generate static build of nc-gui
cd ${SCRIPT_DIR}/packages/nc-gui 
npm ci 
npm run generate 

# copy nc-gui build to nocodb dir 
rsync -rvzh --delete ./dist/ ${SCRIPT_DIR}/packages/nocodb/docker/nc-gui/

#build nocodb
# build nocodb ( pack nocodb-sdk and nc-gui )
cd ${SCRIPT_DIR}/packages/nocodb  
npm install 
EE=true ./node_modules/.bin/webpack --config webpack.local.config.js 
# remove nocodb-sdk since it's packed with the build
npm uninstall --save nocodb-sdk

# build docker 
docker build . -f Dockerfile.local -t nocodb-local

echo 'docker image with tag "nocodb-local" built sussessfully. Use below sample command to run the container'
echo 'docker run -d -p 3333:8080 --name nocodb-local nocodb-local '

