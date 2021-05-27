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
    <img src="/static/open-source-airtable-alternative/OpenSourceAirtableAlternative.png" width="100%">
    <br/><br/>
</p>

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
docker run -p 8080:8080 nocodb/nocodb
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
npm run dev
```



# Join Community
<a href="https://discord.gg/5RgZmkW">
    <img 
    src="https://invidget.switchblade.xyz/5RgZmkW" 
    alt="Join NocoDB : Free & Open Source Airtable Alternative"
    >
</a>
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
And environment `NC_DB` decides 

## Docker 

#### Example MySQL
```
docker run -p 8080:8080 -e NC_DB="mysql://host:port?u=user&p=password&d=database" nocodb/nocodb
```

#### Example Postgres
```
docker run -p 8080:8080 -e NC_DB="pg://host:port?u=user&p=password&d=database" nocodb/nocodb
```

#### Example SQL Server
```
docker run -p 8080:8080 -e NC_DB="mssql://host:port?u=user&p=password&d=database" nocodb/nocodb
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


# Our Mission : ❤ 
Our mission is to provide the most powerful no-code tool as open source to every single internet business in the world
 which would not only democratise database-and-api access but also bring forth a revolution where a billion+ people will have tinkering-and-building abilities on internet. 

# Contributors : 🌻🌻🌻🐝🐝 
[//]: contributor-faces
<a href="https://github.com/o1lab"><img src="https://avatars.githubusercontent.com/u/5435402?v=4" title="Naveen MR" width="50" height="50"></a>
<a href="https://github.com/pranavxc"><img src="https://avatars.githubusercontent.com/u/61551451?v=4" title="Pranav C Balan" width="50" height="50"></a>


- - - - - - -

Website
Github

PH : Images
HN
Blog
Readme
License
Roadmap
Links 
FAQ
1-Click
Template


```js
(async () => {
    const app = require('express')();
    const {Noco} = require("nocodb");
    app.use(await Noco.init({}));
    app.listen(process.env.PORT);
})()
```