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
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Documentation</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# Schneller Try

### 1-Click Deploy

#### Heroku

<a href="https://heroku.com/deploy?template=https://github.com/nocodb/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>
<br>

### Verwenden von Docker

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- If this input is absent, we fallback to SQLite. In order too persist sqlite, you can mount `/usr/app/data/`. 

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v /local/path:/usr/app/data/ nocodb/nocodb:latest
  ```

### Verwenden von NPM

```
npx create-nocodb-app
```

### Mit git

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Zugriff auf Dashboard mit. : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Tritt unserer Gemeinschaft bei

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# Screenshots

![1](https://user-images.githubusercontent.com/86527202/136068605-191df0d6-ba40-4500-aa82-84f369dff184.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136068612-6dcc8fb6-eff0-42d7-8196-db0b280bd49d.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136068615-0d8aa363-e197-4b9d-b81a-0f7a6030635c.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136068618-f6443b58-0458-4e87-a358-f1bffcc44936.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136068620-1f6f7aec-79e5-43a7-9ad5-65e1fc48d297.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136068624-7d37104a-87ce-442c-a038-e23fb40966e3.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136068627-938f9bc9-194e-44e4-a040-bd33649aca35.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136068629-7d341076-a73a-4964-bec8-68e4dd91828e.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136068630-60f799a5-d43f-4aaa-8f7c-9f077ee13fa8.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136068633-e7e2c8ab-610e-4fab-9bc1-737c45182125.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136068635-d9ac5165-7800-402d-b4e3-2e21d3d36027.png)
<br>

# Merkmale

### Rich-Tabellenschnittstelle

- ⚡ Suchen, sortieren, filtern, Spalten mit Uber-Leichtigkeit ausblenden
- ⚡ Ansichten erstellen: Gitter, Galerie, Kanban, Form
- ⚡ Teilen von Ansichten: Öffentliche und Passwort geschützt
- ⚡ Persönliche und gesperrte Ansichten
- ⚡ Laden Sie Bilder in Zellen hoch (funktioniert mit S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backraze) !!
- ⚡ Rollen: Besitzer, Ersteller, Herausgeber, Kommentator, Viewer, Kommentator, benutzerdefinierte Rollen.
- ⚡ Zugriffskontrolle: Granulare Zugangskontrolle auch bei Datenbank-, Tabellen- und Spaltenebene.

### App Store für Workflow-Automationen

- ⚡ Chat: Microsoft-Teams, Slack, Discord, Materie
- ⚡ E-Mail: SMTP, SES, MailChimp
- ⚡ SMS: TWILIO
- ⚡ WhatsApp.
- ⚡ Jede 3rd-Party-APIs

### Programmatischer API-Zugriff über

- ⚡ Rest APIs (Swagger)
- ⚡ Graphql-APIs.
- ⚡ Enthält die JWT-Authentifizierung & Social Auth
- ⚡ API-Token, um mit Zapier, Integromat zu integrieren.

# Produktionseinrichtung

NOCODB erfordert eine Datenbank zum Speichern von Metadaten, Tabellenkalkulationen und externen Datenbanken. Verbindungsparameter für diese Datenbank können in der Umgebungsvariablen der NC_DB angegeben werden.

## Docker

#### Beispiel MySQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Beispiel Postgres

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Beispiel SQL Server

```
docker run -d -p 8080:8080 \
    -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

## Docker Compose

```
git clone https://github.com/nocodb/nocodb
cd nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up -d
```

## Umgebungsvariablen

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/installation#environment-variables)

# Entwicklungsaufbau

Please refer to [Development Setup](https://github.com/nocodb/nocodb/tree/master#development-setup)

# Beitragen

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Warum bauen wir das auf?

Die meisten Internet-Unternehmen rüsten sich mit einer Tabelle oder einer Datenbank aus, um ihre Geschäftsanforderungen zu lösen. Die Tabellenkalkulationen werden von einer Milliarde + Menschen mit einem jeden Tag kollaborativ verwendet. Wir arbeiten jedoch mit ähnlichen Geschwindigkeiten in Datenbanken, die in Bezug auf das Berechnen viel stärkere Werkzeuge sind. Versuche, dies mit SaaS-Angeboten zu lösen, bedeutete schreckliche Zugangskontrollen, Anbieter-Lockin, Daten-Lockin, abrupte Preisänderungen und vor allem eine Glaskugel, was in Zukunft möglich ist.

# Unsere Aufgabe

Unsere Mission ist es, die leistungsstärkste No-Code-Schnittstelle für Datenbanken bereitzustellen, die für jedes einzelne Internetgeschäft der Welt nutzbar ist. Dies würde nicht nur den Zugang zu einem leistungsstarken Computing-Tool demokratisieren, sondern auch eine Milliarde + Menschen hervorbringen, die im Internet radikale Bastel- und Baufähigkeiten haben werden.
