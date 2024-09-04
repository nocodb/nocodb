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
NocoDB is the fastest and easiest way to build databases online.
</p>

<div align="center">

[![Node version](https://img.shields.io/badge/node-%3E%3D%2016.14.0-brightgreen)](http://nodejs.org/download/)
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

<div align="center">

[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263434-75fe793d-42af-49e4-b964-d70920e41655.png">](markdown/readme/languages/chinese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263474-787d71e7-3a87-42a8-92a8-be1d1f55413d.png">](markdown/readme/languages/french.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263531-fae58600-6616-4b43-95a0-5891019dd35d.png">](markdown/readme/languages/german.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263589-3dbeda9a-0d2e-4bbd-b1fc-691404bb74fb.png">](markdown/readme/languages/spanish.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263669-f567196a-d4e8-4143-a80a-93d3be32ba90.png">](markdown/readme/languages/portuguese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263707-ba4e04a4-268a-4626-91b8-048e572fd9f6.png">](markdown/readme/languages/italian.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263770-38e3e79d-11d4-472e-ac27-ae0f17cf65c4.png">](markdown/readme/languages/japanese.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263822-28fce9de-915a-44dc-962d-7a61d340e91d.png">](markdown/readme/languages/korean.md)
[<img height="38" src="https://user-images.githubusercontent.com/61551451/135263888-151d4ad1-7084-4943-97c9-56f28cd40b80.png">](markdown/readme/languages/russian.md)

</div>

<p align="center"><a href="markdown/readme/languages/README.md"><b>See other languages »</b></a></p>

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

# Join Our Team

<p align=""><a href="http://careers.nocodb.com" target="_blank"><img src="https://user-images.githubusercontent.com/61551451/169663818-45643495-e95b-48e2-be13-01d6a77dc2fd.png" width="250"/></a></p>

# Join Our Community

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![Stargazers repo roster for @nocodb/nocodb](https://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# Quick try


## Docker

```bash
# for SQLite
docker run -d --name nocodb \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
nocodb/nocodb:latest


# for PostgreSQL
docker run -d --name nocodb-postgres \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest


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
# for PostgreSQL
cd nocodb/docker-compose/pg
docker-compose up -d
```

> To persist data in docker, you can mount volume at `/usr/app/data/` since 0.10.6. Otherwise your data will be lost after recreating the container.

> If you plan to input some special characters, you may need to change the character set and collation yourself when creating the database. Please check out the examples for [MySQL Docker Compose](https://github.com/nocodb/nocodb/issues/1313#issuecomment-1046625974).

# GUI

Access Dashboard using: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Screenshots

![1](https://user-images.githubusercontent.com/35857179/194844858-d353bd15-1edf-406c-889b-ba60f76831f4.png)
![2](https://user-images.githubusercontent.com/35857179/194844872-1a1094b9-761b-4ab6-a0ab-8e11dcae6571.png)
![3](https://user-images.githubusercontent.com/35857179/194844881-23f12c4c-7a5f-403e-928c-ef4c53b2665d.png)
![4](https://user-images.githubusercontent.com/35857179/194844885-faaf042f-bad2-4924-84f0-2c08813271d8.png)
![5](https://user-images.githubusercontent.com/35857179/194844886-a17006e0-979d-493f-83c4-0e72f5a9b716.png)
![6](https://user-images.githubusercontent.com/35857179/194844890-b9f265ae-6e40-4fa5-9267-d1367c27c8e6.png)
![7](https://user-images.githubusercontent.com/35857179/194844891-bee9aea3-aff3-4247-a918-b2f3fbbc672e.png)
![8](https://user-images.githubusercontent.com/35857179/194844893-82d5e21b-ae61-41bd-9990-31ad659bf490.png)
![9](https://user-images.githubusercontent.com/35857179/194844897-cfd79946-e413-4c97-b16d-eb4d7678bb79.png)
![10](https://user-images.githubusercontent.com/35857179/194844902-c0122570-0dd5-41cf-a26f-6f8d71fefc99.png)
![11](https://user-images.githubusercontent.com/35857179/194844903-c1e47f40-e782-4f5d-8dce-6449cc70b181.png)
![12](https://user-images.githubusercontent.com/35857179/194844907-09277d3e-cbbf-465c-9165-6afc4161e279.png)

# Table of Contents

- [Quick try](#quick-try)
    - [NPX](#npx)
    - [Node Application](#node-application)
    - [Docker](#docker)
    - [Docker Compose](#docker-compose)
- [GUI](#gui)
- [Join Our Community](#join-our-community)
- [Screenshots](#screenshots)
- [Table of Contents](#table-of-contents)
- [Features](#features)
    - [Rich Spreadsheet Interface](#rich-spreadsheet-interface)
    - [App Store for Workflow Automations](#app-store-for-workflow-automations)
    - [Programmatic Access](#programmatic-access)
    - [Sync Schema](#sync-schema)
    - [Audit](#audit)
- [Production Setup](#production-setup)
    - [Environment variables](#environment-variables)
- [Development Setup](#development-setup)
- [Contributing](#contributing)
- [Why are we building this?](#why-are-we-building-this)
- [Our Mission](#our-mission)
- [License](#license)
- [Contributors](#contributors)

# Features

### Rich Spreadsheet Interface

- ⚡ &nbsp;Basic Operations: Create, Read, Update and Delete Tables, Columns, and Rows
- ⚡ &nbsp;Fields Operations: Sort, Filter, Hide / Unhide Columns
- ⚡ &nbsp;Multiple Views Types: Grid (By default), Gallery, Form View and Kanban View
- ⚡ &nbsp;View Permissions Types: Collaborative Views, & Locked Views
- ⚡ &nbsp;Share Bases / Views: either Public or Private (with Password Protected)
- ⚡ &nbsp;Variant Cell Types: ID, LinkToAnotherRecord, Lookup, Rollup, SingleLineText, Attachment, Currency, Formula, etc
- ⚡ &nbsp;Access Control with Roles: Fine-grained Access Control at different levels
- ⚡ &nbsp;and more ...

### App Store for Workflow Automations

We provide different integrations in three main categories. See <a href="https://docs.nocodb.com/setup-and-usages/account-settings#app-store" target="_blank">App Store</a> for details.

- ⚡ &nbsp;Chat: Slack, Discord, Mattermost, and etc
- ⚡ &nbsp;Email: AWS SES, SMTP, MailerSend, and etc
- ⚡ &nbsp;Storage: AWS S3, Google Cloud Storage, Minio, and etc

### Programmatic Access

We provide the following ways to let users programmatically invoke actions. You can use a token (either JWT or Social Auth) to sign your requests for authorization to NocoDB.

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

### Sync Schema

We allow you to sync schema changes if you have made changes outside NocoDB GUI. However, it has to be noted then you will have to bring your own schema migrations for moving from one environment to another. See <a href="https://docs.nocodb.com/data-sources/sync-with-data-source" target="_blank">Sync Schema</a> for details.

### Audit

We are keeping all the user operation logs in one place. See <a href="https://docs.nocodb.com/data-sources/actions-on-data-sources/#audit-logs" target="_blank">Audit</a> for details.

# Production Setup

By default, SQLite is used for storing metadata. However, you can specify your database. The connection parameters for this database can be specified in `NC_DB` environment variable. Moreover, we also provide the below environment variables for configuration.

## Environment variables

Please refer to the [Environment variables](https://docs.nocodb.com/getting-started/self-hosted/environment-variables)

# Development Setup

Please refer to [Development Setup](https://docs.nocodb.com/engineering/development-setup)

# Contributing

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Why are we building this?

Most internet businesses equip themselves with either spreadsheet or a database to solve their business needs. Spreadsheets are used by Billion+ humans collaboratively every single day. However, we are way off working at similar speeds on databases which are way more powerful tools when it comes to computing. Attempts to solve this with SaaS offerings have meant horrible access controls, vendor lock-in, data lock-in, abrupt price changes & most importantly a glass ceiling on what's possible in the future.

# Our Mission

Our mission is to provide the most powerful no-code interface for databases that is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on the internet.

# License

<p>
This project is licensed under <a href="./LICENSE">AGPLv3</a>.
</p>

# Contributors

Thank you for your contributions! We appreciate all the contributions from the community.

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>
