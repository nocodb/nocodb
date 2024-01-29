#!/bin/bash
# Performs Initial setup and System Requirements Check 

## 1. validate system requirements
# a. docker, docker-compose, jq installed 
# b. port mapping check 
#   - port 80,443 are free or being used by nginx container
#   - port 8080 is open if used for multi-instance setup
#   - port 6379 for redis access
#   - port 9001 for minio access 
# c. docker repo accessiblity quay.io/minio/minio:RELEASE.2023-12-09T18-17-51Z, redis:latest, postgres:14.7, nocodb/nocodb:latest, nginx
# d. licence check (tbd)


## utility functions 
asksure() {
echo -n "Are you sure (Y/N)? "
while read -r -n 1 -s answer; do
  if [[ $answer = [YyNn] ]]; then
    [[ $answer = [Yy] ]] && retval=0
    [[ $answer = [Nn] ]] && retval=1
    break
  fi
done

echo # just a final linefeed, optics...

return $retval
}

# -- main line code starts here
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )


${SCRIPT_DIR}/pre-req-check.sh
PRE_REQ_SUCCESS=$?
if [[ ${PRE_REQ_SUCCESS} != 0 ]]
then
  echo "Few pre-requisites are failing.\n Recommend to resolve and proceed.\n However you could still proceed to install" >&2
else
  echo "All pre-requistites are taken care of. Proceed to install.." 
fi  

if asksure; then
    echo "Preparing environment file before install.."
    ${SCRIPT_DIR}/prepare_env.sh
    echo "Installing docker containers"
    docker-compose -f ${SCRIPT_DIR}/docker-compose.yml up -d
  else
    echo "Exiting without install. You can install using docker-compose -f ${SCRIPT_DIR}/docker-compose.yml up -d "
fi


