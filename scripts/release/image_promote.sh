#!/bin/bash
# Image promotion from staging to production 
# Adds an additional tag for a given image with STAGE_TAG with PROD_TAG
# expects aws cli to be configured 
# 
# USAGE: 
# ./image_promote.sh ws-staging ws-prod-ready  
#

STAGE_TAG=${1:-"ws-pre-release"}
PROD_TAG=${2:-"ws-prod-ready"}

NC_MANIFEST=$(aws ecr batch-get-image --region us-east-2 --repository-name nocohub --image-ids imageTag=${STAGE_TAG} --output text --query images[].imageManifest) 
aws ecr put-image --repository-name nocohub --image-tag "${PROD_TAG}" --image-manifest "${NC_MANIFEST}"