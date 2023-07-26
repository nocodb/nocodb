#!/bin/bash
# caution: This script is for staging. 
# forces ecs to relaunch the tasks/instances 
# when relaunched a new docker image will be pulled
# resulting in rolling out a software/config or just 
# restart.  
# 

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

source ${SCRIPT_DIR}/rollout_util.sh

ENVIRONMENT="Staging"
PRE_REL_STAGE_TAG="ws-pre-release"
STAGE_TAG="ws-pre-release"
EXCLUDED_SVC=" nocohub-service nocohub-001-prod nocohub-001-ingester nocohub-001-prod-ingester "
CLUSTER="nocodb-staging"

# function call in rollout_util.sh file
perform_rollout