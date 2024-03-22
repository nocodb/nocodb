#!/bin/bash
# prepares env file with all the required env variables.
# 

# -- main line code starts here --
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source ${SCRIPT_DIR}/sbin/util.sh
source ${SCRIPT_DIR}/sbin/install_vars.sh

ENV_FILE=${SCRIPT_DIR}/conf/nc_properties.env
bkp_file=${ENV_FILE}-$(date +%s).bak
# Source existing nc_envs.env file to get current values
if [ -f ${ENV_FILE} ]; then
    source ${ENV_FILE}
    echo "Backing up previous ${ENV_FILE} file to ${bkp_file}"
    cp ${ENV_FILE} ${bkp_file}
fi

function trim(){
    local var="${@}"
    echo "$(sed -e 's/[[:space:]]*$//' <<<${var})"
}

function acceptProperty(){
    local varDetail="$1"
    local promptUser="${2:-true}"
    prompt=$(echo "$varDetail" | cut -d '|' -f2)    
    prop=$(echo "$varDetail" | cut -d '|' -f1)
    key=$(echo "$prop" | cut -d'=' -f1)
    default_value="${prop#*=}"
    prev_value_or_default=${!key:-${default_value}}
    
    # echo promptUser: ${promptUser}
    # echo prop: ${prop}
    # echo key: ${key}
    # echo default_value: ${default_value}
    if [[ ${promptUser} == "true" ]]; then
        read -p " || Enter value for $key (default: ${prev_value_or_default}): " user_input
    fi

    # Use user input or default value if empty
    value=$(trim ${user_input:-$prev_value_or_default})

    # Store key-value pair in a variable
    if [[ ${value} != "" ]]; then
        userValues="${userValues}${key}=${value}\n"
    fi
}
# Iterate over the properties array and prompt user for input
for multi_property_array in basic_properties invite_only_signup_priorities google_login_properties email_properties s3_attachment_properties ; do
    array_name="$multi_property_array[@]"  # Name of the array to process
    array=("${!array_name}")  
    promptUser="${1}"
    for varDetail in "${array[@]}"; do        
        promptMsg=$(echo "$varDetail" | cut -d '|' -f2)    
        prop=$(echo "$varDetail" | cut -d '|' -f1)
        if [[ ${promptUser} == "true" ]] && [[ ${prop} == "main" ]]
        then
            echo $promptMsg
            if  ! asksure; then 
                # set all defaults here          
                promptUser=false                  
            fi
            continue
        fi   
        if [[ ${prop} != "main" ]]; then
            acceptProperty "${varDetail}" "${promptUser}"
        fi
    done
done

# Write key-value pairs to nc_envs.env file
echo -e "# Environment Variables\n$userValues" > ${ENV_FILE}

echo "Environment variables written to ${ENV_FILE} file."

# echo "creating data conf, data and log directories"
# mkdir -p ${INSTALL_ROOT}/conf ${INSTALL_ROOT}/data ${INSTALL_ROOT}/logs
