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
ENVIRONMENT="Prod-SQL-Executors"
PRE_REL_STAGE_TAG="ws-pre-release"
STAGE_TAG="ws"
EXCLUDED_SVC=" nocohub-service nocohub-001-prod nocohub-001-ingester nocohub-001-prod-ingester "
CLUSTER="executors-prod"
ASG_NAME=executor-services-prod
ECR_REPO_NAME="nc-sql-executor"

prewarm_asg
# function call in rollout_util.sh file
perform_rollout "${PROMOTE_IMAGE_BEFORE_ROLLOUT}"