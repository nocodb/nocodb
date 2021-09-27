<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ Die Open Source Airtable Alternative ✨ <br>

</h1>
<p align="center">
Verwandelt jeden MySQL, PostgreSQL, SQL Server, SQLite & Mariadb in eine Smart-Tabelle. 
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


# Schneller Try.
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

### Verwenden von Docker.
```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> To persist data you can mount volume at `/usr/app/data/`.

### Verwenden von NPM.
```
npx create-nocodb-app
```
### Mit git.
```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Zugriff auf dashardboard mit. : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)


# Tritt unserer Gemeinschaft bei
<a href="https://discord.gg/5RgZmkW">
    <img 
    src="https://invidget.switchblade.xyz/5RgZmkW" 
    alt="Join NocoDB : Free & Open Source Airtable Alternative"
    >
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









# Merkmale

### Rich-Tabellenschnittstelle

Suchen, sortieren, filtern, Spalten mit Uber-Leichtigkeit ausblenden
⚡ Ansichten erstellen: Gitter, Galerie, Kanban, Gantt, Form
⚡ Teilen Ansichten: Öffentliche und Passwort geschützt
⚡ Persönliche und gesperrte Ansichten
⚡ Laden Sie Bilder in Zellen hoch (arbeitet mit S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backraze) !!
⚡ Rollen: Besitzer, Ersteller, Herausgeber, Kommentator, Viewer, Kommentator, benutzerdefinierte Rollen.
⚡ Zugriffskontrolle: Feinkörnig Zugangskontrolle auch bei Datenbank-, Tabellen- und Spaltenebene.

### App Store für Workflow-Automationen:
⚡ Chat: Microsoft-Teams, Slack, Discord, Materie
⚡ E-Mail: SMTP, SES, MailChimp
⚡ SMS: TWILIO
⚡ WhatsApp.
⚡ Jede 3rd-Party-APIs

### Programmatischer API-Zugriff über:
⚡ Rest APIs (Swagger)
⚡ Graphql-APIs.
⚡ Enthält die JWT-Authentifizierung & Social Auth
⚡ API-Token, um mit Zapier, Integromat zu integrieren.


# Production Setup 
NOCODB erfordert eine Datenbank zum Speichern von Metadaten von Tabellenkalkulationen und externen Datenbanken. Und Verbindungsparams für diese Datenbank können in der Umgebungsvariablen der NC_DB angegeben werden.


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

# 🎯 Warum bauen wir das auf?
Die meisten Internet-Unternehmen rüsten sich mit einer Tabelle oder einer Datenbank aus, um ihre Geschäftsanforderungen zu lösen. Die Tabellenkalkulationen werden von einer Milliarde + Menschen mit einem jeden Tag kollaborativ verwendet. Wir arbeiten jedoch mit ähnlichen Geschwindigkeiten in Datenbanken, die in Bezug auf das Berechnen viel stärkere Werkzeuge sind. Versuche, dies mit SaAs-Angeboten zu lösen, bedeutete schreckliche Zugangskontrollen, Anbieter-Lockin, Daten-Lockin, abrupte Preisänderungen und vor allem eine Glasdecke, die in Zukunft möglich ist.

# ❤ Unsere Aufgabe :
Unsere Mission ist es, die leistungsstärkste No-Code-Schnittstelle für Datenbanken bereitzustellen, die für jedes einzelne Internetgeschäft der Welt offen ist. Dies würde nicht nur den Zugang zu einem leistungsstarken Computing-Tool demokratisieren, sondern auch eine Milliarde + Menschen hervorbringen, die im Internet radikale Bastel- und Baufähigkeiten haben werden. 

