---
title: 'Installation'
description: 'Simple installation - takes about three minutes!'
position: 1
category: 'Getting started'
menuTitle: 'Installation'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---

Simple installation - takes about three minutes!

## Prerequisites

- __Must haves__
    * [node.js >= 12](https://nodejs.org/en/download) / [Docker](https://www.docker.com/get-started)
    * [MySql](https://dev.mysql.com/downloads/mysql/) / [Postgres](https://www.postgresql.org/download/) / [SQLserver](https://www.microsoft.com/en-gb/sql-server/sql-server-downloads) / SQLite Database
- Nice to haves
    - Existing schemas can help to create APIs quickly.
    - An example database schema can be found <a class="grey--text" href="https://github.com/lerocha/chinook-database/tree/master/ChinookDatabase/DataSources"> <u>here</u></a>.
    
## Quick try

### 1-Click Deploy to Heroku

<a href="https://heroku.com/deploy?template=https://github.com/npgia/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>

### Node app / Docker 


<code-group>
  <code-block label="NPX" active> 

  ```bash
  npx create-nocodb-app
  ```

  </code-block>

  <code-block label="Docker" >

  ```bash
  docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
  ```

  </code-block>

  <code-block label="Using Git" >

  ```bash
  git clone https://github.com/nocodb/nocodb-seed
  cd nocodb-seed
  npm install
  npm start
  ```

  </code-block>
</code-group>  

> To persist data in docker you can mount volume at `/usr/app/data/` since 0.10.6. In older version mount at `/usr/src/app`.
        

## Development Setup

If you want to modify the source code, 

- Start the backend locally

```bash
cd packages/nocodb
npm install
npm run watch:run
```

- Start the frontend locally

```bash
cd packages/nc-gui
npm install
npm run dev
```

- Open ``localhost:3000/dashboard`` in browser

<alert>
  nocodb/packages/nocodb includes nc-lib-gui which is the built version of nc-gui hosted in npm registry. <br>
   You can visit localhost:8000/dashboard in browser after starting the backend locally if you just want to modify the backend only.
</alert>

## Production Setup 

NocoDB requires a database to store metadata of spreadsheets views and external databases. 
And connection params for this database can be specified in `NC_DB` environment variable. 

### Docker 

<code-group>
  <code-block label="MySQL" active>

  ```bash
  docker run -d -p 8080:8080 \
      -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
      -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
      nocodb/nocodb:latest
  ```
    
  </code-block> 

  <code-block label="Postgres">

  ```bash
  docker run -d -p 8080:8080 \
      -e NC_DB="pg://host:port?u=user&p=password&d=database" \
      -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
      nocodb/nocodb:latest
  ```

  </code-block> 

  <code-block label="SQL Server">

  ```bash
  docker run -d -p 8080:8080 \
      -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
      -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
      nocodb/nocodb:latest
  ```

  </code-block> 
</code-group> 

### Environment variables

| Variable                | Mandatory | Comments                                                                         | If absent                                  |
|-------------------------|-----------|----------------------------------------------------------------------------------|--------------------------------------------|
| NC_DB                   | Yes       | See our database URLs                                                            | A local SQLite will be created in root folder  |
| DATABASE_URL            | No        | JDBC URL Format. Can be used instead of NC_DB. Used in 1-Click Heroku deployment|   |
| DATABASE_URL_FILE       | No        | path to file containing JDBC URL Format. Can be used instead of NC_DB. Used in 1-Click Heroku deployment|   |
| NC_PUBLIC_URL           | Yes       | Used for sending Email invitations                   | Best guess from http request params        |
| NC_AUTH_JWT_SECRET      | Yes       | JWT secret used for auth and storing other secrets                               | A Random secret will be generated          |
| NC_SENTRY_DSN           | No        | For Sentry monitoring                                                     |   |
| NC_CONNECT_TO_EXTERNAL_DB_DISABLED | No | Disable Project creation with external database                              |   |
| NC_DISABLE_TELE | No | Disable telemetry                              |   |
| NC_BACKEND_URL | No | Custom Backend URL                              | ``http://localhost:8080`` will be used  |
| AWS_ACCESS_KEY_ID | No | For Litestream - S3 access key id               | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3  |
| AWS_SECRET_ACCESS_KEY | No | For Litestream - S3 secret access key         | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3  |
| AWS_BUCKET | No | For Litestream - S3 bucket                              | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3  |
| AWS_BUCKET_PATH | No | For Litestream - S3 bucket path (like folder within S3 bucket) | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3  |
| NC_EXPORT_MAX_TIMEOUT | No | After NC_EXPORT_MAX_TIMEOUT csv gets downloaded in batches | Default value 5000(in millisecond) will be used  |


### Docker Compose

<code-group>
  <code-block label="MySQL" active> 
  
  ```bash
  git clone https://github.com/nocodb/nocodb
  cd docker-compose
  cd mysql
  docker-compose up
  ```

  </code-block>

  <code-block label="Postgres"> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd docker-compose
  cd pg
  docker-compose up
  ```

  </code-block>
  
  <code-block label="SQL Server"> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd docker-compose
  cd mssql
  docker-compose up
  ```

  </code-block> 
</code-group> 

### AWS ECS (Fargate)

#### Create ECS Cluster

```
aws ecs create-cluster \
--cluster-name <YOUR_ECS_CLUSTER>
```

#### Create Log group

```
aws logs create-log-group \
--log-group-name /ecs/<YOUR_APP_NAME>/<YOUR_CONTAINER_NAME>
```

#### Create ECS Task Definiton

Every time you create it, it will add a new version. If it is not existing, the version will be 1. 

```bash
aws ecs register-task-definition \
--cli-input-json "file://./<YOUR_TASK_DEF_NAME>.json"
```

<alert>
This json file defines the container specification. You can define secrets such as NC_DB and environment variables here.
</alert>

Here's the sample Task Definition

```json
{
	"family": "nocodb-sample-task-def",
	"networkMode": "awsvpc",
	"containerDefinitions": [{
		"name": "<YOUR_CONTAINER_NAME>",
		"image": "nocodb/nocodb:latest",
		"essential": true,
		"logConfiguration": {
			"logDriver": "awslogs",
			"options": {
				"awslogs-group": "/ecs/<YOUR_APP_NAME>/<YOUR_CONTAINER_NAME>",
				"awslogs-region": "<YOUR_AWS_REGION>",
				"awslogs-stream-prefix": "ecs"
			}
		},
		"secrets": [{
			"name": "<YOUR_SECRETS_NAME>",
			"valueFrom": "<YOUR_SECRET_ARN>"
		}],
		"environment": [{
			"name": "<YOUR_ENV_VARIABLE_NAME>",
			"value": "<YOUR_ENV_VARIABLE_VALUE>"
		}],
		"portMappings": [{
			"containerPort": 8080,
			"hostPort": 8080,
			"protocol": "tcp"
		}]
	}],
	"requiresCompatibilities": [
		"FARGATE"
	],
	"cpu": "256",
	"memory": "512",
	"executionRoleArn": "<YOUR_ECS_EXECUTION_ROLE_ARN>",
	"taskRoleArn": "<YOUR_ECS_TASK_ROLE_ARN>"
}
```

#### Create ECS Service

```bash
aws ecs create-service \
--cluster <YOUR_ECS_CLUSTER> \
--service-name  <YOUR_SERVICE_NAME> \
--task-definition <YOUR_TASK_DEF>:<YOUR_TASK_DEF_VERSION> \
--desired-count <DESIRED_COUNT> \
--launch-type "FARGATE" \
--platform-version <VERSION> \
--health-check-grace-period-seconds <GRACE_PERIOD_IN_SECOND> \
--network-configuration "awsvpcConfiguration={subnets=["<YOUR_SUBSETS>"], securityGroups=["<YOUR_SECURITY_GROUPS>"], assignPublicIp=ENABLED}" \
--load-balancer targetGroupArn=<TARGET_GROUP_ARN>,containerName=<CONTAINER_NAME>,containerPort=<YOUR_CONTAINER_PORT>
```

<alert>
  If your service fails to start, you may check the logs in ECS console or in Cloudwatch. Generally it fails due to the connection between ECS container and NC_DB. Make sure the security groups have the correct inbound and outbound rules.  
</alert>


## Sample Demos

### Code Sandbox

<code-sandbox :src="link"></code-sandbox>

### Docker deploying with one command

<youtube id="K-UEecQyiOk"></youtube>

### Using NPX

<youtube id="v6Nn75P1p7I"></youtube>

### Heroku Deployment
<youtube id="v6Nn75P1p7I"></youtube>