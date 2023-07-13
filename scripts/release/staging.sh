#!/bin/bash
# caution: This script is for staging. 
# forces ecs to relaunch the tasks/instances 
# when relaunched a new docker image will be pulled
# resulting in rolling out a software/config or just 
# restart.  
# 

# sends message to slack channel nocohub-deploy
function message(){
	echo $@
	curl -X POST -H "Content-type: application/json" --data "{\"text\":\"${@}\"}" https://hooks.slack.com/services/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
}

message "Staging deployment started. Image with tag:ws-pre-release will be launched"

# prewarm ASG to have additional instances. update only desired 
aws autoscaling set-desired-capacity --region=us-east-2 --auto-scaling-group-name nocohub-nocodb_ai_main --desired-capacity 2 > /dev/null 
aws autoscaling set-desired-capacity --region=us-east-2 --auto-scaling-group-name nocohub-wj1dqpgolupckbi --desired-capacity 2 > /dev/null 

DEPLOY_OUT=$(aws ecs update-service --cluster nocodb-staging --service nocohub-noco_to_main --force-new-deployment --region=us-east-2 )
aws ecs update-service --cluster nocodb-staging --service nocohub-wj1dqpgolupckbi --force-new-deployment --region=us-east-2 > /dev/null 

# check if all deployments in the service is set to COMPLETED
STATUS="IN_PROGRESS";
retry_count=0
while [[ ${retry_count} -lt 10 &&  "${STATUS}" == *"IN_PROGRESS"* ]]
do 
	STATUS=$(aws ecs describe-services --cluster nocodb-staging --service nocohub-noco_to_main --region us-east-2 | jq .services[].deployments[].rolloutState -r)    
	retry_count=$((retry_count+1)) 	
    echo "ECS deployment status: ${STATUS}. Retry after 30 seconds. Retry count: ${retry_count}"
	sleep 30; 
done

if [[ "${STATUS}" == *"IN_PROGRESS"* ]]
then
    message "staging deployment status is IN_PROGRESS after waiting for staturation time. check status at https://us-east-2.console.aws.amazon.com/ecs/v2/clusters/nocodb-staging/services/nocohub-noco_to_main/tasks?region=us-east-2 "
else
    message "staging deployment completed successfully"    
fi