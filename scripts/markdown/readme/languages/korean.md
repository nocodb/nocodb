<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB</a><br>
    </b>
    ✨ Airtable 대체 오픈소스 ✨ <br>
</h1>

<p align="center">
MySQL, PostgreSQL, SQL Server, SQLite, MariaDB를 똑똑한 스프레드시트로 바꿔줍니다.
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


# 바로 써보기
### 원클릭 배포

#### Heroku
<a href="https://heroku.com/deploy?template=https://github.com/npgia/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="NocoDB를 Heroku에 원클릭 배포하기" 
    />
</a>
<br>

### Docker 사용
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> 데이터를 계속 저장하려면 반드시 `/usr/app/data/`에 볼륨을 마운트해야 합니다..

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
대시보드 접근하기 : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


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
### 스프레드시트같은 인터페이스

- ⚡ 정말 쉬운 검색, 정렬, 필터링, 열 숨기기
- ⚡ 뷰 만들기: 그리드, 갤러리, 칸반, 간트 차트, 양식
- ⚡ 뷰 공유하기: 완전 공개, 패스워드 걸고 공개
- ⚡ 개인화하거나 잠글 수 있는 뷰
- ⚡ 이미지를 자신의 공간에 업로드 (S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backblaze 등)
- ⚡ 역할 부여: 소유자, 작성자, 편집자, 보기 전용, 의견 제시만, 원하는 대로
- ⚡ 접근 통제: 데이터베이스, 테이블 및 열 수준까지도 상세한 통제 가능

### 워크플로 자동화를 위한 앱스토어:
- ⚡ 채팅: MS 팀즈, 슬랙, 디스코드, 매터모스트
- ⚡ 이메일: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ 왓츠앱
- ⚡ 그 외에 여러 서드파티 API

### 외부 API 접근 :
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
cd docker-compose
cd mysql or pg or mssql
docker-compose up
```


## 환경변수
| 변수명                               | 필수 여부 | 설명                                                                           | 미설정된 경우                              |
|--------------------------------------|-----------|--------------------------------------------------------------------------------|--------------------------------------------|
| `NC_DB`                              | Yes       | 제품이 사용할 데이터베이스 URL                                                 | 루트 디렉터리에 SQLite DB 생성             |
| `DATABASE_URL`                       | No        | JDBC URL 형식. `NC_DB` 대신 사용 가능. Heroku 원클릭 배포에 사용               |                                            |
| `DATABASE_URL_FILE`                  | No        | JDBC URL을 담은 파일의 경로. `NC_DB` 대신 사용 가능. Heroku 원클릭 배포에 사용 |                                            |
| `NC_PUBLIC_URL`                      | Yes       | 이메일 초대에 사용                                                             | HTTP 요청 파라미터를 통해 추정             |
| `NC_AUTH_JWT_SECRET`                 | Yes       | 인증 및 다른 비밀 값을 저장할 때 사용할 JWT 시크릿 키                          | 임의의 시크릿 키 생성                      |
| `NC_SENTRY_DSN`                      | No        | Sentry 모니터링용                                                              |                                            |
| `NC_CONNECT_TO_EXTERNAL_DB_DISABLED` | No        | 외부 데이터베이스와 연동된 프로젝트를 생성하지 않음                            |                                            |
| `NC_DISABLE_TELE`                    | No        | 사용 정보를 수집하지 않음                                                      |                                            |
| `NC_BACKEND_URL`                     | No        | 커스텀 백엔드 URL                                                              | `http://localhost:8080` 사용               |

# 개발 환경에 설치하기
```shell
git clone https://github.com/nocodb/nocodb
cd nocodb

# 백엔드 실행
cd packages/nocodb
npm install
npm run watch:run

# 브라우저에서 localhost:8080/dashboard 열기

# 프론트엔드 실행
cd packages/nc-gui
npm install
npm run dev

# 브라우저에서 localhost:3000/dashboard 열기
```

코드 변경후 자동으로 재시작됩니다.


## 로컬에서 Cypress 테스트 돌리기

```shell
# 의존성(cypress) 설치
npm install

# docker compose로 필요한 서비스 실행
docker-compose -f ./docker-compose-cypress.yml up

# 3000 포트와 8080 포트가 모두 열릴 때까지 대기
# 이후 다음 명령으로 cypress 실행
npm run cypress:run

# 또는 다음 명령으로 GUI로 실행
npm run cypress:open
```

# 기여하기
- 먼저 `./scripts/contribute/HowToApplyLicense.md`를 읽기
- `.json`, `.md`, `.yml` 파일에는 헤더를 추가하지 않아도 됨

# 🎯 왜 이걸 만들었나요?
대부분의 인터넷 비즈니스는 업무상의 요구사항을 해결하기 위해 스프레드시트 또는 데이터베이스를 사용합니다. 스프레드시트는 매일 하루에 수십억 명 이상이 함께 사용합니다. 그러나 우리는 컴퓨팅에 관한 한 훨씬 강력한 도구인 데이터베이스는 별로 그만큼 사용하고 있지 않습니다. 이 문제를 SaaS로 해결하려는 시도는 끔찍한 접근 통제, 특정 업체 종속, 데이터 종속, 급격한 가격 변동, 그리고 무엇보다도 미래의 가능성을 스스로 가둬버리는 것을 의미합니다.

# ❤ 우리의 사명
우리의 사명은 이 세상의 모든 인터넷 비즈니스를 위해 가장 강력한 노코드(No-Code) 데이터베이스 인터페이스를 오픈소스로 제공하는 것입니다. 이는 단지 강력한 컴퓨팅 도구를 대중화하는 데 그치는 것이 아니라, 인터넷 상에서 뭐든 이어붙이고 만들 수 있는 급진적인 능력을 수십억 사람들에게 가져다주게 될 것입니다.
