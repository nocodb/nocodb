#!/bin/bash
# caution: This script is for production
#
# forces ecs to relaunch the tasks/instances 
# when relaunched a new docker image will be pulled
# resulting in rolling out a software/config or just 
# restart.  
# 
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

source ${SCRIPT_DIR}/rollout_util.sh
PROMOTE_IMAGE_BEFORE_ROLLOUT="${1:-false}"
ENVIRONMENT="Production"
ECR_REPO_NAME=nocohub
PRE_REL_STAGE_TAG="ws-pre-release"
STAGE_TAG="ws"
WORKERS_SERVICE_NAME=nocohub-nocodb_ai_worker
EXCLUDED_SVC=" ${WORKERS_SERVICE_NAME} nocohub-service nocohub-001-prod nocohub-001-ingester nocohub-001-prod-ingester "
CLUSTER="nocohub-001-a"
HOST_NAME="https://app.nocodb.com"
# TODO: move this to github secrets
API_CREDENTIALS=${API_CREDENTIALS}
ASG_NAME=nocohub-nocodb_ai_main

# prewarm_asg
# function call in rollout_util.sh file
perform_rollout "${PROMOTE_IMAGE_BEFORE_ROLLOUT}"

pause_workers_and_gracefully_shutdown
