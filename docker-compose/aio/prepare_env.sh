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
    echo "backing up previous ${ENV_FILE} file to ${bkp_file}"
    cp ${ENV_FILE} ${bkp_file}
fi

function acceptProperty(){
    local varDetail="$1"
    prompt=$(echo "$varDetail" | cut -d '|' -f1)    
    prop=$(echo "$varDetail" | cut -d '|' -f2)
    key=$(echo "$prop" | cut -d'=' -f1)
    default_value="${prop#*=}"
    prev_value_or_default=${!key:-${default_value}}

    # echo prompt: ${prompt}
    # echo prop: ${prop}
    # echo key: ${key}
    # echo default_value: ${default_value}
    
    read -p "Enter value for $key (default: ${prev_value_or_default}): " user_input

    # Use user input or default value if empty
    value=${user_input:-$prev_value_or_default}

    # Store key-value pair in a variable
    userValues="${userValues}${key}=${value}\n"
}
# Iterate over the properties array and prompt user for input
echo basic_properties : "${basic_properties[@]}"
for multi_property_array in basic_properties invite_only_signup_priorities google_login_properties email_properties s3_attachment_properties ; do
    array_name="$multi_property_array[@]"  # Name of the array to process
    array=("${!array_name}")  
    # array=("${!multi_property_array}")   
    echo array : "${array[@]}"
    for varDetail in "${array[@]}"; do
        echo varDetail : ${varDetail}
        prompt=$(echo "$varDetail" | cut -d '|' -f1)    
        prop=$(echo "$varDetail" | cut -d '|' -f2)
        if [[ ${prompt} == "main" ]]
        then
            echo $prop
            if asksure; then 
                continue
            else
                break
            fi
        fi   
        acceptProperty "${varDetail}"
    done
done

# Write key-value pairs to nc_envs.env file
echo -e "# Environment Variables\n$userValues" > ${ENV_FILE}

echo "Environment variables written to ${ENV_FILE} file."

# echo "creating data conf, data and log directories"
# mkdir -p ${INSTALL_ROOT}/conf ${INSTALL_ROOT}/data ${INSTALL_ROOT}/logs
