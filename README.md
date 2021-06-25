<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
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

<p align="center">
    <img src="static/open-source-airtable-alternative/OpenSourceAirtableAlternative.png" width="100%">
    <br/><br/>
</p>

<a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

# Quick try
### 1-Click Deploy
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
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb
```

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
    <img 
    src="https://invidget.switchblade.xyz/5RgZmkW" 
    alt="Join NocoDB : Free & Open Source Airtable Alternative"
    >
</a>
<br>

# Screenshots
<img src="static/nocodb/2.png"/>
<br>
<img src="static/nocodb/1.png"/>
<br>
<img src="static/nocodb/7.png"/>
<br>
<img src="static/nocodb/5.png"/>
<br>
<img src="static/nocodb/6.png"/>
<br>
<img src="static/nocodb/3.png"/>
<br>
<img src="static/nocodb/4.png"/>
<br>
<img src="static/nocodb/11.png"/>
<br>
<img src="static/nocodb/10.png"/>
<br>
<img src="static/nocodb/8.png"/>
<br>
<img src="static/nocodb/9.png"/>
<br>





# Features
### Rich Spreadsheet Interface
- ⚡ &nbsp;Search, sort, filter, hide columns with uber ease
- ⚡ &nbsp;Create Views : Grid, Gallery, Kanban, Gantt, Form
- ⚡ &nbsp;Share Views : public & password protected
- ⚡ &nbsp;Personal & locked Views 
- ⚡ &nbsp;Upload images to cells (Works with S3, Minio, GCP, Azure, DigitalOcean, Linode, OVH, BackBlaze)!!
- ⚡ &nbsp;Roles : Owner, Creator, Editor, Commenter, Viewer, Commenter, Custom Roles.
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
    nocodb/nocodb
```

#### Example Postgres
```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb
```

#### Example SQL Server
```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb
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
| NC_PUBLIC_URL           | Yes       | Used for sending Email invitations                   | Best guess from http request params        |
| NC_AUTH_JWT_SECRET      | Yes       | JWT secret used for auth and storing other secrets                               | A Random secret will be generated          |
| NC_SENTRY_DSN           | No        | For Sentry monitoring                                                     |   |
| NC_CONNECT_TO_EXTERNAL_DB_DISABLED | No | Disable Project creation with external database                              |   |
| NC_DISABLE_TELE | No | Disable telemetry                              |   |
| NC_BACKEND_URL | No | Custom Backend URL                              | ``http://localhost:8080`` will be used  |

# Running locally 
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

# Contributing
- Please take a look at ./contribute/HowToApplyLicense.md 
- Ignore adding headers for .json or .md or .yml   

# 🎯  Why are we building this ?
Most internet businesses equip themselves with either spreadsheet or a database to solve their business needs. Spreadsheets are used by a Billion+ humans collaboratively every single day. However, we are way off working at similar speeds on databases which are way more powerful tools when it comes to computing. Attempts to solve this with SaaS offerings has meant horrible access controls, vendor lockin, data lockin, abrupt price changes & most importantly a glass ceiling on what's possible in future.

# ❤ Our Mission :  
Our mission is to provide the most powerful no-code interface for databases which is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on internet. 

# Contributors : 🌻🌻🌻🐝🐝 
[//]: contributor-faces
<a href="https://github.com/o1lab"><img src="https://avatars.githubusercontent.com/u/5435402?v=4" title="Naveen MR" width="50" height="50"></a>
<a href="https://github.com/pranavxc"><img src="https://avatars.githubusercontent.com/u/61551451?v=4" title="Pranav C Balan" width="50" height="50"></a>
<a href="https://github.com/bvkatwijk"><img src="https://avatars.githubusercontent.com/u/18490578?s=60&v=4" title="bvkatwijk" width="50" height="50"></a>
<a href="https://github.com/markuman"><img src="https://avatars.githubusercontent.com/u/3920157?s=60&v=4" title="markuman" width="50" height="50"></a>
<a href="https://github.com/DanielRuf"><img src="https://avatars.githubusercontent.com/u/827205?s=60&v=4" title="DanielRuf" width="50" height="50"></a>
<a href="https://github.com/bertyhell"><img src="https://avatars.githubusercontent.com/u/1710840?s=60&v=4" title="bertyhell" width="50" height="50"></a>
<a href="https://github.com/chocholand"><img src="https://avatars.githubusercontent.com/u/6572227?s=60&v=4" title="chocholand" width="50" height="50"></a>
<a href="https://github.com/0xflotus"><img src="https://avatars.githubusercontent.com/u/26602940?s=60&v=4" title="0xflotus" width="50" height="50"></a>
<a href="https://github.com/sguionni"><img src="https://avatars.githubusercontent.com/u/3633017?s=60&v=4" title="sguionni" width="50" height="50"></a>
<a href="https://github.com/extremeshok"><img src="https://avatars.githubusercontent.com/u/5957328?s=60&v=4" title="extremeshok" width="50" height="50"></a>
<a href="https://github.com/v2io"><img src="https://avatars.githubusercontent.com/u/48987429?s=60&v=4" title="v2io" width="50" height="50"></a>
<a href="https://github.com/soaserele"><img src="https://avatars.githubusercontent.com/u/1093368?s=60&v=4" title="soaserele" width="50" height="50"></a>
<a href="https://github.com/ans-4175"><img src="https://avatars.githubusercontent.com/u/3961872?s=60&v=4" title="ans-4175" width="50" height="50"></a>
<a href="https://github.com/lotas"><img src="https://avatars.githubusercontent.com/u/83861?s=60&v=4" title="lotas" width="50" height="50"></a>
<a href="https://github.com/ferrybig"><img src="https://avatars.githubusercontent.com/u/1576684?s=60&v=4" title="ferrybig" width="50" height="50"></a>
<a href="https://github.com/jrevault"><img src="https://avatars.githubusercontent.com/u/1001585?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/atilacamurca"><img src="https://avatars.githubusercontent.com/u/508624?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/simonbowen"><img src="https://avatars.githubusercontent.com/u/8931?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/0xflotus"><img src="https://avatars.githubusercontent.com/u/26602940?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/wingkwong"><img src="https://avatars.githubusercontent.com/u/35857179?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/ferdiga"><img src="https://avatars.githubusercontent.com/u/6248560?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/Flatroy"><img src="https://avatars.githubusercontent.com/u/4980165?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/jwillmer"><img src="https://avatars.githubusercontent.com/u/1503577?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/bhanuc"><img src="https://avatars.githubusercontent.com/u/2958857?v=4" title="" width="50" height="50"></a>
<a href="https://github.com/jwetzell"><img src="https://avatars.githubusercontent.com/u/18341515?s=60&v=4" title="" width="50" height="50"></a>
<a href="https://github.com/SebGTx"><img src="https://avatars.githubusercontent.com/u/8062146?v=4" title="" width="50" height="50"></a>


- - - - - - -


