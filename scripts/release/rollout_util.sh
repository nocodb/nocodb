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
	curl -s -X POST -H "Content-type: application/json" --data "{\"text\":\"${@}\"}" https://hooks.slack.com/services/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
}

function log_and_exit(){
    echo $@
    message "${ENVIRONMENT}: deployment failed. Check logs for details. ${@}"
    exit 1 
}

# expects ALL_SVS and CLUSTER variable to be set to check status
function update_workspace(){    
    if [[ ! "${CLUSTER}" || ! "${ALL_SVS}" ]]; then echo "CLUSTER and ALL_SVS variables must be set for update_workspace"; log_and_exit ; fi
    for SVC in ${ALL_SVS}
    do
        if [[ ${EXCLUDED_SVC} =~ " ${SVC} " ]]
        then
            echo "skip updating service : ${SVC}" 
        else
            DEPLOY_OUT=$(aws ecs update-service --cluster ${CLUSTER} --service ${SVC} --force-new-deployment --region=us-east-2 )
            echo "updated service : ${SVC}"
        fi
    done
}

# expects ALL_SVS and CLUSTER variable to be set to check status
function check_status_all_workspaces(){
    # start after initial sleep to avoid race
    echo "Adding initial delay of 30 sec to check status "
    sleep 30; 
    if [[ ! "${CLUSTER}" || ! "${ALL_SVS}" ]]; then echo "CLUSTER and ALL_SVS variables must be set for check status"; log_and_exit  ; fi
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
    if [[ ! "${CLUSTER}" ]]; then echo "CLUSTER and service variable must be set for check status"; log_and_exit  ; fi

    local STATUS=$(aws ecs describe-services --cluster ${CLUSTER} --service ${service} --region us-east-2 | jq .services[].deployments[].rolloutState -r)        
    echo "First Check: ECS deployment status: ${STATUS} for ${service}.Retry count: ${global_retry_count}"

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
        message "${ENVIRONMENT}: deployment status is IN_PROGRESS after waiting for about 10 mins for workspace ${service}. check status at https://us-east-2.console.aws.amazon.com/ecs/v2/clusters/${CLUSTER}/services/${service}/tasks?region=us-east-2 "
    else
        message "${ENVIRONMENT}: deployment completed successfully for workspace : ${service}"    
    fi
}

#
# checks the current count of instances
# updates it to double
# runs the check on instances with wait time of 10 seconds
function prewarm_asg(){
    if [[ ! "${ASG_NAME}" ]]; then echo "ASG_NAME variables must be set for pre-warming"; log_and_exit  ; fi
    # Get the current desired count
    prev_count=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --query 'AutoScalingGroups[0].DesiredCapacity' --output text)

    # Double the current count
    new_count=$((prev_count * 2))

    echo "${ENVIRONMENT}: prewarming initiating. previous_count: ${prev_count} new_count: ${new_count} "

    # Update the desired count to be double
    aws autoscaling set-desired-capacity --auto-scaling-group-name ${ASG_NAME} --desired-capacity $new_count

    # Wait for the new instances to launch with doubled count
    timeout=10
    while [[ $timeout -gt 0 ]]; do
        current_count=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --query 'AutoScalingGroups[0].Instances[?LifecycleState==`InService`].InstanceId' --output text | wc -w)
        
        if [[ $current_count -eq $new_count ]]; then
            break
        fi
        
        sleep 1
        ((timeout--))
    done

    message "${ENVIRONMENT}: prewarming completed successfully. previous_count: ${prev_count} new_count: ${new_count} "
}


