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
ECR_REPO_NAME=nocohub
PRE_REL_STAGE_TAG="ws-pre-release"
STAGE_TAG="ws-pre-release"
WORKERS_SERVICE_NAME=nocohub-noco_to_worker
EXCLUDED_SVC=" ${WORKERS_SERVICE_NAME} nocohub-service nocohub-001-prod nocohub-001-ingester nocohub-001-prod-ingester "
CLUSTER="nocodb-staging"
HOST_NAME="https://staging.noco.to"
API_CREDENTIALS=${API_CREDENTIALS}
ASG_NAME=nocohub-noco_to_main

# prewarm_asg
# function call in rollout_util.sh file
perform_rollout false true
