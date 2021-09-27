<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ 오픈 소스 에어 테이블 대안 ✨ <br>

</h1>
<p align="center">
MySQL, PostgreSQL, SQL Server, SQLite & MariAdB를 스마트 스프레드 시트로 바꿉니다. 
</p>
<div align="center">

[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB)
[![Node version](https://badgen.net/npm/node/next)](http://nodejs.org/download/)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/NocoDB.svg?style=social&label=Follow%20%40NocoDB)](https://twitter.com/NocoDB)

</div>





<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> • 
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a>
</p>  

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>


# 빠른 시도
### 1-Click Deploy

#### Heroku
<a href="https://heroku.com/deploy?template=https://github.com/npgia/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>
<br>

### Docker를 사용합니다
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> To persist data you can mount volume at `/usr/app/data/`.

### npm을 사용하여
```
npx create-nocodb-app
```
### git를 사용하여
```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

대시 보드를 사용하여 액세스하십시오 : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# 우리 지역 사회에 가입하십시오
<a href="https://discord.gg/5RgZmkW">
    <img 
    src="https://invidget.switchblade.xyz/5RgZmkW" 
    alt="Join NocoDB : Free & Open Source Airtable Alternative"
    >
</a>
<br>

# 스크린 샷

![2](https://user-images.githubusercontent.com/5435402/133759229-4275b934-873b-4a9b-9f23-96470fec9775.png)
<br>

![1](https://user-images.githubusercontent.com/5435402/133759218-f8b0bffc-707f-451c-82f2-b5ba2573d6a6.png)
<br>

![7](https://user-images.githubusercontent.com/5435402/133759245-a536165b-55f1-46a8-a74e-1964e7e481c6.png)
<br>

![5](https://user-images.githubusercontent.com/5435402/133759240-dd3f2509-aab7-4bd1-9a58-4c2dff08f2f2.png)
<br>

![6](https://user-images.githubusercontent.com/5435402/133759242-2311a127-17c8-406c-b865-1a2e9c8ee398.png)
<br>

![3](https://user-images.githubusercontent.com/5435402/133759234-9b539029-be36-4a35-b55a-bee3ebd0e010.png)
<br>

![4](https://user-images.githubusercontent.com/5435402/133759236-dc182129-3768-4e23-874e-98f5f32e962c.png)
<br>

![11](https://user-images.githubusercontent.com/5435402/133759253-bb9bc729-ee28-4f86-ab95-7d112c0815f2.png)
<br>

![10](https://user-images.githubusercontent.com/5435402/133759250-ebd75ecf-31db-4a17-b2d7-2c43af78a54e.png)
<br>

![8](https://user-images.githubusercontent.com/5435402/133759248-3a7141e0-4b7d-4079-a5f9-cf8611d00bc5.png)
<br>

![9](https://user-images.githubusercontent.com/5435402/133759249-8c1a85c2-a55c-48f6-bd58-aa6b4195cce7.png)









# 특징
### 풍부한 스프레드 시트 인터페이스

- ⚡ 검색, 정렬, 필터링, Uber 쉽게 열 숨기기
- ✔ 조회수 만들기 : 그리드, 갤러리, Kanban, Gantt, Form
- ⚡ 공유보기 : 공개 및 암호 보호
- ⚡ 개인 및 잠긴 뷰
- ▸ 이미지를 셀에 업로드합니다 (S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backblaze).
- ✔ 역할 : 소유자, 작성자, 편집자, 주석어, 뷰어, 주석어, 사용자 정의 역할.
- ❏ 액세스 제어 : 데이터베이스, 테이블 및 열 레벨에서도 미세 액세스 제어.

### 워크 플로 자동화를위한 앱 스토어 :
- ⚡ 채팅 : Microsoft 팀, 여유, 불화, 상단
- ⚡ 이메일 : SMTP, SES, MailChimp.
- ⚡ SMS : Twilio.
- ⚡ Whatsapp.
- ☐ 3 파티 apis.

### 프로그래밍 방식 API 액세스 비아 :
- ⚡ REST API (SWAGNER)
- ⚡ Graphql API.
- ✔ JWT 인증 및 사회적 인증이 포함됩니다
- ⚡ API 토큰은 Zapier와 통합되어 Indegrat입니다.


# Production Setup
NoCoDB에는 스프레드 시트보기 및 외부 데이터베이스의 메타 데이터를 저장할 데이터베이스가 필요합니다. 및이 데이터베이스의 연결 매개 변수는 NC_DB 환경 변수로 지정할 수 있습니다.

## Docker

#### Example MySQL
```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example Postgres
```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example SQL Server
```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose
```
git clone https://github.com/nocodb/nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up
```


## Environment variables
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

# Development setup
```
git clone https://github.com/nocodb/nocodb
cd nocodb

# run backend
cd packages/nocodb
npm install
npm run watch:run

# open localhost:8080/dashboard in browser

# run frontend 
cd packages/nc-gui
npm install
npm run dev

# open localhost:3000/dashboard in browser
```

Changes made to code automatically restart.


## Running Cypress tests locally

```shell
# install dependencies(cypress)
npm install

# run required services by using docker compose 
docker-compose -f ./docker-compose-cypress.yml up



# wait until both 3000 and 8080 porta are avalable
# and run cypress test using following command
npm run cypress:run

# or run following command to run it with GUI
npm run cypress:open
```

# Contributing
- Please take a look at ./contribute/HowToApplyLicense.md
- Ignore adding headers for .json or .md or .yml

# 🎯  왜 우리가 이것을 구축하고 있니?
대부분의 인터넷 비즈니스는 비즈니스 요구 사항을 해결하기 위해 스프레드 시트 또는 데이터베이스를 장비합니다. 스프레드 시트는 하루에 매일 30 억 + 인간이 사용됩니다. 그러나 우리는 컴퓨팅에 관해보다 강력한 도구가 더 강력한 데이터베이스에서 유사한 속도로 작동하는 방법이 있습니다. SaaS offices 로이 문제를 해결하려는 시도는 끔찍한 액세스 제어, 공급 업체 잠금, 데이터 잠금, 갑작스런 가격 변경 및 가장 중요한 것은 가능할 수있는 유리 천장입니다.

# ❤ 우리의 미션 :
우리의 임무는 세계에서 모든 단일 인터넷 사업에 오픈 소스 인 데이터베이스에 가장 강력한 코드 인터페이스를 제공하는 것입니다. 이것은 강력한 컴퓨팅 도구에 대한 액세스를 민주화 할뿐만 아니라 인터넷에 급진적 인 땜질 / 건물 능력을 갖게 될 10 억 + 사람들을 이끌어냅니다.
