#!/bin/bash
# prepares env file with all the required env variables.
# 

# -- main line code starts here --
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
ENV_FILE=${SCRIPT_DIR}/conf/nc_properties.env
bkp_file=${ENV_FILE}-$(date +%s).bak
# Source existing nc_envs.env file to get current values
if [ -f ${ENV_FILE} ]; then
    source ${ENV_FILE}
    echo "backing up previous ${ENV_FILE} file to ${bkp_file}"
    cp ${ENV_FILE} ${bkp_file}
fi

# Array of properties with default values
properties=("NC_INSTALL_ROOT=${SCRIPT_DIR}" "MINIO_ROOT_USER=minioadmin" "MINIO_ROOT_PASSWORD=minioadmin" "POSTGRES_USER=postgres" "POSTGRES_PASSWORD=test123" "POSTGRES_DB=nocodb" "NC_REDIS_URL=redis://redis:6379/4" 'NC_DB=pg://postgres:5432?u=postgres&password=${POSTGRES_PASSWORD:-nocodb}&d=postgres' "NO_COLOR=NEST_JS_LOG_MESSAGE_NO_COLOR_SET_NON_NULL_VALUE" "LOKI_ENDPOINT=http://localhost:3100")

echo "Update or confirm the values to be set"
# Iterate over the properties array and prompt user for input
for prop in "${properties[@]}"; do
    key=$(echo "$prop" | cut -d'=' -f1)
    default_value="${prop#*=}"
    prev_value_or_default=${!key:-${default_value}}
    
    read -p "Enter value for $key (default: ${prev_value_or_default}): " user_input

    # Use user input or default value if empty
    value=${user_input:-$prev_value_or_default}

    # Store key-value pair in a variable
    userValues="${userValues}${key}=${value}\n"
done

# Write key-value pairs to nc_envs.env file
echo -e "# Environment Variables\n$userValues" > ${ENV_FILE}

echo "Environment variables written to ${ENV_FILE} file."

echo "creating data conf, data and log directories"
mkdir -p ${INSTALL_ROOT}/conf ${INSTALL_ROOT}/data ${INSTALL_ROOT}/logs