# calls api to perform pause and exit the worker pods. the worker pods will pause and wait till any inflight jobs which are in progress
# once the instance exits, ecs takes care of adding new instance with new image 
function pause_workers_and_gracefully_shutdown(){
    echo "pause_workers_and_gracefully_shutdown: Expected varibles to be set CLUSTER=${CLUSTER} WORKERS_SERVICE_NAME=${WORKERS_SERVICE_NAME} HOST_NAME=${HOST_NAME} API_CREDENTIALS=$([[ ! -z "$API_CREDENTIALS" ]] && echo "***value-set***" || echo "Empty")"

    if [[ ! "${CLUSTER}" || ! "${WORKERS_SERVICE_NAME}" || ! "${HOST_NAME}" || ! "${API_CREDENTIALS}" ]]; then log_and_exit "CLUSTER=${CLUSTER} WORKERS_SERVICE_NAME=${WORKERS_SERVICE_NAME} HOST_NAME=${HOST_NAME} API_CREDENTIALS variables must be set" ; fi
    # 0. fetch capacity details
    # Replace these placeholders with your values
    CURRENT_DESIRED_COUNT=$(aws ecs describe-services --cluster $CLUSTER --services $WORKERS_SERVICE_NAME --query 'services[0].desiredCount' --output text)
    NEW_DESIRED_COUNT=$((CURRENT_DESIRED_COUNT + 1 ))
    HOST_NAME=${HOST_NAME:-https://staging.noco.to}

    # 1. trigger pause and exit 
    curl -u ${API_CREDENTIALS} ${HOST_NAME}/internal/workers/pause-and-exit -XPOST || exit 1

    # 2. update desired to double 
    # Update the service with the new desired count
    # aws ecs update-service --cluster $CLUSTER --service $WORKERS_SERVICE_NAME --desired-count $NEW_DESIRED_COUNT
    message "${ENVIRONMENT}: workers pod rollout triggered"
}

# calls api to perform pause so that old workers are not accepting new jobs
function pause_workers(){    
    echo "pause_workers: Expected varibles to be set CLUSTER=${CLUSTER} WORKERS_SERVICE_NAME=${WORKERS_SERVICE_NAME} HOST_NAME=${HOST_NAME} API_CREDENTIALS=$([[ ! -z "$API_CREDENTIALS" ]] && echo "***value-set***" || echo "Empty")"

    if [[ ! "${CLUSTER}" || ! "${WORKERS_SERVICE_NAME}" || ! "${HOST_NAME}" || ! "${API_CREDENTIALS}" ]]; then log_and_exit "CLUSTER=${CLUSTER} WORKERS_SERVICE_NAME=${WORKERS_SERVICE_NAME} HOST_NAME=${HOST_NAME} API_CREDENTIALS variables must be set" ; fi

    HOST_NAME=${HOST_NAME:-https://staging.noco.to}

    # 1. trigger pause
    curl -u ${API_CREDENTIALS} ${HOST_NAME}/internal/workers/pause -XPOST || exit 1

    message "${ENVIRONMENT}: workers pods paused"
}

function perform_rollout(){
    PROMOTE_IMAGE_BEFORE_ROLLOUT=${1:-false}
    if [[ ! "${ENVIRONMENT}" || ! "${CLUSTER}" ]]; then echo "CLUSTER and ENVIRONMENT variables must be set for check status"; log_and_exit  ; fi

    global_retry_count=0

    echo "${ENVIRONMENT}: deployment started."

    if [[ "${PROMOTE_IMAGE_BEFORE_ROLLOUT}" == "true" && ( "${ENVIRONMENT}" == "Production" || "${ENVIRONMENT}" == "Prod-SQL-Executors") ]]
    then    
        message "${ENVIRONMENT}: promoting ws-pre-release to ws before rollout."    
        ${SCRIPT_DIR}/image_promote.sh "${ECR_REPO_NAME}" "${PRE_REL_STAGE_TAG}" "${STAGE_TAG}"
    fi

    latest_remote_digest=$(aws ecr batch-get-image --region us-east-2 --repository-name ${REPO_NAME:-nocohub} --image-ids imageTag=${STAGE_TAG} --output text --query images[].imageId )
    message "${ENVIRONMENT}: Image with tag:${STAGE_TAG} will be launched. digest: ${latest_remote_digest}"

    # TODO: prewarm ASG to have additional instances. update only desired 
    ALL_SVS=$( aws ecs list-services --cluster ${CLUSTER}  --region=us-east-2  | jq -r '.serviceArns[] | split("/") | .[2]')
    update_workspace 
    check_status_all_workspaces 
    message "${ENVIRONMENT}: deployment executed successfully."
}