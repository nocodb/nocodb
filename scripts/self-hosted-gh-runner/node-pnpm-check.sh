#!/bin/bash
# this script is intended to run in ci/cd job
# it checks if node and pnpm is installed
# and sets github env variable to skip installation
# this is suitable for self-hosted runners with 
# docker image created from /Users/rajanishgj/Documents/GitHub/nocohub/tests/docker/Dockerfile
#

NC_REQ_NODE_V="22.12.0"
NC_REQ_PNPM_V="8.8.0"

NODE_PATH="/home/docker/actions-runner/_work/_tool/node/${NC_REQ_NODE_V}/x64/bin/node"
PNPM_PATH="/root/setup-pnpm/node_modules/.bin/pnpm"

NC_NODE_V=$($NODE_PATH -v || echo "error")
NC_PNPM_V=$($PNPM_PATH -v || echo "error") 

if [[ $NC_NODE_V == *$NC_REQ_NODE_V* ]]; then
    PATH=$PATH:$(dirname $NODE_PATH)
    SETUP_NODE=false
fi

if [[ $NC_PNPM_V == $NC_REQ_PNPM_V ]]; then
    PATH=$PATH:$(dirname $PNPM_PATH)
    SETUP_PNPM=false
fi

echo "SETUP_NODE=${SETUP_NODE:-true}" >> $GITHUB_ENV
echo "SETUP_PNPM=${SETUP_PNPM:-true}" >> $GITHUB_ENV  
echo "NC_REQ_NODE_V=${NC_REQ_NODE_V}" >> $GITHUB_ENV
echo "NC_REQ_PNPM_V=${NC_REQ_PNPM_V}" >> $GITHUB_ENV   
echo "NC_NODE_V=${NC_NODE_V}" >> $GITHUB_ENV
echo "NC_PNPM_V=${NC_PNPM_V}" >> $GITHUB_ENV                           
echo "PATH=${PATH}" >> $GITHUB_ENV
echo "completed check node and pnpm installation"