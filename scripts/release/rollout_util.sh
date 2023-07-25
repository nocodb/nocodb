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

# expects ALL_SVS and CLUSTER variable to be set to check status
function update_workspace(){    
    if [[ ! "${CLUSTER}" || ! "${ALL_SVS}" ]]; then echo "CLUSTER and ALL_SVS variables must be set for update_workspace"; return ; fi
    for SVC in ${ALL_SVS}
    do
        if [[ ${EXCLUDED_SVC} =~ " ${SVC} " ]]
        then
            echo "skip updating service : ${SVC}" 
        else
            DEPLOY_OUT=$(aws ecs update-service --cluster ${cluster} --service ${SVC} --force-new-deployment --region=us-east-2 )
            echo "updated service : ${SVC}"
        fi
    done
}

# expects ALL_SVS and CLUSTER variable to be set to check status
function check_status_all_workspaces(){
    if [[ ! "${CLUSTER}" || ! "${ALL_SVS}" ]]; then echo "CLUSTER and ALL_SVS variables must be set for check status"; return ; fi
    for SVC in ${ALL_SVS}
    do
        if [[ ${EXCLUDED_SVC} =~ " ${SVC} " ]]
        then
            echo "skip status check for service : ${SVC}" 
        else
            checkStatus "${SVC}"
        fi
    done
}

function checkStatus(){
    # check if all deployments in the service is set to COMPLETED
    local service=${1}
    if [[ ! "${CLUSTER}" ]]; then echo "CLUSTER and service variable must be set for check status"; return ; fi

    local STATUS=$(aws ecs describe-services --cluster ${CLUSTER} --service ${service} --region us-east-2 | jq .services[].deployments[].rolloutState -r)        
    while [[ ${global_retry_count} -lt 20 &&  "${STATUS}" == *"IN_PROGRESS"* ]]
    do 
        STATUS=$(aws ecs describe-services --cluster ${CLUSTER} --service ${service} --region us-east-2 | jq .services[].deployments[].rolloutState -r)    
        global_retry_count=$((global_retry_count+1)) 	
        echo "ECS deployment status: ${STATUS} for ${service}. Retry after 30 seconds. Retry count: ${global_retry_count}"
        if [[ "${STATUS}" == *"IN_PROGRESS"* ]]; then 
            sleep 30; 
        fi
    done

    if [[ "${STATUS}" == *"IN_PROGRESS"* ]]
    then
        message "${ENVIRONMENT}: deployment status is IN_PROGRESS after waiting for about 10 mins for workspace ${service}. check status at https://us-east-2.console.aws.amazon.com/ecs/v2/clusters/${CLUSTER}/services/${svc}/tasks?region=us-east-2 "
    else
        message "${ENVIRONMENT}: deployment completed successfully for workspace : ${service}"    
    fi
}


function perform_rollout(){
    PROMOTE_READY_BEFORE_ROLLOUT=${1:-false}
    if [[ ! "${ENVIRONMENT}" || ! "${CLUSTER}" ]]; then echo "CLUSTER and ENVIRONMENT variables must be set for check status"; return ; fi

    # ENVIRONMENT="Staging"
    # PRE_REL_STAGE_TAG="ws-pre-release"
    # STAGE_TAG="ws-pre-release"
    # EXCLUDED_SVC=" nocohub-service nocohub-001-prod nocohub-001-ingester nocohub-001-prod-ingester "
    # CLUSTER="nocodb-staging"
    global_retry_count=0

    message "${ENVIRONMENT}: deployment started."

    if [[ "${PROMOTE_READY_BEFORE_ROLLOUT}" == "true" && "${ENVIRONMENT}" == "Production" ]]
    then    
        message "${ENVIRONMENT}: promoting ws-pre-release to ws before rollout."    
        ${SCRIPT_DIR}/image_promote.sh "${PRE_REL_STAGE_TAG}" "${STAGE_TAG}"
    fi

    latest_remote_digest=$(aws ecr batch-get-image --region us-east-2 --repository-name nocohub --image-ids imageTag=${STAGE_TAG} --output text --query images[].imageId )
    message "${ENVIRONMENT}: Image with tag:${STAGE_TAG} will be launched. digest: ${latest_remote_digest}"

    # TODO: prewarm ASG to have additional instances. update only desired 
    ALL_SVS=$( aws ecs list-services --cluster ${CLUSTER}  --region=us-east-2  | jq -r '.serviceArns[] | split("/") | .[2]')
    update_workspace 
    check_status_all_workspaces 
}