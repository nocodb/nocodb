<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/icons/512x512.png" width="80" />
            <br>
            NocoDB
        </a>
    </div>
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

![All Views](https://user-images.githubusercontent.com/35857179/194825053-3aa3373d-3e0f-4b42-b3f1-42928332054a.gif)

<p align="center">
  <a href="https://heroku.com/deploy?template=https://github.com/nocodb/nocodb-seed-heroku">
      <img 
      src="https://www.herokucdn.com/deploy/button.svg" 
      width="300px"
      alt="Deploy NocoDB to Heroku with 1-Click" 
      />
  </a>
</p>

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

![5](https://user-images.githubusercontent.com/35857179/192694648-736866af-c1cb-4158-9f3b-6cc089f00283.png)
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
- [License](#license)
- [Contributors](#contributors)

# Features

### Rich Spreadsheet Interface

- ⚡ &nbsp;Basic Operations: Create, Read, Update and Delete on Tables, Columns, and Rows
- ⚡ &nbsp;Fields Operations: Sort, Filter, Hide / Unhide Columns
- ⚡ &nbsp;Multiple Views Types: Grid (By default), Gallery, Form View and Kanban View
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

# License 
<p>
This project is licensed under <a href="./LICENSE">AGPLv3</a>.
</p>

# Contributors

Thank you for your contributions! We appreciate all the contributions from the community.

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>