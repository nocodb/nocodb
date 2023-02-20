<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB</a><br>
    </b>
    ✨ Airtable 대체 오픈소스 ✨ <br>
</h1>

<p align="center">
MySQL, PostgreSQL, SQL Server, SQLite, MariaDB를 스마트 스프레드시트로 바꿔줍니다.
</p>

<div align="center">

[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)
</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Documentation</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# 빠른 시도

### Docker 사용

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- 데이터를 계속 저장하려면 반드시 `/usr/app/data/`에 볼륨을 마운트해야 합니다

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:

### npm 사용

```
npx create-nocodb-app
```

### Git 사용

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

대시보드 접근 : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# 커뮤니티 가입

<a href="https://discord.gg/5RgZmkW">
    <img 
    src="https://invidget.switchblade.xyz/5RgZmkW" 
    alt="NocoDB 디스코드 들어오기"
    >
</a>
<br>

# 스크린샷

![1](https://user-images.githubusercontent.com/86527202/136069919-4ea818df-2b05-4038-890d-f329773b8967.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136069938-f0ab0ee3-2b8f-44d8-a82a-1d800b69cabe.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136069943-2baf7a53-53f2-494c-8108-b81841df7bb4.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136069946-eb33a828-5911-49f9-a862-ca2d497f8c5a.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136069949-5fd6fe37-c52b-43f1-ac70-aad057f24fe5.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136069954-7968a745-ce54-48cc-ab8d-337ccdaf5eee.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136069958-287c1085-d983-467f-880b-a900a1a5aecb.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136069962-4c79c51b-2dc9-4839-8521-baaa6e2bc0f8.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136069965-e61ed8d3-9842-4eac-9423-f3c3321e8651.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136069967-4697ee78-d156-44bb-bc04-5dd43d23e694.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136069971-402bb0fe-af19-439b-9fb8-c2a882f5d35a.png)
<br>

# 기능

### 스프레드시트 인터페이스

- ⚡ 기본 오퍼레이션: 테이블, 칼럼, 로우 CRUD
- ⚡ 필드 오퍼레이션: 정렬, 필터, 칼럼 보기/숨기기
- ⚡ 뷰 타입: 그리드, 갤러리, 칸반, 간트 차트, 양식(Form)
- ⚡ 공유: 공개 / 비공개 뷰 (비밀 번호 설정)
- ⚡ 다양한 셀 타입: ID, LinkToAnotherRecord, Lookup, Rollup, SingleLine Text, Attachment, Currency, Formula 등
- ⚡ 역할에 따른 접근 제한: 다양한 수준의 세분화된 액세스 제어

### 워크플로 자동화를 위한 앱스토어
크게 채팅, 이메일, 저장소 세 가지 카테고리에 대한 통합을 제공합니다. 자세한 사항은 <a href="https://docs.nocodb.com/setup-and-usages/app-store" target="_blank">App Store</a> 를 참고하세요.
- ⚡ 채팅: MS 팀즈, 슬랙, 디스코드, 매터모스트
- ⚡ 이메일: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ 왓츠앱
- ⚡ 그 외에 여러 서드파티 API

### 외부 API 접근

- ⚡ REST API (Swagger)
- ⚡ GraphQL API
- ⚡ JWT 인증 및 SNS 로그인
- ⚡ Zapier 및 Integromat 통합을 위한 API 토큰

# 운영 환경에 설치하기

NocoDB는 스프레드시트 뷰 메타데이터와 외부 데이터베이스 정보를 저장하기 위한 데이터베이스를 필요로 합니다.
그리고 이 데이터베이스 연결을 위한 정보는 `NC_DB` 환경변수에 담습니다.

## Docker

#### MySQL 예제

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### PostgreSQL 예제

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### SQL Server 예제

```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose

```
git clone https://github.com/nocodb/nocodb
cd nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up -d
```

## 환경변수

여기서 확인해주세요.
[환경변수 ](https://docs.nocodb.com/getting-started/environment-variables)

# 개발 환경에 설치

여기서 확인해주세요.
[개발 환경에 설치하는 법](https://docs.nocodb.com/engineering/development-setup)

# 기여

여기서 확인해주세요.
[기여 가이드라인](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# 왜 이걸 만들었나요?

대부분의 인터넷 비즈니스는 업무상의 요구사항을 해결하기 위해 스프레드시트 또는 데이터베이스를 사용합니다. 스프레드시트는 매일 하루에 수십억 명 이상이 함께 사용합니다. 그러나 우리는 컴퓨팅에 관한 한 훨씬 강력한 도구인 데이터베이스는 별로 그만큼 사용하고 있지 않습니다. 이 문제를 SaaS로 해결하려는 시도는 끔찍한 접근 통제, 특정 업체 종속, 데이터 종속, 급격한 가격 변동, 그리고 무엇보다도 미래의 가능성을 스스로 가둬버리는 것을 의미합니다.

# 우리의 사명

우리의 사명은 이 세상의 모든 인터넷 비즈니스를 위해 가장 강력한 노코드(No-Code) 데이터베이스 인터페이스를 오픈소스로 제공하는 것입니다. 이는 단지 강력한 컴퓨팅 도구를 대중화하는 데 그치는 것이 아니라, 인터넷 상에서 뭐든 이어붙이고 만들 수 있는 급진적인 능력을 수십억 사람들에게 가져다주게 될 것입니다.
