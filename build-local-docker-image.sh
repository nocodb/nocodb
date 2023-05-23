#!/bin/bash
# script to build local docker image. 
# highlevel steps involved
# 1. build nocodb-sdk
# 2. build nc-gui
#   2a. static build of nc-gui
#   2b. copy nc-gui build to nocodb dir
# 3. build nocodb 

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
LOG_FILE=${SCRIPT_DIR}/build-local-docker-image.log
ERROR=""

function build_sdk(){
    #build nocodb-sdk    
    cd ${SCRIPT_DIR}/packages/nocodb-sdk 
    npm ci || ERROR="sdk build failed"
    npm run build || ERROR="sdk build failed"
}

function build_gui(){
    # build nc-gui
    export NODE_OPTIONS="--max_old_space_size=7128"
    # generate static build of nc-gui
    cd ${SCRIPT_DIR}/packages/nc-gui 
    npm ci || ERROR="gui build failed"
    npm run generate || ERROR="gui build failed"
}

function copy_gui_artifacts(){
     # copy nc-gui build to nocodb dir          
    rsync -rvzh --delete ./dist/ ${SCRIPT_DIR}/packages/nocodb/docker/nc-gui/ || ERROR="copy_gui_artifacts failed"
}

function package_nocodb(){
    #build nocodb
    # build nocodb ( pack nocodb-sdk and nc-gui )    
    cd ${SCRIPT_DIR}/packages/nocodb  
    npm install || ERROR="package_nocodb failed"
    EE=true ./node_modules/.bin/webpack --config webpack.local.config.js || ERROR="package_nocodb failed"
}

function build_image(){
    # build docker 
    docker build . -f Dockerfile.local -t dereknetllc/nocodb || ERROR="build_image failed"
}

function log_message(){
    if [[ ${ERROR} != "" ]]; 
    then
        >&2 echo "build failed, Please check build-local-docker-image.log for more details"
        >&2 echo "ERROR: ${ERROR}"      
        exit 1  
    else 
        echo 'docker image with tag "nocodb-local" built sussessfully. Use below sample command to run the container'
        echo 'docker run -d -p 3333:8080 --name nocodb-local nocodb-local '
    fi
}

echo "Info: Building nocodb-sdk" | tee ${LOG_FILE}
build_sdk 1>> ${LOG_FILE} 2>> ${LOG_FILE}
echo "Error: ${ERROR}"

echo "Info: Building nc-gui" | tee -a ${LOG_FILE}
build_gui  1>> ${LOG_FILE} 2>> ${LOG_FILE}
echo "Error: ${ERROR}"

echo "Info: copy nc-gui build to nocodb dir" | tee -a ${LOG_FILE}
copy_gui_artifacts 1>> ${LOG_FILE} 2>> ${LOG_FILE}
echo "Error: ${ERROR}"

echo "Info: build nocodb, package nocodb-sdk and nc-gui" | tee -a ${LOG_FILE}
package_nocodb 1>> ${LOG_FILE} 2>> ${LOG_FILE}
echo "Error: ${ERROR}"

if [[ ${ERROR} == "" ]]; then
    echo "Info: building docker image" | tee -a ${LOG_FILE}
    build_image 1>> ${LOG_FILE} 2>> ${LOG_FILE}
fi

log_message  | tee -a ${LOG_FILE}
