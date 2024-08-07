#!/bin/bash
# Performs Initial setup and System Requirements Check 

## 1. validate system requirements
# a. docker, docker-compose, jq installed 
# b. port mapping check 
#   - port 80,443 are free or being used by nginx container
#   - port 8080 is open if used for multi-instance setup
#   - port 6379 for redis access
#   - port 9001 for minio access 
# c. docker repo accessiblity quay.io/minio/minio:RELEASE.2023-12-09T18-17-51Z, redis:latest, postgres:14.7, nocodb/nocodb:latest, nginx
# d. licence check (tbd)


# -- main line code starts here
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
source ${SCRIPT_DIR}/sbin/util.sh
source ${SCRIPT_DIR}/sbin/install_vars.sh
echo "** Performing nocodb system check and setup. This step may require sudo permissions"
PRE_REQ=0

# d. Check if required tools are installed
echo " | Checking if required tools (docker, docker-compose, jq, lsof) are installed..."
for tool in docker docker-compose lsof; do
  if ! command -v "$tool" &> /dev/null; then
    echo " | Error: $tool is not installed. Please install it before proceeding."
    PRE_REQ=1
  fi
done

# e. Check if NocoDB is already installed and its expected version
# echo "Checking if NocoDB is already installed and its expected version..."
# Replace the following command with the actual command to check NocoDB installation and version
# Example: nocodb_version=$(command_to_get_nocodb_version)
# echo "NocoDB version: $nocodb_install_version"

# f. Port mapping check
echo " | Checking port accessibility..."
for port in "${REQUIRED_PORTS[@]}"; do
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
    echo " | WARNING: Port $port is in use. Please make sure it is free." >&2
    PRE_REQ=1
  else
    echo " | Port $port is free."
  fi
done

# # g. Docker repository accessibility check
# echo "Checking Docker repository accessibility..."
# for image in "${DOCKER_IMAGES[@]}"; do
#   if docker pull "$image" &> /dev/null; then
#     echo "Docker image $image is accessible."
#   else
#     echo "Error: Docker image $image is not accessible. Please check the repository or internet connection."
#     PRE_REQ=1
#   fi
# done

echo "** System check completed successfully. **"
exit $PRE_REQ