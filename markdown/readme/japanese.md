<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ オープンソースのAirtableの代替案 ✨ <br>

</h1>
<p align="center">
MySQL、PostgreSQL、SQL Server、SQLite＆Mariadbをスマートスプレッドシートに変えます。 
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


# クイック試し
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

### Dockerを使う
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> To persist data you can mount volume at `/usr/app/data/`.

### NPMを使用して
```
npx create-nocodb-app
```
### gitを使う
```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

アクセスダッシュボードを使用して : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# 私たちのコミュニティに参加する
<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# スクリーンショット

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









# 特徴

### リッチスプレッドシートインターフェース

検索、並べ替え、フィルタリング、列を隠す
- ⚡ ビューを作成する：グリッド、ギャラリー、カンバン、ガント、フォーム
- ⚡ シェアビュー：Public＆Password Protected.
- ⚡ パーソナル＆ロックビュー
- ⚡ 画像を細胞にアップロードする（S3、Minio、GCP、Azure、Digitalocean、Linode、Ovh、Backblazeで動作します）。
- ⚡ ロール：所有者、作成者、エディタ、コメンタ、ビューア、コメンタ、カスタムロール。
- ⚡ アクセス制御：データベース、テーブル＆カラムレベルでも微細に粒度のアクセス制御。

### ワークフロー自動化のためのApp Store：
- ⚡ チャット：マイクロソフトチーム、たるみ、不和、マッピー
- ⚡ メール：SMTP、SE、MailChimp
- ⚡ SMS：Twilio.
- ⚡ whatsapp.
- ⚡ 第三者APIS

### プログラムによるAPIアクセスによるアクセス
- ⚡ REST APIS（Swagger）
- ⚡ GraphQLAPI。
- ⚡ JWT認証とソーシャルAUTHを含む
- ⚡ ZAPIER、Integomatと統合するAPIトークン。

# Production Setup 
NoCodbには、スプレッドシートビューと外部データベースのメタデータを格納するためのデータベースが必要です。このデータベースの接続パラメータは、NC_DB環境変数で指定できます。

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

# 🎯 なぜこれを構築しているのですか？
ほとんどのインターネットビジネスは、彼らのビジネスニーズを解決するためにスプレッドシートまたはデータベースのどちらかでそれ自体を装備しています。スプレッドシートは1日ごとに10億+人間によって使用されます。ただし、コンピューティングに関してより強力なツールであるデータベースの同様のスピードで作業しているような方法です。これをSaaS製品で解決しようとすると、恐ろしいアクセス制御、ベンダーロック、データロック、突然の価格が変更され、最も重要なことに将来可能なものに関するガラスの天井を意味しています。

# ❤ 私たちの使命 ：
私たちの使命は、世界ですべての単一のインターネットビジネスにオープンソースであるデータベースのための最も強力なノーコードインターフェースを提供することです。これは強力なコンピューティングツールへのアクセスを民主化するだけでなく、インターネット上で急進的な厄介な建築能力を持つ10億+人をもたらします。 

