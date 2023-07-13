#!/bin/bash
# caution: This script is for production
# forces ecs to relaunch the tasks/instances 
# when relaunched a new docker image will be pulled
# resulting in rolling out a software/config or just 
# restart.  
# 
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

PROMOTE_READY_BEFORE_ROLLOUT=${1:-false}

if [[ "${PROMOTE_READY_BEFORE_ROLLOUT}" == "true" ]]
then    
    echo "promoting ws-pre-release to ws before rollout. TODO: add an intermediate step"    
    ${SCRIPT_DIR}/image_promote.sh "ws-pre-release" "ws"
fi
# TODO: prewarm ASG to have additional instances. update only desired 
aws ecs update-service --cluster nocohub-001-a --service nocohub-nocodb_ai_main --force-new-deployment --region=us-east-2

echo "update-service triggered. It may take 2-3 mins to complete."