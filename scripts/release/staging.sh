#!/bin/bash
# caution: This script is for staging. 
# forces ecs to relaunch the tasks/instances 
# when relaunched a new docker image will be pulled
# resulting in rolling out a software/config or just 
# restart.  
# 

# TODO: prewarm ASG to have additional instances. update only desired 
aws ecs update-service --cluster nocodb-staging --service nocohub-noco_to_main --force-new-deployment --region=us-east-2
aws ecs update-service --cluster nocodb-staging --service nocohub-wj1dqpgolupckbi --force-new-deployment --region=us-east-2
