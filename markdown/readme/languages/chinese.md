<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ Airtable 的开源替代品 ✨ <br>
</h1>
<p align="center">
将 MySQL、PostgreSQL、SQL Server、SQLite 或 MariaDB 转换为智能电子表格。
</p>
<div align="center">

[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>官网</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>文档</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
    <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - 开源的 Airtable 替代品 | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# 快速尝试

## NPX

如果你需要一个交互式的配置，你可以运行下面的命令。

```
npx create-nocodb-app
```

<img src="https://user-images.githubusercontent.com/35857179/163672964-00ef5d62-0434-447d-ac01-3ebb780099b9.png" width="520px"/>

## Node 应用程序

我们提供了一个简单的 NodeJS 应用程序以供入门。

```bash
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

## Docker 部署

```bash
# 如果使用 SQLite 的话
docker run -d --name nocodb \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
nocodb/nocodb:latest

# 如果使用 MySQL 的话
docker run -d --name nocodb-mysql \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest

# 如果使用 PostgreSQL 的话
docker run -d --name nocodb-postgres \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest

# 如果使用 MSSQL 的话
docker run -d --name nocodb-mssql \
-v "$(pwd)"/nocodb:/usr/app/data/ \
-p 8080:8080 \
-e NC_DB="mssql://host.docker.internal:1433?u=root&p=password&d=d1" \
-e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
nocodb/nocodb:latest
```

> 你可以通过在 0.10.6 以上的版本中挂载 `/usr/app/data/` 来持久化数据，否则你的数据会在重新创建容器后完全丢失。

> 如果你打算输入一些特殊字符，你可能需要在创建数据库时改变字符集和排序。请查看[MySQL Docker](https://github.com/nocodb/nocodb/issues/1340#issuecomment-1049481043)的例子。

## Docker Compose

我们在[这个目录](https://github.com/nocodb/nocodb/tree/master/docker-compose)下提供了不同的 docker-compose.yml 文件。下面是一些例子：

```bash
git clone https://github.com/nocodb/nocodb
# 如果使用 MySQL 的话
cd nocodb/docker-compose/mysql
# 如果使用 PostgreSQL 的话
cd nocodb/docker-compose/pg
# 如果使用 MSSQL 的话
cd nocodb/docker-compose/mssql
docker-compose up -d
```

> 你可以通过在 0.10.6 以上的版本中挂载 `/usr/app/data/` 来持久化数据，否则你的数据会在重新创建容器后完全丢失。

> 如果你打算输入一些特殊字符，你可能需要在创建数据库时改变字符集和排序。请查看[MySQL Docker Compose](https://github.com/nocodb/nocodb/issues/1313#issuecomment-1046625974)的例子。

# GUI

点击 [http://localhost:8080/dashboard](http://localhost:8080/dashboard) 打开仪表盘。

# 加入我们的社区

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<a href="https://community.nocodb.com/" target="_blank">
<img src="https://i2.wp.com/www.feverbee.com/wp-content/uploads/2018/07/logo-discourse.png" alt="">
</a>

# 截图

![1](https://user-images.githubusercontent.com/86527202/136066713-5408634f-5469-40eb-94c9-7eafae5e179c.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/168545293-b48a4237-8646-4f9a-a56b-56d5c55adc79.jpg)
<br>

![5](https://user-images.githubusercontent.com/86527202/136066734-3f25aecc-bb7e-4db7-81c4-00b368d799d3.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/168545527-3948125d-1640-4c07-ac80-15db9a85f66f.jpg)
<br>

![7](https://user-images.githubusercontent.com/86527202/168545772-dfbffe13-bcf6-4a49-8a10-1bc8a933d77e.jpg)
<br>

![8](https://user-images.githubusercontent.com/86527202/168545839-0ba950a4-400f-45b2-b2db-b22b1853af4a.jpg)
<br>

![9](https://user-images.githubusercontent.com/86527202/168545872-c2a4b63a-9dc9-4c12-add7-69d5f4d0a6e1.jpg)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136066745-9797775d-7db0-4681-ab10-d7ecbbd972ef.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136066750-7b566ec3-0983-47ed-9a4e-f895239f1ea4.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136066753-6dcda2cf-e7a3-4024-a897-f2b7044a64f4.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136066756-fc203c2c-570e-4514-b9f4-2a41ac24e5dd.png)
<br>

# 功能

### 丰富的电子表格功能

- ⚡ 基本操作：对表、列和行进行增删改查
- ⚡ 字段操作：排序、过滤、隐藏/取消隐藏列
- ⚡ 多种视图：网格（默认）、画廊和表单视图
- ⚡ 视图权限：协作视图和锁定的视图
- ⚡ 分享基础/视图：公开或私人（有密码保护）
- ⚡ 多种单元格类型：ID、链接到另一记录、查找、滚动、单行文本、附件、货币、公式等
- ⚡ 基于角色的访问控制：不同层次的精细化地控制访问
- ⚡ 以及更多......

### 工作流程自动化的应用商店

我们在三个主要类别中提供不同的集成。详见<a href="https://docs.nocodb.com/setup-and-usages/app-store" target="_blank">App Store</a>。

- ⚡ 聊天：Slack、Discord、Mattermost 等
- ⚡ 电子邮件: AWS SES，SMTP，MailerSend 等
- ⚡ 存储：AWS S3，Google Cloud Storage，Minio 等

### 使用 API 编程访问

我们提供以下方式让用户以编程方式调用操作。 您可以使用 Token（JWT 或 Social Auth）来签署您对 NocoDB 授权的请求。

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

### 架构同步

如果您在 NocoDB GUI 之外进行了更改，我们允许您同步架构更改。 但是，必须注意的是，您必须附有自己的迁移架构才能从一个环境迁移到其他环境。 有关详细信息，请参阅 <a href="https://docs.nocodb.com/setup-and-usages/sync-schema/" target="_blank">同步架构</a>。

### 审计

我们将所有用户操作日志保存在一起。 有关详细信息，请参阅 <a href="https://docs.nocodb.com/setup-and-usages/audit" target="_blank">审计</a>。

# 生产部署

默认情况下使用 SQLite 存储元数据。你也可以指定你自己的数据库。这个数据库的连接参数可以在 `NC_DB` 环境变量中指定。此外，我们还提供以下环境变量进行配置：

## 环境变量

参见[环境变量](https://docs.nocodb.com/getting-started/environment-variables)

# 开发

## 拉取项目

```shell
git clone https://github.com/nocodb/nocodb
cd nocodb
```
## 构建SDK

```shell
cd packages/nocodb-sdk
pnpm install
pnpm run build
```
## 本地运行后端

```shell
cd packages/nocodb
pnpm install
pnpm run watch:run
# 在浏览器中打开 localhost:8080/dashboard
```

## 本地运行前端

```shell
cd packages/nc-gui
pnpm install
pnpm run dev
# 在浏览器中打开 localhost:3000/dashboard
```

修改代码后会自动重新启动。

> nocodb/packages/nocodb 包括 nc-lib-gui，它是 pnpm 源中托管的 nc-gui 的预构建版本。如果您只想修改后端，则可以在本地启动后端后在浏览器中访问 localhost:8000/dashboard

# 贡献

参见[贡献指南](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# 我们为什么要做这个？

大多数互联网企业都为自己配备了电子表格或数据库来解决他们的业务需求。每天有十亿多人协作使用电子表格。然而，我们在数据库上以类似的效率工作还有很长的路要走，这些数据库在计算方面是更强大的工具。使用 SaaS 产品解决这个问题意味着可怕的访问控制、供应商锁定、数据锁定、突然的价格变化以及最重要的是未来可能出现的玻璃天花板。

# 我们的任务

我们的使命是为数据库提供最强大的无代码接口，并向世界上每一个互联网企业开放源代码。这不仅能让这个强大的计算工具开放给每个人，而且10亿或更多的人将会在互联网上拥有激进的修补和建设能力。
