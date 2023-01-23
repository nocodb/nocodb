# 👩‍🏫 Architecture and cloud setup (Work In Progress)
This section describes a cloud architecture on how oss version of nocodb is hosted on cloud for saas offering 
(nocohub.ai), including information about the security, deployment, operations and operations playbooks. 

## Architecture: 
### Architecture Diagram 
![nocohub-001 drawio](https://user-images.githubusercontent.com/113826417/214109795-e4118f13-02b6-4bce-a869-635a6c971ce1.png)

### Core Components 
- nocohub (an extension to nocodb with added enterprise features)
- redis (for metadata cache)
- postgres (database)

### AWS components for hosting / Cloud Setup:
we have chosen AWS as cloud provider and leverage many of the aws services in hosting saas offering. Below are some of the important services being used but not limited 
  
- ECS for scalabilty: Amazon ECS is a fully managed container orchestration service that makes it easy for you to deploy, manage, and scale containerized applications.
  - Fargate and EC2 for instances     
  - Autoscaling : asg and launch configurations
  - Network and Security : security groups   
- ECR 
- S3 

- Cloud watch for monitoring dashboards 
- Network : VPC for network isolation, AWS Application Loadbalancers and target groups for traffic control

Security: 
- AccessControl : leverage AWS VPCs and security groups to isolate access to instances and datastores. 
- Encryption : Secret Manager for persisting secure information and network traffic via SSL (certs created via SSL Manager)

Monitoring and Management: 
CloudWatch : Leverage cloud watch for monitoring our systems and below is the dashboard. 
[nocohub master dashboard](https://us-east-2.console.aws.amazon.com/cloudwatch/home?region=us-east-2#dashboards:name=nocohub-001-master-dashboard) can be used to observe the metrics of lb, ecs, redis and rds

### Deployment and Operations 
Deployment : Deployment refers to rollout of nocohub application which is hosted in ECS and requires a new docker image to be rolled out. It is expected that docker image tag RC_M.m.p is availabe in container registry. 

#### Proposed Approach for deployment
1. Register new ECS Task Definition with image url pointing to RC_M.m.p 
2. Invoke AWS Code Deploy with new task definition. 
3. Code deploy performs the canary rollout (rollback if test fails)\
TODO: 
- include rollout scripts and create trigger point an api or github action for the same
- canary tests to be implemented and rollback if tests fail
- Rollout alerts to slack channel 
- Rollback troubleshooting documentation 
- Proposal for db schema changes 

As a temporary solution, There is check if there is new image available as latest tag in ECR and when found, [aws code deploy](https://us-east-2.console.aws.amazon.com/codesuite/codedeploy/applications/nocohub-001?region=us-east-2). This script is running in EC2 instance [here](https://us-east-2.console.aws.amazon.com/ec2/home?region=us-east-2#Instances:instanceState=running;tag:Name=nocohub-001-dev;v=3;$case=tags:true%5C,client:false;$regex=tags:false%5C,client:false)

#### Operations : 
- Alerts to be configured.
- including performance metrics, 
- logging, and incident response.

### Cost Analysis: 
TODO : make a table structure and add more details
EC2 :
Currently used: t3.small 2vCPU/2gb  0.0208 USD per Hour - t3.small can run two containers 
Alternates t3.micro provides 2vCPU/1GB at half the cost (0.0104 USD per Hour) but can run only one container. 

Fargate:
pay as per use \
For 2vCPU/2GB used for entire month would cost approximately $5 (pure approxmiataion based on example 4 on [this](https://aws.amazon.com/fargate/pricing/) page)

RDS:

LB:

ElastiCache: 

Others: 

### Tools comparision: 
TODO : make a table structure and add more details
eks vs ecs vs app runner


Conclusion and Future Work: 
- Kubernetes / EKS : Kubernetes setup comes up with additional maintainance overhead but this would be ideal to maintain same setup for saas and support on-premise setup customised for customers choice of cloud.  our cloud setup and customer. Since on-prem/multi cloud is out of scope at the moment. 
- Better support for multi-single-tenant and multi-tenant to support special isolation requirements from customers (support one click setup). This would also require application level changes
  - database split read and write paths
- Explore cost effective options like 
  - fargate with ECS
  - spot instances for autoscaling

