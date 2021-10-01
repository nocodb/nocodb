<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB</a><br>
    </b>
    ✨ The Open Source Airtable Alternative ✨ <br>
</h1>

<p align="center">
Turns any MySQL, PostgreSQL, SQL Server, SQLite & MariaDB into a smart-spreadsheet.
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

<div align="center">

[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263434-75fe793d-42af-49e4-b964-d70920e41655.png">](markdown/readme/chinese.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263474-787d71e7-3a87-42a8-92a8-be1d1f55413d.png">](markdown/readme/french.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263531-fae58600-6616-4b43-95a0-5891019dd35d.png">](markdown/readme/german.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263589-3dbeda9a-0d2e-4bbd-b1fc-691404bb74fb.png">](markdown/readme/spanish.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263669-f567196a-d4e8-4143-a80a-93d3be32ba90.png">](markdown/readme/portuguese.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263707-ba4e04a4-268a-4626-91b8-048e572fd9f6.png">](markdown/readme/italian.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263770-38e3e79d-11d4-472e-ac27-ae0f17cf65c4.png">](markdown/readme/japanese.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263822-28fce9de-915a-44dc-962d-7a61d340e91d.png">](markdown/readme/korean.md)
[<img height="50" src="https://user-images.githubusercontent.com/61551451/135263888-151d4ad1-7084-4943-97c9-56f28cd40b80.png">](markdown/readme/russian.md)

</div>

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />


<a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>


# Quick try
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

### Using Docker
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> To persist data you can mount volume at `/usr/app/data/`.

### Using Npm
```
npx create-nocodb-app
```
### Using Git
```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI
Access Dashboard using : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# Join Our Community
<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>

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


# Features
### Rich Spreadsheet Interface
- ⚡ &nbsp;Search, sort, filter, hide columns with uber ease
- ⚡ &nbsp;Create Views : Grid, Gallery, Kanban, Gantt, Form
- ⚡ &nbsp;Share Views : public & password protected
- ⚡ &nbsp;Personal & locked Views 
- ⚡ &nbsp;Upload images to cells (Works with S3, Minio, GCP, Azure, DigitalOcean, Linode, OVH, BackBlaze)
- ⚡ &nbsp;Roles : Owner, Creator, Editor, Viewer, Commenter, Custom Roles.
- ⚡ &nbsp;Access Control : Fine-grained access control even at database, table & column level.

### App Store for workflow automations :
- ⚡ &nbsp;Chat : Microsoft Teams, Slack, Discord, Mattermost
- ⚡ &nbsp;Email : SMTP, SES, Mailchimp
- ⚡ &nbsp;SMS : Twilio
- ⚡ &nbsp;Whatsapp
- ⚡ &nbsp;Any 3rd Party APIs

### Programmatic API access via :
- ⚡ &nbsp;REST APIs (Swagger) 
- ⚡ &nbsp;GraphQL APIs.
- ⚡ &nbsp;Includes JWT Authentication & Social Auth
- ⚡ &nbsp;API tokens to integrate with Zapier, Integromat.

# Production Setup 
NocoDB requires a database to store metadata of spreadsheets views and external databases. 
And connection params for this database can be specified in `NC_DB` environment variable. 

## Docker 

#### Example MySQL
```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Example PostgreSQL
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
| Variable                             | Mandatory | Comments                                                                                                   | If absent                                     |
|--------------------------------------|-----------|------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| `NC_DB`                              | Yes       | See our database URLs                                                                                      | A local SQLite will be created in root folder |
| `DATABASE_URL`                       | No        | JDBC URL Format. Can be used instead of `NC_DB`. Used in 1-Click Heroku deployment                         |                                               |
| `DATABASE_URL_FILE`                  | No        | path to file containing JDBC URL Format. Can be used instead of `NC_DB`. Used in 1-Click Heroku deployment |                                               |
| `NC_PUBLIC_URL`                      | Yes       | Used for sending Email invitations                                                                         | Best guess from http request params           |
| `NC_AUTH_JWT_SECRET`                 | Yes       | JWT secret used for auth and storing other secrets                                                         | A Random secret will be generated             |
| `NC_SENTRY_DSN`                      | No        | For Sentry monitoring                                                                                      |                                               |
| `NC_CONNECT_TO_EXTERNAL_DB_DISABLED` | No        | Disable Project creation with external database                                                            |                                               |
| `NC_DISABLE_TELE`                    | No        | Disable telemetry                                                                                          |                                               |
| `NC_BACKEND_URL`                     | No        | Custom Backend URL                                                                                         | ``http://localhost:8080`` will be used        |

# Development setup 
```shell
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

# 🎯 Why are we building this?
Most internet businesses equip themselves with either spreadsheet or a database to solve their business needs. Spreadsheets are used by a Billion+ humans collaboratively every single day. However, we are way off working at similar speeds on databases which are way more powerful tools when it comes to computing. Attempts to solve this with SaaS offerings has meant horrible access controls, vendor lockin, data lockin, abrupt price changes & most importantly a glass ceiling on what's possible in future.

# ❤ Our Mission :
Our mission is to provide the most powerful no-code interface for databases which is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on internet. 

# Contributors : 🌻🌻🌻🐝🐝 
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
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->




