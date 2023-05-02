#!/bin/sh
 
# checks if file exists in the passed argument 
# and sources file if it exists
do_source(){
  local env_file=$1
  if [[ -f ${env_file} ]]
  then
    echo "Sourcing env_file: ${env_file}"
    source ${env_file}
  else
    echo "Skip sourcing ${env_file} as file does not exists"  
  fi
}

# find the workspace name with an assumption that 
# workspace is running in ECS service where
# ECS service name is workspace name. 
# or if not ECS service return WS_NAME env variable set
get_ws_name(){
  # Find the cluster(ecs service-name) where this container is running
  if [[ ${ECS_CONTAINER_METADATA_URI_V4} ]]
  then
    echo "$(curl ${ECS_CONTAINER_METADATA_URI_V4}/task | jq -r .ServiceName)"
  else
    echo ${WS_NAME}
  fi
}

CONFIG_DIR=${CONFIG_DIR:-/mnt/efs}
do_source ${CONFIG_DIR}/master_config.env
do_source ${CONFIG_DIR}/$(get_ws_name)/cluster.env
