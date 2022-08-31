<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB</a><br>
    </b>
    The Open Source Airtable Alternative <br>
</h1>

<p align="center">
Turns any MySQL, PostgreSQL, SQL Server, SQLite & MariaDB into a smart-spreadsheet.
</p>


<div align="center">
 
[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB) 
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Website</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>Community</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Documentation</b></a>
</p>  

<p align="center"><img src="https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png" alt="The Open Source Airtable Alternative - works on MySQL, Postgres SQL Server & MariaDB" width="1000px" /></p>

<p align="center"><a href="https://heroku.com/deploy?template=https://github.com/nocodb/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a></p>


<div align="center">

[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263434-75fe793d-42af-49e4-b964-d70920e41655.png">](scripts/markdown/readme/languages/chinese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263474-787d71e7-3a87-42a8-92a8-be1d1f55413d.png">](scripts/markdown/readme/languages/french.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263531-fae58600-6616-4b43-95a0-5891019dd35d.png">](scripts/markdown/readme/languages/german.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263589-3dbeda9a-0d2e-4bbd-b1fc-691404bb74fb.png">](scripts/markdown/readme/languages/spanish.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263669-f567196a-d4e8-4143-a80a-93d3be32ba90.png">](scripts/markdown/readme/languages/portuguese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263707-ba4e04a4-268a-4626-91b8-048e572fd9f6.png">](scripts/markdown/readme/languages/italian.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263770-38e3e79d-11d4-472e-ac27-ae0f17cf65c4.png">](scripts/markdown/readme/languages/japanese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263822-28fce9de-915a-44dc-962d-7a61d340e91d.png">](scripts/markdown/readme/languages/korean.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263888-151d4ad1-7084-4943-97c9-56f28cd40b80.png">](scripts/markdown/readme/languages/russian.md)

</div>


<p align="center"><a href="scripts/markdown/readme/languages/README.md"><b>See other languages »</b></a></p>

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

# Join Our Team
<p align=""><a href="http://careers.nocodb.com" target="_blank"><img src="https://user-images.githubusercontent.com/61551451/169663818-45643495-e95b-48e2-be13-01d6a77dc2fd.png" width="250"/></a></p>

# Join Our Community

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

<!-- <a href="https://community.nocodb.com/" target="_blank">
<img src="https://i2.wp.com/www.feverbee.com/wp-content/uploads/2018/07/logo-discourse.png" alt="">
</a>
 -->
[![Stargazers repo roster for @nocodb/nocodb](https://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)


# Quick try

## 1-Click Deploy to Heroku

Before doing so, make sure you have a Heroku account. By default, an add-on Heroku Postgres will be used as meta database. You can see the connection string defined in `DATABASE_URL` by navigating to Heroku App Settings and selecting Config Vars.

<a href="https://heroku.com/deploy?template=https://github.com/nocodb/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>

<br/>

## NPX

You can run below command if you need an interactive configuration.

```
npx create-nocodb-app
```

<img src="https://user-images.githubusercontent.com/35857179/163672964-00ef5d62-0434-447d-ac01-3ebb780099b9.png" width="520px"/>

## Node Application

We provide a simple NodeJS Application for getting started.

```bash
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

## Docker 

```bash
# for SQLite
docker run -d --name nocodb \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
nocodb/nocodb:latest

# for MySQL
docker run -d --name nocodb-mysql \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest

# for PostgreSQL
docker run -d --name nocodb-postgres \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest

# for MSSQL
docker run -d --name nocodb-mssql \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="mssql://host.docker.internal:1433?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest
```

> To persist data in docker you can mount volume at `/usr/app/data/` since 0.10.6. Otherwise your data will be lost after recreating the container.

> If you plan to input some special characters, you may need to change the character set and collation yourself when creating the database. Please check out the examples for [MySQL Docker](https://github.com/nocodb/nocodb/issues/1340#issuecomment-1049481043).

## Binaries
##### MacOS (x64)
```bash
curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb
```

##### MacOS (arm64)
```bash
curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb
```

##### Linux (x64)
```bash
curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb
```
##### Linux (arm64)
```bash
curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb
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

## Docker Compose

We provide different docker-compose.yml files under [this directory](https://github.com/nocodb/nocodb/tree/master/docker-compose). Here are some examples.

```bash
git clone https://github.com/nocodb/nocodb
# for MySQL
cd nocodb/docker-compose/mysql
# for PostgreSQL
cd nocodb/docker-compose/pg
# for MSSQL
cd nocodb/docker-compose/mssql
docker-compose up -d
```

> To persist data in docker, you can mount volume at `/usr/app/data/` since 0.10.6. Otherwise your data will be lost after recreating the container.

> If you plan to input some special characters, you may need to change the character set and collation yourself when creating the database. Please check out the examples for [MySQL Docker Compose](https://github.com/nocodb/nocodb/issues/1313#issuecomment-1046625974).

# GUI

Access Dashboard using : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# Screenshots

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

![5](https://user-images.githubusercontent.com/35857179/151526876-f6a0e472-9bbc-45ba-a771-9118e03bc748.png)
<br>

![6](https://user-images.githubusercontent.com/35857179/151526883-4c670f8b-7c5c-421f-9e95-54d3a84a72ba.png)
<br>

![11](https://user-images.githubusercontent.com/5435402/133759253-bb9bc729-ee28-4f86-ab95-7d112c0815f2.png)
<br>

![10](https://user-images.githubusercontent.com/5435402/133759250-ebd75ecf-31db-4a17-b2d7-2c43af78a54e.png)
<br>

![8](https://user-images.githubusercontent.com/35857179/163675704-54eb644d-3b5e-45e3-aad4-794a0f55c692.png)

<br>

![9](https://user-images.githubusercontent.com/5435402/133759249-8c1a85c2-a55c-48f6-bd58-aa6b4195cce7.png)

# Table of Contents

- [Quick try](#quick-try)
  * [1-Click Deploy to Heroku](#1-click-deploy-to-heroku)
  * [NPX](#npx)
  * [Node Application](#node-application)
  * [Docker](#docker)
  * [Docker Compose](#docker-compose)
- [GUI](#gui)
- [Join Our Community](#join-our-community)
- [Screenshots](#screenshots)
- [Table of Contents](#table-of-contents)
- [Features](#features)
    + [Rich Spreadsheet Interface](#rich-spreadsheet-interface)
    + [App Store for Workflow Automations](#app-store-for-workflow-automations)
    + [Programmatic Access](#programmatic-access)
    + [Sync Schema](#sync-schema)
    + [Audit](#audit)
- [Production Setup](#production-setup)
  * [Environment variables](#environment-variables)
- [Development Setup](#development-setup)
- [Contributing](#contributing)
- [Why are we building this?](#why-are-we-building-this)
- [Our Mission](#our-mission)
- [Contributors](#contributors)

# Features

### Rich Spreadsheet Interface

- ⚡ &nbsp;Basic Operations: Create, Read, Update and Delete on Tables, Columns, and Rows
- ⚡ &nbsp;Fields Operations: Sort, Filter, Hide / Unhide Columns
- ⚡ &nbsp;Multiple Views Types: Grid (By default), Gallery and Form View
- ⚡ &nbsp;View Permissions Types: Collaborative Views, & Locked Views 
- ⚡ &nbsp;Share Bases / Views: either Public or Private (with Password Protected)
- ⚡ &nbsp;Variant Cell Types: ID, LinkToAnotherRecord, Lookup, Rollup, SingleLineText, Attachement, Currency, Formula and etc
- ⚡ &nbsp;Access Control with Roles : Fine-grained Access Control at different levels
- ⚡ &nbsp;and more ...

### App Store for Workflow Automations

We provide different integrations in three main categories. See <a href="https://docs.nocodb.com/setup-and-usages/app-store" target="_blank">App Store</a> for details.

- ⚡ &nbsp;Chat : Slack, Discord, Mattermost, and etc
- ⚡ &nbsp;Email : AWS SES, SMTP, MailerSend, and etc
- ⚡ &nbsp;Storage : AWS S3, Google Cloud Storage, Minio, and etc

### Programmatic Access

We provide the following ways to let users to invoke actions in a programmatic way. You can use a token (either JWT or Social Auth) to sign your requests for authorization to NocoDB. 

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

### Sync Schema

We allow you to sync schema changes if you have made changes outside NocoDB GUI. However, it has to be noted then you will have to bring your own schema migrations for moving from environment to others. See <a href="https://docs.nocodb.com/setup-and-usages/sync-schema/" target="_blank">Sync Schema</a> for details.

### Audit 

We are keeping all the user operation logs under one place. See <a href="https://docs.nocodb.com/setup-and-usages/audit" target="_blank">Audit</a> for details.

# Production Setup 

By default, SQLite is used for storing meta data. However, you can specify your own database. The connection params for this database can be specified in `NC_DB` environment variable. Moreover, we also provide the below environment variables for configuration.

## Environment variables 

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/installation#environment-variables)

# Development Setup 

Please refer to [Development Setup](https://docs-dev.nocodb.com/engineering/development-setup)

# Contributing

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Why are we building this?
Most internet businesses equip themselves with either spreadsheet or a database to solve their business needs. Spreadsheets are used by a Billion+ humans collaboratively every single day. However, we are way off working at similar speeds on databases which are way more powerful tools when it comes to computing. Attempts to solve this with SaaS offerings has meant horrible access controls, vendor lockin, data lockin, abrupt price changes & most importantly a glass ceiling on what's possible in future.

# Our Mission
Our mission is to provide the most powerful no-code interface for databases which is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on internet. 

# Contributors
[//]: contributor-faces

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/o1lab"><img src="https://avatars.githubusercontent.com/u/5435402?v=4?s=100" width="100px;" alt=""/><br /><sub><b>o1lab</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=o1lab" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/pranavxc"><img src="https://avatars.githubusercontent.com/u/61551451?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Pranav C</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=pranavxc" title="Code">💻</a></td>
    <td align="center"><a href="http://bvkatwijk.nl/"><img src="https://avatars.githubusercontent.com/u/18490578?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Boris van Katwijk</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=bvkatwijk" title="Code">💻</a></td>
    <td align="center"><a href="https://stackshare.io/markuman/my-stack"><img src="https://avatars.githubusercontent.com/u/3920157?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Markus Bergholz</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=markuman" title="Code">💻</a></td>
    <td align="center"><a href="https://daniel-ruf.de/"><img src="https://avatars.githubusercontent.com/u/827205?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Daniel Ruf</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=DanielRuf" title="Code">💻</a></td>
    <td align="center"><a href="http://bertverhelst.ga/"><img src="https://avatars.githubusercontent.com/u/1710840?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Bert Verhelst</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=bertyhell" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/chocholand"><img src="https://avatars.githubusercontent.com/u/6572227?v=4?s=100" width="100px;" alt=""/><br /><sub><b>JaeWon</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=chocholand" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/0xflotus"><img src="https://avatars.githubusercontent.com/u/26602940?v=4?s=100" width="100px;" alt=""/><br /><sub><b>0xflotus</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=0xflotus" title="Code">💻</a></td>
    <td align="center"><a href="http://www.simonguionniere.com/"><img src="https://avatars.githubusercontent.com/u/3633017?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Simon Guionniere</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=sguionni" title="Code">💻</a></td>
    <td align="center"><a href="https://clients.extremeshok.com/"><img src="https://avatars.githubusercontent.com/u/5957328?v=4?s=100" width="100px;" alt=""/><br /><sub><b>eXtremeSHOK</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=extremeshok" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/v2io"><img src="https://avatars.githubusercontent.com/u/48987429?v=4?s=100" width="100px;" alt=""/><br /><sub><b>v2io</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=v2io" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/soaserele"><img src="https://avatars.githubusercontent.com/u/1093368?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Stanislav Oaserele</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=soaserele" title="Code">💻</a></td>
    <td align="center"><a href="https://ans4175.dev/"><img src="https://avatars.githubusercontent.com/u/3961872?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ahmad Anshorimuslim Syuhada</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ans-4175" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lotas"><img src="https://avatars.githubusercontent.com/u/83861?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yaraslau Kurmyza</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=lotas" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="http://stackexchange.com/users/1677570/ferrybig"><img src="https://avatars.githubusercontent.com/u/1576684?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Fernando van Loenhout</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ferrybig" title="Code">💻</a></td>
    <td align="center"><a href="http://blog.quidquid.fr/"><img src="https://avatars.githubusercontent.com/u/1001585?v=4?s=100" width="100px;" alt=""/><br /><sub><b>jrevault</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=jrevault" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/atilacamurca"><img src="https://avatars.githubusercontent.com/u/508624?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Átila Camurça Alves</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=atilacamurca" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/simonbowen"><img src="https://avatars.githubusercontent.com/u/8931?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Simon Bowen</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=simonbowen" title="Code">💻</a></td>
    <td align="center"><a href="https://wingk-wong.blogspot.com/"><img src="https://avatars.githubusercontent.com/u/35857179?v=4?s=100" width="100px;" alt=""/><br /><sub><b>աɨռɢӄաօռɢ</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=wingkwong" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ferdiga"><img src="https://avatars.githubusercontent.com/u/6248560?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ferdinand Gassauer</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ferdiga" title="Code">💻</a></td>
    <td align="center"><a href="https://daneke.ru/"><img src="https://avatars.githubusercontent.com/u/4980165?v=4?s=100" width="100px;" alt=""/><br /><sub><b>George Daneke</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=Flatroy" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://jwillmer.de/"><img src="https://avatars.githubusercontent.com/u/1503577?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Jens Willmer</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=jwillmer" title="Code">💻</a></td>
    <td align="center"><a href="http://bhanu.io/"><img src="https://avatars.githubusercontent.com/u/2958857?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Bhanu Pratap Chaudhary</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=bhanuc" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/jwetzell"><img src="https://avatars.githubusercontent.com/u/18341515?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Joel Wetzell</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=jwetzell" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/SebGTx"><img src="https://avatars.githubusercontent.com/u/8062146?v=4?s=100" width="100px;" alt=""/><br /><sub><b>SebGTx</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=SebGTx" title="Code">💻</a></td>
    <td align="center"><a href="https://farazpatankar.com/"><img src="https://avatars.githubusercontent.com/u/10681116?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Faraz Patankar</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=FarazPatankar" title="Code">💻</a></td>
    <td align="center"><a href="https://pixplix.com/"><img src="https://avatars.githubusercontent.com/u/71349937?v=4?s=100" width="100px;" alt=""/><br /><sub><b>PixPlix</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=pixplix" title="Code">💻</a></td>
    <td align="center"><a href="http://alejandro.giacometti.me/"><img src="https://avatars.githubusercontent.com/u/31504?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Alejandro Giacometti</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=janrito" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://brunomoreira.opo.pt"><img src="https://avatars.githubusercontent.com/u/3017910?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Bruno Moreira</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=bmscmoreira" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/AztrexDX"><img src="https://avatars.githubusercontent.com/u/86340924?v=4?s=100" width="100px;" alt=""/><br /><sub><b>AztrexDX</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=AztrexDX" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ejose19"><img src="https://avatars.githubusercontent.com/u/8742215?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ejose19</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ejose19" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/maximeag"><img src="https://avatars.githubusercontent.com/u/3855368?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Maxime</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=maximeag" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/dstala"><img src="https://avatars.githubusercontent.com/u/86527202?v=4?s=100" width="100px;" alt=""/><br /><sub><b>dstala</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=dstala" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/loftwah"><img src="https://avatars.githubusercontent.com/u/19922556?v=4?s=100" width="100px;" alt=""/><br /><sub><b>loftwah</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=loftwah" title="Code">💻</a></td>
    <td align="center"><a href="https://museosabiertos.org"><img src="https://avatars.githubusercontent.com/u/693328?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Martin Gersbach</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=mrtngrsbch" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/ArjenR"><img src="https://avatars.githubusercontent.com/u/4269186?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ArjenR</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ArjenR" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/kunggom"><img src="https://avatars.githubusercontent.com/u/32009637?v=4?s=100" width="100px;" alt=""/><br /><sub><b>조진식 (Jo Jinsik)</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=kunggom" title="Code">💻</a></td>
    <td align="center"><a href="http://www.cuobiezi.net"><img src="https://avatars.githubusercontent.com/u/90968567?v=4?s=100" width="100px;" alt=""/><br /><sub><b>tianchunfeng</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=tianberg" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/cthulberg"><img src="https://avatars.githubusercontent.com/u/5301275?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Andrea</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=cthulberg" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/eevleevs"><img src="https://avatars.githubusercontent.com/u/5012744?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Giulio Malventi</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=eevleevs" title="Code">💻</a></td>
    <td align="center"><a href="https://dev-z.github.io"><img src="https://avatars.githubusercontent.com/u/8604312?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Md. Ishtiaque Zafar</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=dev-z" title="Code">💻</a></td>
    <td align="center"><a href="http://www.chaslui.com"><img src="https://avatars.githubusercontent.com/u/10083758?v=4?s=100" width="100px;" alt=""/><br /><sub><b>ChasLui</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ChasLui" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://www.linkedin.com/in/zhansayam/"><img src="https://avatars.githubusercontent.com/u/41486762?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Zhansaya Maksut</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ZhansayaM" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/agkfri"><img src="https://avatars.githubusercontent.com/u/37952138?v=4?s=100" width="100px;" alt=""/><br /><sub><b>agkfri</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=agkfri" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/iqiziqi"><img src="https://avatars.githubusercontent.com/u/8640316?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ziqi</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=iqiziqi" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/AllanSiqueira"><img src="https://avatars.githubusercontent.com/u/14025084?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Allan Siqueira</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=AllanSiqueira" title="Code">💻</a></td>
    <td align="center"><a href="https://creatify.my.id/"><img src="https://avatars.githubusercontent.com/u/54095238?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Fatih</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=ahmadfatihin" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/roman-rezinkin"><img src="https://avatars.githubusercontent.com/u/17882264?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Roman Rezinkin</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=roman-rezinkin" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/fragalcer"><img src="https://avatars.githubusercontent.com/u/31025299?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Francisco Gallardo</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=fragalcer" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/sesam"><img src="https://avatars.githubusercontent.com/u/8921?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Simon B.</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=sesam" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lielfr"><img src="https://avatars.githubusercontent.com/u/360928?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Liel Fridman</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=lielfr" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/rubjo"><img src="https://avatars.githubusercontent.com/u/42270947?v=4?s=100" width="100px;" alt=""/><br /><sub><b>rubjo</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=rubjo" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/kinga-marszalkowska"><img src="https://avatars.githubusercontent.com/u/64398325?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Kinga Marszałkowska</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=kinga-marszalkowska" title="Code">💻</a></td>
    <td align="center"><a href="https://nimbusec.com"><img src="https://avatars.githubusercontent.com/u/10920640?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Christof Horschitz</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=dahawk" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bebora"><img src="https://avatars.githubusercontent.com/u/32399075?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Simone</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=bebora" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/tyonirwansyah"><img src="https://avatars.githubusercontent.com/u/73389687?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Tyo Nirwansyah</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=tyonirwansyah" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/jiione"><img src="https://avatars.githubusercontent.com/u/83341978?v=4?s=100" width="100px;" alt=""/><br /><sub><b>jiwon</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=jiione" title="Code">💻</a></td>
    <td align="center"><a href="http://quantimo.do"><img src="https://avatars.githubusercontent.com/u/2808553?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Mike P. Sinn</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=mikepsinn" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/candideu"><img src="https://avatars.githubusercontent.com/u/55474996?v=4?s=100" width="100px;" alt=""/><br /><sub><b>candideu</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=candideu" title="Code">💻</a></td>
    <td align="center"><a href="http://siderealart.me"><img src="https://avatars.githubusercontent.com/u/30827929?v=4?s=100" width="100px;" alt=""/><br /><sub><b>SiderealArt</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=SiderealArt" title="Code">💻</a></td>
    <td align="center"><a href="http://vijayrathore.me"><img src="https://avatars.githubusercontent.com/u/17380265?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vijay Rathore</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=vijayrathore8492" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/John-Appleseed"><img src="https://avatars.githubusercontent.com/u/7055847?v=4?s=100" width="100px;" alt=""/><br /><sub><b>John Appleseed</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=John-Appleseed" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Korayem"><img src="https://avatars.githubusercontent.com/u/198332?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Salem Korayem</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=Korayem" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/dubiao"><img src="https://avatars.githubusercontent.com/u/4001793?v=4?s=100" width="100px;" alt=""/><br /><sub><b>标</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=dubiao" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/willnewii"><img src="https://avatars.githubusercontent.com/u/652003?v=4?s=100" width="100px;" alt=""/><br /><sub><b>诗人的咸鱼</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=willnewii" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bitbytejoy"><img src="https://avatars.githubusercontent.com/u/11807034?v=4?s=100" width="100px;" alt=""/><br /><sub><b>bitbytejoy</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=bitbytejoy" title="Code">💻</a></td>
    <td align="center"><a href="http://blog.pan93.com"><img src="https://avatars.githubusercontent.com/u/28441561?v=4?s=100" width="100px;" alt=""/><br /><sub><b>pan93412</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=pan93412" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/LancerComet"><img src="https://avatars.githubusercontent.com/u/10321350?v=4?s=100" width="100px;" alt=""/><br /><sub><b>LancerComet</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=LancerComet" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/mertmit"><img src="https://avatars.githubusercontent.com/u/59797957?v=4?s=100" width="100px;" alt=""/><br /><sub><b>mertmit</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=mertmit" title="Code">💻</a></td>
    <td align="center"><a href="https://blog.atompi.com"><img src="https://avatars.githubusercontent.com/u/6419682?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Atom Pi</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=atompi" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/OskarsPakers"><img src="https://avatars.githubusercontent.com/u/3343347?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Oskars</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=OskarsPakers" title="Code">💻</a></td>
    <td align="center"><a href="http://dolibit.de"><img src="https://avatars.githubusercontent.com/u/45215329?v=4?s=100" width="100px;" alt=""/><br /><sub><b>UT from dolibit</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=dolibit-ut" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/blucky"><img src="https://avatars.githubusercontent.com/u/42397?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Blucky</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=blucky" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/TsjipTsjip"><img src="https://avatars.githubusercontent.com/u/19798667?v=4?s=100" width="100px;" alt=""/><br /><sub><b>TsjipTsjip</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=TsjipTsjip" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/dhrrgn"><img src="https://avatars.githubusercontent.com/u/149921?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Dan Horrigan</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=dhrrgn" title="Code">💻</a></td>
    <td align="center"><a href="https://amitjoki.github.io"><img src="https://avatars.githubusercontent.com/u/5158554?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Amit Joki</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=AmitJoki" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/tympaniplayer"><img src="https://avatars.githubusercontent.com/u/1745731?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nate</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=tympaniplayer" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/RobinFrcd"><img src="https://avatars.githubusercontent.com/u/29704178?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Robin Fourcade</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=RobinFrcd" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/zprial"><img src="https://avatars.githubusercontent.com/u/33095380?v=4?s=100" width="100px;" alt=""/><br /><sub><b>zprial</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=zprial" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/nilsreichardt"><img src="https://avatars.githubusercontent.com/u/24459435?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Nils Reichardt</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=nilsreichardt" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/iamnamananand996"><img src="https://avatars.githubusercontent.com/u/31537362?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Naman Anand</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=iamnamananand996" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/GeoffMaciolek"><img src="https://avatars.githubusercontent.com/u/10995633?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Geo Maciolek</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=GeoffMaciolek" title="Code">💻</a></td>
    <td align="center"><a href="http://blog.mukyu.tw/"><img src="https://avatars.githubusercontent.com/u/6008539?v=4?s=100" width="100px;" alt=""/><br /><sub><b>神楽坂帕琪</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=mudream4869" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/titouancreach"><img src="https://avatars.githubusercontent.com/u/3995719?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Titouan CREACH</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=titouancreach" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://www.youyi.io"><img src="https://avatars.githubusercontent.com/u/49471274?v=4?s=100" width="100px;" alt=""/><br /><sub><b>youyiio</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=youyiio" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/RK311y"><img src="https://avatars.githubusercontent.com/u/65210753?v=4?s=100" width="100px;" alt=""/><br /><sub><b>River Kelly</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=RK311y" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/LepkoQQ"><img src="https://avatars.githubusercontent.com/u/2662937?v=4?s=100" width="100px;" alt=""/><br /><sub><b>LepkoQQ</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=LepkoQQ" title="Code">💻</a></td>
    <td align="center"><a href="https://cornernewclub.fr"><img src="https://avatars.githubusercontent.com/u/56829191?v=4?s=100" width="100px;" alt=""/><br /><sub><b>quentin</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=QuentinDstl" title="Code">💻</a></td>
    <td align="center"><a href="http://cande.me"><img src="https://avatars.githubusercontent.com/u/5407915?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Cande</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=cande1gut" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/seokjunjin"><img src="https://avatars.githubusercontent.com/u/46950889?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Seokjun Jin</b></sub></a><br /><a href="#translation-seokjunjin" title="Translation">🌍</a></td>
    <td align="center"><a href="https://github.com/systemctls"><img src="https://avatars.githubusercontent.com/u/37177191?v=4?s=100" width="100px;" alt=""/><br /><sub><b>jinxm</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=systemctls" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://yohanboniface.me"><img src="https://avatars.githubusercontent.com/u/146023?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yohan Boniface</b></sub></a><br /><a href="#translation-yohanboniface" title="Translation">🌍</a></td>
    <td align="center"><a href="https://github.com/drsantam"><img src="https://avatars.githubusercontent.com/u/10681456?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Santam Chakraborty</b></sub></a><br /><a href="#translation-drsantam" title="Translation">🌍</a></td>
    <td align="center"><a href="https://bandism.net/"><img src="https://avatars.githubusercontent.com/u/22633385?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Ikko Ashimine</b></sub></a><br /><a href="https://github.com/nocodb/nocodb/commits?author=eltociear" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
