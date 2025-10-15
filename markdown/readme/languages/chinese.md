<h1 align="center" style="border-bottom: none">
    <div>
        <a style="color:#36f" href="https://www.nocodb.com">
            <img src="/packages/nc-gui/assets/img/brand/nocodb-full.png" height="80" />
            <br>
    Airtable 的开源替代软件 
        </a>
        <br>
    </div>
</h1>

<p align="center">
NocoDB 是构建在线数据库最快且最简单的方式。
</p>


<p align="center">
    <a href="http://www.nocodb.com"><b>网站</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://community.nocodb.com/"><b>社区</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>文档</b></a>
</p>

![video avi](https://github.com/nocodb/nocodb/assets/86527202/e2fad786-f211-4dcb-9bd3-aaece83a6783)

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

<p align="center"><a href="markdown/readme/languages/README.md"><b> 查看其他语言 »</b></a></p>

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

# 加入我们的社区

<a href="https://discord.gg/5RgZmkW" target="_blank">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

[![@nocodb/nocodb 项目关注者列表](http://reporoster.com/stars/nocodb/nocodb)](https://github.com/nocodb/nocodb/stargazers)

# 安装

## 使用 SQLite 的 Docker 部署

```bash 
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  nocodb/nocodb:latest
  ```

## 使用 PostgreSQL 的 Docker 部署

```bash
docker run -d \
  --name noco \
  -v "$(pwd)"/nocodb:/usr/app/data/ \
  -p 8080:8080 \
  -e NC_DB="pg://host.docker.internal:5432?u=root&p=password&d=d1" \
  -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
  nocodb/nocodb:latest
```

## 自动安装升级
自动安装升级指令是一个在服务器上部署生产可用的 NocoDB 的单一命令。
在幕后，它会为你自动生成 docker-compose 文件。

```bash
bash <(curl -sSL http://install.nocodb.com/noco.sh) <(mktemp)
```

自动安装升级执行以下操作：🕊
- 🐳 自动安装所有的依赖软件，如 docker、docker-compose
- 🚀 使用 Docker Compose 自动安装带有 PostgreSQL、Redis、Minio、Traefik 网关的 NocoDB。 🐘 🗄️ 🌐
- 🔄 当您再次运行该命令时，会自动将 NocoDB 升级到最新版本。
- 🔒 自动配置并续订 SSL 证书。在安装时需要输入域名或子域名。

> install.nocodb.com/noco.sh 脚本可以在 [我们的 github](https://raw.githubusercontent.com/nocodb/nocodb/develop/docker-compose/1_Auto_Upstall/noco.sh) 中找到

## 其他方式

> 二进制文件仅用于本地快速测试。

| 安装方式                          | 安装命令                                                                                          |
|-------------------------------|-----------------------------------------------------------------------------------------------|
| 🍏 MacOS arm64 <br>(二进制文件)    | `curl http://get.nocodb.com/macos-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`          |
| 🍏 MacOS x64 <br>(二进制文件)     | `curl http://get.nocodb.com/macos-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`            |
| 🐧 Linux arm64 <br>(二进制文件)   | `curl http://get.nocodb.com/linux-arm64 -o nocodb -L && chmod +x nocodb && ./nocodb`          |
| 🐧 Linux x64 <br>(二进制文件)     | `curl http://get.nocodb.com/linux-x64 -o nocodb -L && chmod +x nocodb && ./nocodb`            |
| 🪟 Windows arm64 <br>(二进制文件) | `iwr http://get.nocodb.com/win-arm64.exe -OutFile Noco-win-arm64.exe && .\Noco-win-arm64.exe` |
| 🪟 Windows x64 <br>(二进制文件)   | `iwr http://get.nocodb.com/win-x64.exe -OutFile Noco-win-x64.exe && .\Noco-win-x64.exe`       |

> 本地运行时通过此地址访问 nocodb: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

更多安装方法，请参考 [我们的文档](https://docs.nocodb.com/category/installation)

# 截图

![2](https://github.com/nocodb/nocodb/assets/86527202/a127c05e-2121-4af2-a342-128e0e2d0291)
![3](https://github.com/nocodb/nocodb/assets/86527202/674da952-8a06-4848-a0e8-a7b02d5f5c88)
![4](https://github.com/nocodb/nocodb/assets/86527202/cbc5152a-9caf-4f77-a8f7-92a9d06d025b)
![5](https://github.com/nocodb/nocodb/assets/86527202/dc75dfdc-c486-4f5a-a853-2a8f9e6b569a)

![5](https://user-images.githubusercontent.com/35857179/194844886-a17006e0-979d-493f-83c4-0e72f5a9b716.png)
![7](https://github.com/nocodb/nocodb/assets/86527202/be64e619-7295-43e2-aa95-cace4462b17f)
![8](https://github.com/nocodb/nocodb/assets/86527202/4538bf5a-371f-4ec1-a867-8197e5824286)

![8](https://user-images.githubusercontent.com/35857179/194844893-82d5e21b-ae61-41bd-9990-31ad659bf490.png)
![9](https://user-images.githubusercontent.com/35857179/194844897-cfd79946-e413-4c97-b16d-eb4d7678bb79.png)
![10](https://user-images.githubusercontent.com/35857179/194844902-c0122570-0dd5-41cf-a26f-6f8d71fefc99.png)
![11](https://user-images.githubusercontent.com/35857179/194844903-c1e47f40-e782-4f5d-8dce-6449cc70b181.png)
![12](https://user-images.githubusercontent.com/35857179/194844907-09277d3e-cbbf-465c-9165-6afc4161e279.png)

# 功能

### 丰富的电子表格功能

- ⚡ &nbsp;基本操作：对表、列和行进行增删改查
- ⚡ &nbsp;字段操作：排序，过滤，分组，隐藏/取消隐藏列
- ⚡ &nbsp;多种视图类型：网格（默认）、画廊、表单、看板和日历视图
- ⚡ &nbsp;视图权限：协作视图和锁定视图
- ⚡ &nbsp;分享基础库/视图：公开或私人（有密码保护）
- ⚡ &nbsp;多种单元格类型：ID，链接，查找，汇总，单行文本，附件，货币，公式，用户等
- ⚡ &nbsp;基于角色的访问控制：不同级别的细粒度访问控制
- ⚡ &nbsp;等其他功能......

### 支持工作流程自动化的应用商店

我们在三个主要类别中提供不同的集成。详见 <a href="https://docs.nocodb.com/account-settings/oss-specific-details/#app-store" target="_blank">App Store</a>。

- ⚡ &nbsp;聊天：Slack、Discord、Mattermost 等
- ⚡ &nbsp;电子邮件: AWS SES，SMTP，MailerSend 等
- ⚡ &nbsp;存储：AWS S3，Google Cloud Storage，Minio 等

### 通过编程访问

我们为用户提供下列所述的编程调用方法。你可以使用 token（JWT 或 Social Auth）来对你的请求进行签名，从而获得对 NocoDB 的认证。

- ⚡ &nbsp;REST APIs
- ⚡ &nbsp;NocoDB SDK

# 贡献

请参考 [贡献指南](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# 我们为什么要构建此软件？

大多数互联网企业都会使用电子表格或数据库来满足业务需求。如今，全球有超过十亿人每天都在协作使用电子表格。然而，当我们面对计算能力更强大的数据库时，工作的效率却远远无法与之相比。 过去，人们试图通过 SaaS 方案来弥补这一差距，但结果往往是：糟糕的访问控制、供应商的锁定、数据的绑定、价格的骤然变化，最重要的是限制未来可能性的玻璃天花板。

# 我们的使命

我们的使命是为世界上每一个互联网企业提供最强大的开源数据库无代码界面。这不仅可以使人们能够使用强大的计算工具，而且也会带来数十亿的具有激进修补和构建能力的人。

# 许可证

<p>
本项目采用 <a href="./LICENSE">AGPLv3</a> 许可证。
</p>

# 贡献者

感谢您的贡献！我们感谢社区的所有贡献。

<a href="https://github.com/nocodb/nocodb/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nocodb/nocodb" />
</a>
