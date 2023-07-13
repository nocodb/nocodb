#!/bin/bash
# caution: This script is for production
#
# forces ecs to relaunch the tasks/instances 
# when relaunched a new docker image will be pulled
# resulting in rolling out a software/config or just 
# restart.  
# 
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
# sends message to slack channel nocohub-deploy
function message(){
	echo $@
	curl -X POST -H "Content-type: application/json" --data "{\"text\":\"${@}\"}" https://hooks.slack.com/services/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
}

PROMOTE_READY_BEFORE_ROLLOUT=${1:-false}

message "Production: deployment started."

if [[ "${PROMOTE_READY_BEFORE_ROLLOUT}" == "true" ]]
then    
    message "Production: promoting ws-pre-release to ws before rollout."    
    ${SCRIPT_DIR}/image_promote.sh "ws-pre-release" "ws"
fi
STAGE_TAG="ws"
latest_remote_digest=$(aws ecr batch-get-image --region us-east-2 --repository-name nocohub --image-ids imageTag=${STAGE_TAG} --output text --query images[].imageId )
message "Production: Image with tag:ws will be launched. digest: ${latest_remote_digest}"

# TODO: prewarm ASG to have additional instances. update only desired 
aws autoscaling set-desired-capacity --region=us-east-2 --auto-scaling-group-name nocohub-nocodb_ai_main --desired-capacity 2 > /dev/null 
DEPLOY_OUT=$(aws ecs update-service --cluster nocohub-001-a --service nocohub-nocodb_ai_main --force-new-deployment --region=us-east-2 )

# check if all deployments in the service is set to COMPLETED
STATUS="IN_PROGRESS";
retry_count=0
while [[ ${retry_count} -lt 10 &&  "${STATUS}" == *"IN_PROGRESS"* ]]
do 
	STATUS=$(aws ecs describe-services --cluster nocohub-001-a --service nocohub-nocodb_ai_main --region us-east-2 | jq .services[].deployments[].rolloutState -r)    
	retry_count=$((retry_count+1)) 	
    echo "ECS deployment status: ${STATUS}. Retry after 30 seconds. Retry count: ${retry_count}"
	sleep 30; 
done

if [[ "${STATUS}" == *"IN_PROGRESS"* ]]
then
    message "Production: deployment status is IN_PROGRESS after waiting for about 5 mins. check status at https://us-east-2.console.aws.amazon.com/ecs/v2/clusters/nocohub-001-a/services/nocohub-nocodb_ai_main/tasks?region=us-east-2 "
else
    message "Production: deployment completed successfully"    
fi