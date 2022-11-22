---
title: 'Installation'
description: 'Simple installation - takes about three minutes!'
position: 10
category: 'Getting started'
menuTitle: 'Installation'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---

Simple installation - takes about three minutes!

## Prerequisites
- [Docker](https://www.docker.com/get-started) or [Node.js](https://nodejs.org/en/download) ( > v14.x ) 
    
## Quick try

### Heroku

Before doing so, make sure you have a Heroku account. By default, an add-on Heroku Postgres will be used as meta database. You can see the connection string defined in `DATABASE_URL` by navigating to Heroku App Settings and selecting Config Vars.

<a href="https://heroku.com/deploy?template=https://github.com/nocodb/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>

### Docker

If you are a Docker user, you may try this way!

<code-group>
  <code-block label="SQLite" active>

  ```bash
  docker run -d --name nocodb \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  nocodb/nocodb:latest
  ```

  </code-block> 

  <code-block label="MySQL">

  ```bash
  docker run -d --name nocodb-mysql \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
  ```

  </code-block> 

  <code-block label="Postgres">

  ```bash
  docker run -d --name nocodb-postgres \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
  ```

  </code-block> 

  <code-block label="SQL Server">

  ```bash
  docker run -d --name nocodb-mssql \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="mssql://host.docker.internal:1433?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
  ```

  </code-block> 
</code-group> 

<alert type="success">
Tip 1: To persist data in docker you can mount volume at `/usr/app/data/` since 0.10.6. In older version mount at `/usr/src/app`. Otherwise your data will be lost after recreating the container.
</alert>

<alert type="success">
Tip 2: If you plan to input some special characters, you may need to change the character set and collation yourself when creating the database. Please check out the examples for <a href="https://github.com/nocodb/nocodb/issues/1340#issuecomment-1049481043" target="_blank">MySQL Docker</a>.
</alert>

### Docker Compose

We provide different docker-compose.yml files under <a href="https://github.com/nocodb/nocodb/tree/master/docker-compose" target="_blank">this directory</a>. Here are some examples.

<code-group>
  <code-block label="MySQL" active> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd nocodb/docker-compose/mysql
  docker-compose up -d
  ```

  </code-block>

  <code-block label="Postgres"> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd nocodb/docker-compose/pg
  docker-compose up -d
  ```

  </code-block>

  <code-block label="SQL Server"> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd nocodb/docker-compose/mssql
  docker-compose up -d
  ```

  </code-block> 
</code-group> 

<alert type="success">
Tip 1: To persist data in docker you can mount volume at `/usr/app/data/` since 0.10.6. In older version mount at `/usr/src/app`.
</alert>

<alert type="success">
Tip 2: If you plan to input some special characters, you may need to change the character set and collation yourself when creating the database. Please check out the examples for <a href="https://github.com/nocodb/nocodb/issues/1313#issuecomment-1046625974" target="_blank">MySQL Docker Compose</a>.
</alert>


### NPX

You can run below command if you need an interactive configuration.

```bash
npx create-nocodb-app
```

#### Preview: 

<img width="587" alt="image" src="https://user-images.githubusercontent.com/35857179/161526235-5ee0d592-0105-4a57-aa53-b1048dca6aad.png">



### Homebrew

```bash
brew tap nocodb/nocodb
brew install nocodb
nocodb
```

### Executables

You can download executables directly and run without any extra dependancy. Use the right command based on your platform.


##### MacOS (x64)

```bash
curl http://get.nocodb.com/macos-x64 -o nocodb -L \
  && chmod +x nocodb \
  && ./nocodb
```

##### MacOS (arm64)

```bash
curl http://get.nocodb.com/macos-arm64 -o nocodb -L \
  && chmod +x nocodb \
  && ./nocodb
```

##### Linux (x64)

```bash
curl http://get.nocodb.com/linux-x64 -o nocodb -L \
  && chmod +x nocodb \
  && ./nocodb
```
##### Linux (arm64)

```bash
curl http://get.nocodb.com/linux-arm64 -o nocodb -L \
  && chmod +x nocodb \
  && ./nocodb
```

##### Windows (x64)

```bash
iwr http://get.nocodb.com/win-x64.exe
.\Noco-win-x64.exe
```
##### Windows (arm64)

```bash
iwr http://get.nocodb.com/win-arm64.exe
.\Noco-win-arm64.exe
```

### Node Application

We provide a simple NodeJS Application for getting started.

```bash
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```


### AWS ECS (Fargate)

<details>
  <summary>Click to Expand</summary>

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
  ```

</details>

### GCP (Cloud Run)

<details>
  <summary>Click to Expand</summary>
  
  #### Pull NocoDB Image on Cloud Shell

  Since Cloud Run only supports images from Google Container Registry (GCR) or Artifact Registry, we need to pull NocoDB image, tag it and push it in GCP using Cloud Shell. Here are some sample commands which you can execute in Cloud Shell.

  ```bash
  # pull latest NocoDB image
  docker pull nocodb/nocodb:latest

  # tag the image
  docker tag nocodb/nocodb:latest gcr.io/<MY_PROJECT_ID>/nocodb/nocodb:latest

  # push the image to GCR
  docker push gcr.io/<MY_PROJECT_ID>/nocodb/nocodb:latest
  ```

  #### Deploy NocoDB on Cloud Run

  ```bash
  gcloud run deploy --image=gcr.io/<MY_PROJECT_ID>/nocodb/nocodb:latest \
                    --region=us-central1 \
                    --allow-unauthenticated \
                    --platform=managed 
  ```

</details>

### DigitalOcean (App)

<details>
  <summary>Click to Expand</summary>
  
  #### Create Apps

  On Home page, Click on Create icon & Select Apps (Deploy your code).

  ![Screenshot 2022-02-19 at 12 17 43 PM](https://user-images.githubusercontent.com/86527202/154790558-f8fe5580-5a58-412c-9c2e-145587712bf2.png)

  #### Choose Source: Docker Hub

  ![Screenshot 2022-02-19 at 12 22 01 PM](https://user-images.githubusercontent.com/86527202/154790563-b5b6d5b4-0bdc-4718-8cea-0a7ee52f283b.png)

  #### Choose Source: Repository

  Configure Source Repository as `nocodb/nocodb`. Optionally you can pick release tag if you are interested in specific NocoDB version.

  ![Screenshot 2022-02-19 at 12 23 11 PM](https://user-images.githubusercontent.com/86527202/154790564-1dcb5e33-3a57-471a-a44c-835a410a0cb7.png)

  #### [Optional] Additional Configurations

  ![Screenshot 2022-02-19 at 12 24 44 PM](https://user-images.githubusercontent.com/86527202/154790565-c0234b2e-ad50-4042-90b6-4f8798f1d585.png)

  #### Name your web service
  Pick a name for your NocoDB application. This name will become part of URL subsequently
  Pick nearest Region for cloud hosting
  ![Screenshot 2022-02-19 at 12 28 11 PM](https://user-images.githubusercontent.com/86527202/154790567-a6e65e4e-9aa0-4edb-998e-da8803ad6e23.png)

  #### Finalize and Launch

  - Select hosting plan for your NocoDB application

  - Click "Launch APP"
  
  ![Screenshot 2022-02-19 at 12 29 23 PM](https://user-images.githubusercontent.com/86527202/154790570-62044713-5cca-4d06-82ec-f3cc257218a1.png)

  Application will be build & URL will be live in a minute! The URL will be something like https://simply-nocodb-rsyir.ondigitalocean.app/

</details>

### Cloudron

<details>
  <summary>Click to Expand</summary>
  
  #### Navigate to App Store

  Log into Cloudron and select App Store

  ![image](https://user-images.githubusercontent.com/35857179/194700146-aae90503-a8fd-4bc5-8397-39f0bc279606.png)

  #### Search NocoDB

  ![image](https://user-images.githubusercontent.com/35857179/194700181-b5303919-70b8-4cf8-bebe-7e75aca601f3.png)

  #### Click Install

  ![image](https://user-images.githubusercontent.com/35857179/194700192-d702f5c2-2afa-45c5-9823-4ebe9e141b01.png)

  #### Configure NocoDB

  ![image](https://user-images.githubusercontent.com/35857179/194700230-c35e934f-bd93-4948-8f31-935483b30571.png)

  #### Go to My App and Launch NocoDB

  ![image](https://user-images.githubusercontent.com/35857179/194700464-50098cb1-bf94-42bb-a63a-cc0aad671913.png)

</details>

### CapRover

<details>
  <summary>Click to Expand</summary>

  #### Login and Click One-Click Apps / Databases 

  ![image](https://user-images.githubusercontent.com/35857179/194701420-7fe5c396-a488-456c-98de-6f2ee1151fc5.png)

  #### Search NocoDB

  ![image](https://user-images.githubusercontent.com/35857179/194701537-63e7efc5-013b-4ca9-8659-56e9d536e7d0.png)

  #### Configure NocoDB and Deploy

  ![image](https://user-images.githubusercontent.com/35857179/194701576-19519df5-2aa4-435d-8fc6-7bc684b9cfe1.png)

</details>

### Railway

<details>
  <summary>Click to Expand</summary>
  
  #### Navigate to Templates

  Go to [Templates](https://railway.app/templates), Search NocoDB and click Deploy

  ![image](https://user-images.githubusercontent.com/35857179/194702833-1bea22ee-6dfa-4024-ac27-e33fe56e5500.png)

  #### Configure NocoDB and Deploy

  ![image](https://user-images.githubusercontent.com/35857179/194702960-149393fe-b00f-4d84-9e54-22cb7616ba44.png)

</details>

### FreeBSD / FreeNAS / TrueNAS Jail

See [here](https://gist.github.com/Zamana/e9281d736f9e9ce5882c6f4b140a590e) provided by [C. R. Zamana](https://github.com/Zamana).

## Production Setup
It is mandatory to configure `NC_DB` environment variables for production usecases.  

### Environment variables

| Variable                           | Mandatory | Comments                                                                                                                | If absent                                                                                      |   |
|------------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|---|
| NC_DB                              | Yes       | See our database URLs                                                                                                   | A local SQLite will be created in root folder                                                  |   |
| NC_DB_JSON                         | Yes       | Can be used instead of `NC_DB` and value should be valid knex connection JSON                                           |                                                                                                |   |
| NC_DB_JSON_FILE                    | Yes       | Can be used instead of `NC_DB` and value should be a valid path to knex connection JSON                                 |                                                                                                |   |
| DATABASE_URL                       | No        | JDBC URL Format. Can be used instead of NC_DB. Used in 1-Click Heroku deployment                                        |                                                                                                |   |
| DATABASE_URL_FILE                  | No        | Can be used instead of DATABASE_URL: path to file containing JDBC URL Format.                                           |                                                                                                |   |
| NC_AUTH_JWT_SECRET                 | Yes       | JWT secret used for auth and storing other secrets                                                                      | A Random secret will be generated                                                              |   |
| PORT                               | No        | For setting app running port                                                                                            | `8080`                                                                                         |   |
| DB_QUERY_LIMIT_DEFAULT             | No        | Default pagination limit                                                                                                | 25                                                                                             |   |
| DB_QUERY_LIMIT_MAX                 | No        | Maximum allowed pagination limit                                                                                        | 1000                                                                                           |   |
| DB_QUERY_LIMIT_MIN                 | No        | Minimum allowed pagination limit                                                                                        | 1                                                                                              |   |
| NC_TOOL_DIR                        | No        | App directory to keep metadata and app related files                                                                    | Defaults to current working directory. In docker maps to `/usr/app/data/` for mounting volume. |   |
| NC_PUBLIC_URL                      | Yes       | Used for sending Email invitations                                                                                      | Best guess from http request params                                                            |   |
| NC_JWT_EXPIRES_IN                  | No        | JWT token expiry time                                                                                                   | `10h`                                                                                          |   |
| NC_CONNECT_TO_EXTERNAL_DB_DISABLED | No        | Disable Project creation with external database                                                                         |                                                                                                |   |
| NC_INVITE_ONLY_SIGNUP              | No        | Allow users to signup only via invite url, value should be any non-empty string.                                        |                                                                                                |   |
| NUXT_PUBLIC_NC_BACKEND_URL         | No        | Custom Backend URL                                                                                                      | ``http://localhost:8080`` will be used                                                         |   |
| NC_REQUEST_BODY_SIZE               | No        | Request body size [limit](https://expressjs.com/en/resources/middleware/body-parser.html#limit)                         | `1048576`                                                                                      |   |
| NC_EXPORT_MAX_TIMEOUT              | No        | After NC_EXPORT_MAX_TIMEOUT csv gets downloaded in batches                                                              | Default value 5000(in millisecond) will be used                                                |   |
| NC_DISABLE_TELE                    | No        | Disable telemetry                                                                                                       |                                                                                                |   |
| NC_DASHBOARD_URL                   | No        | Custom dashboard url path                                                                                               | `/dashboard`                                                                                   |   |
| NC_GOOGLE_CLIENT_ID                | No        | Google client id to enable google authentication                                                                        |                                                                                                |   |
| NC_GOOGLE_CLIENT_SECRET            | No        | Google client secret to enable google authentication                                                                    |                                                                                                |   |
| NC_MIGRATIONS_DISABLED             | No        | Disable NocoDB migration                                                                                                |                                                                                                |   |
| NC_ONE_CLICK                       | No        | Used for Heroku one-click deployment                                                                                    |                                                                                                |   |
| NC_MIN                             | No        | If set to any non-empty string the default splash screen(initial welcome animation) and matrix screensaver will disable |                                                                                                |   |
| NC_SENTRY_DSN                      | No        | For Sentry monitoring                                                                                                   |                                                                                                |   |
| NC_REDIS_URL                       | No        | Custom Redis URL. Example: `redis://:authpassword@127.0.0.1:6380/4`                                                     | Meta data will be stored in memory                                                             |   |
| NC_DISABLE_ERR_REPORT              | No        | Disable error reporting                                                                                                 |                                                                                                |   |
| NC_DISABLE_CACHE                   | No        | To be used only while debugging. On setting this to `true` - meta data be fetched from db instead of redis/cache.       | `false`                                                                                    |   |
| NC_BASEURL_INTERNAL                | No        | Used as base url for internal(server) API calls                                                                         | Default value in docker will be `http://localhost:$PORT` and in all other case it's populated from request object |   |
| AWS_ACCESS_KEY_ID                  | No        | For Litestream - S3 access key id                                                                                       | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3              |   |
| AWS_SECRET_ACCESS_KEY              | No        | For Litestream - S3 secret access key                                                                                   | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3              |   |
| AWS_BUCKET                         | No        | For Litestream - S3 bucket                                                                                              | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3              |   |
| AWS_BUCKET_PATH                    | No        | For Litestream - S3 bucket path (like folder within S3 bucket)                                                          | If Litestream is configured and NC_DB is not present. SQLite gets backed up to S3              |   |
| NC_SMTP_FROM                       | No        | For SMTP plugin - Email sender address                                                                                  |                                                                                                |   |
| NC_SMTP_HOST                       | No        | For SMTP plugin - SMTP host value                                                                                       |                                                                                                |   |
| NC_SMTP_PORT                       | No        | For SMTP plugin - SMTP port value                                                                                       |                                                                                                |   |
| NC_SMTP_USERNAME                   | No        | For SMTP plugin (Optional) - SMTP username value for authentication                                                                |                                                                                                |   |
| NC_SMTP_PASSWORD                   | No        | For SMTP plugin (Optional) - SMTP password value for authentication                                                                |                                                                                                |   |
| NC_SMTP_SECURE                     | No        | For SMTP plugin (Optional) - To enable secure set value as `true` any other value treated as false                      |                                                                                                |   |
| NC_SMTP_IGNORE_TLS                 | No        | For SMTP plugin (Optional) - To ignore tls set value as `true` any other value treated as false. For more info visit https://nodemailer.com/smtp/ |                                                                      |   |
| NC_S3_BUCKET_NAME                  | No        | For S3 storage plugin - AWS S3 bucket name                                                                              |                                                                                                |   |
| NC_S3_REGION                       | No        | For S3 storage plugin - AWS S3 region                                                                                   |                                                                                                |   |
| NC_S3_ACCESS_KEY                   | No        | For S3 storage plugin - AWS access key credential for accessing resource                                                |                                                                                                |   |
| NC_S3_ACCESS_SECRET                | No        | For S3 storage plugin - AWS access secret credential for accessing resource                                             |                                                                                                |   |
| NC_ADMIN_EMAIL                     | No        | For updating/creating super admin with provided email and password                                                      |                                                                                                |   |
| NC_ADMIN_PASSWORD                  | No        | For updating/creating super admin with provided email and password. Your password should have at least 8 letters with one uppercase, one number and one special letter(Allowed special chars <code>$&+,:;=?@#&#124;'.^*()%!_-"</code> )                                                     |                                                                                                |   |
| NODE_OPTIONS                  | No        | For passing Node.js [options](https://nodejs.org/api/cli.html#node_optionsoptions) to instance                                                     |                                                                                                |   |
| NC_MINIMAL_DBS                  | No        | Create a new SQLite file for each project. All the db files are stored in `nc_minimal_dbs` folder in current working directory. (This option restricts project creation on external sources) |  |  |

## Sample Demos

### Code Sandbox

<code-sandbox :src="link"></code-sandbox>

### Docker deploying with one command

<youtube id="K-UEecQyiOk"></youtube>

### Using NPX

<youtube id="v6Nn75P1p7I"></youtube>

### Heroku Deployment
<youtube id="WB7yYXfhocY"></youtube>
