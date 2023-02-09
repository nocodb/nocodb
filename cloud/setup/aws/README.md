# nocohub-001 setup on AWS
The steps outlined below are used to set up a cloud environment on AWS. Please note that the resources used in this process are named using the keyword "nocohub-001", and the JSON files provided may not be suitable for direct use due to potential naming conflicts. These files are intended to serve as an example of the steps taken and may be useful in creating similar clusters in other regions, but additional work may be required.

## step 1: pre-requsite
- vpc with subnets,VPC endpoints and route tables, security groups 
- vpc: 172.33.16.0/20 - about 4k usable addresses; 2 route tables; 1 Internet gateway; Endpoints

- create users / roles
- container registry 
- s3 bucket for config file 
- secret manager

## step 2: loadbalancer and targets
- create loadbalancer and targets with instance type for ec2, ip type for fargate

## step 3: setup Postgres with credentials in secret manager
- postgres on rds
- configure security groups to allow only from ec-2 instance nocohub-001-ec2 security group

## step 4: setup redis on elasti cache (non cluster mode)
- elastiCache (redis)
- configure security groups to allow only from ec-2 instance nocohub-001-ec2 security group

## step 5: ec2 / asg
- create asg with autoscaling config to scale up slightly before the ecs scaling and scale down slightly later ecs scaling policy to make sure instances are available for scale-out and graceful scale-in. \
`
aws autoscaling  create-auto-scaling-group --auto-scaling-group-name nocohub-001-t3small-for-ecs --cli-input-json  file://asg.json --region us-east-2
`

## step 6: ecs 
- create cluster using UI along with asg as capacity provider (it is found that creating through cli in erroneous and instances wont come up. this needs to be followed up with aws)
[alternatively use fargate as capacity provider]
- create task definition \
`aws ecs register-task-definition --family  nocohub-001-task-definition --region us-east-2 --cli-input-json file://task_definition_ec2.json`
- create serivce with capacityProviderStrategy, CODE_DEPLOY \
`aws ecs create-service --cli-input-json file://nocohub-service.json --region us-east-2`

## step 7:  ecs application-autoscaling
- Register scalable target. Min/Max configured here \
`aws application-autoscaling register-scalable-target --cli-input-json file://scalable_target.json --region us-east-2`

- create application-autoscaling policy for the service created earlier, this step creates scaling policy \
`aws application-autoscaling put-scaling-policy --region us-east-2 --service-namespace ecs --cli-input-json file://scaling_policy.json --target-tracking-scaling-policy-configuration file://target_tracking.json `

## step 8: code deploy config (user role and permissions to be configured correctly)
- create application \
`aws deploy create-application --region=us-east-2 --cli-input-json file://cd-application.json`
- create deployment group \
`aws deploy  create-deployment-group --region us-east-2 --cli-input-json file://cd-deployment-group.json`
- create deployment, use it in script 
    ```
    AWS_APPLICATION_NAME=nocohub-001-cd
    AWS_DEPLOYMENT_GROUP_NAME=nocohub-service
    CONTAINER_NAME="nocohub"
    AWS_TASK_DEFINITION_ARN="arn:aws:ecs:us-east-2:249717198246:task-definition/nocohub-001-task-definition:3"
    APPSPEC=$(echo '{"version":1,"Resources":[{"TargetService":{"Type":"AWS::ECS::Service","Properties":{"TaskDefinition":"'${AWS_TASK_DEFINITION_ARN}'","LoadBalancerInfo":{"ContainerName":"'${CONTAINER_NAME}'","ContainerPort":8080}}}}]}' | jq -Rs .)
    REVISION='{"revisionType":"AppSpecContent","appSpecContent":{"content":'${APPSPEC}'}}'
    aws deploy create-deployment --application-name "${AWS_APPLICATION_NAME}" --deployment-group-name "${AWS_DEPLOYMENT_GROUP_NAME}" --revision "$REVISION"
    ```

## step 9: roll out a new version, begin by creating a new task definition and then proceed to run step 8 of the CodeDeploy process.
- create new task definition required for deployment (update container imgage tag) \
`aws ecs register-task-definition --family  nocohub-001-task-definition --region us-east-2 --cli-input-json file://task_definition_ec2.json`



