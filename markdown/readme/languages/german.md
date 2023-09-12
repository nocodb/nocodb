<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ Die Open Source Airtable Alternative ✨ <br>

</h1>
<p align="center">
Verwandelt jeden MySQL, PostgreSQL, SQL Server, SQLite & MariaDB in eine Smart-Tabelle. 
</p>
<div align="center">
 
[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB) 
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Twitter](https://img.shields.io/twitter/url/https/twitter.com/NocoDB.svg?style=social&label=Follow%20%40NocoDB)](https://twitter.com/NocoDB)

</div>

<p align="center">
    <a href="http://www.nocodb.com"><b>Webseite</b></a> •
    <a href="https://discord.gg/5RgZmkW"><b>Discord</b></a> •
    <a href="https://twitter.com/nocodb"><b>Twitter</b></a> •
    <a href="https://www.reddit.com/r/NocoDB/"><b>Reddit</b></a> •
    <a href="https://docs.nocodb.com/"><b>Dokumentation</b></a>
</p>

![OpenSourceAirtableAlternative](https://user-images.githubusercontent.com/5435402/133762127-e94da292-a1c3-4458-b09a-02cd5b57be53.png)

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

<p align="center">
  <a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

# Schneller Versuch

### Verwenden von Docker

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB benötigt eine Datenbank zur Eingabe: Siehe [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- Fehlt diese Eingabe, wird auf SQLite zurückgegriffen. Um SQLite beständig zu machen, kann `/usr/app/data/` gemountet werden. 

  Beispiel:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### Verwenden von NPM 

```
npm install create-nocodb-app
```

### Verwenden von NPX 

```
npx create-nocodb-app
```

### Verwenden von Git

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


![1](https://user-images.githubusercontent.com/86527202/172082510-796fa257-a771-483b-a569-104037e99c50.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/155515258-3eea7e44-9616-4e63-b9da-c701c11b7a05.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/172082627-76be978c-0302-4057-990d-66967552237f.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/155515273-4f36b28f-8d36-4fe0-94e2-acd3e5020d91.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/155515277-fe434e7a-78bd-4f73-a78a-5a45c090e05a.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/155515280-3906823d-96b3-4e40-a2ec-c5aaec190891.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/155515287-63b898f4-b171-49fd-a33b-bb385df9dfb6.png)
<br>

![3](https://user-images.githubusercontent.com/86527202/172082602-919fc1aa-e5e8-42a7-9049-7b692b8ca8bf.png)
<br>

![4](https://user-images.githubusercontent.com/86527202/155515265-3a9228db-cc49-46d7-8fc9-3091571deb86.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/155515288-02cac9bd-1047-4725-b390-640f7ccab746.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/155515290-046a7cb9-e4d6-4ab6-a3f3-a27b256b3159.png)
<br>

# Merkmale

### Rich-Tabellenschnittstelle

- ⚡ Einfaches Suchen, Sortieren, Filtern und Ausblenden von Spalten
- ⚡ Ansichten erstellen: Gitter, Galerie, Kanban, Formular
- ⚡ Teilen von Ansichten: Öffentlich und passwortgeschützt
- ⚡ Persönliche und gesperrte Ansichten
- ⚡ Bilder in Zellen hochladen (funktioniert mit S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, Backraze) !!
- ⚡ Rollen: Eigentümer, Ersteller, Bearbeiter, Betrachter, Kommentator, Benutzerdefinierte Rollen.
- ⚡ Zugriffskontrolle: Feingliedrige Zugangskontrolle auch bei Datenbank-, Tabellen- und Spaltenebene.

### App-Store für Workflow-Automationen

- ⚡ Chat: Microsoft Teams, Slack, Discord, Mattermost
- ⚡ E-Mail: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ WhatsApp
- ⚡ Jede 3rd-Party-APIs

### Programmatischer API-Zugriff über

- ⚡ Rest APIs (Swagger)
- ⚡ Graphql-APIs
- ⚡ Enthält JWT-Authentifizierung & Social Auth
- ⚡ API-Tokens für die Integration mit Zapier, Integromat.

# Produktivaufbau

NocoDB erfordert eine Datenbank, um Metadaten von Tabellenansichten und externen Datenbanken zu speichern. Verbindungsparameter für diese Datenbank können in der Umgebungsvariablen `NC_DB` spezifiziert werden.

## Docker

#### Beispiel MySQL / MariaDB

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Beispiel PostgreSQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Beispiel MS SQL Server

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

Siehe [Environment variables](https://docs.nocodb.com/getting-started/environment-variables)

# Entwicklungsaufbau

## Projekt kopieren

```shell
git clone https://github.com/nocodb/nocodb
cd nocodb
```

## Backend lokal ausführen

```shell
cd packages/nocodb
pnpm install
pnpm run watch:run
# localhost:8080/dashboard im Browser aufrufen
```

## Frontend lokal ausführen

```shell
cd packages/nc-gui
pnpm install
pnpm run dev
# localhost:3000/dashboard iM Browser aufrufen
```

Änderungen am Code starten automatisch neu.

> nocodb/packages/nocodb enthält nc-lib-gui, die entwickelte Version von nc-gui, die in der npm-Registry gehostet wird. Sie können localhost:8000/dashboard im Browser aufrufen, nachdem Sie das Backend lokal gestartet haben, wenn Sie nur das Backend ändern möchten.

# Beiträge

Siehe [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Warum bauen wir das auf?

Die meisten Internet-Unternehmen verwenden entweder eine Tabellenkalkulation oder eine Datenbank, um ihre Geschäftsanforderungen zu erfüllen. Tabellenkalkulationen werden jeden Tag von mehr als einer Milliarde Menschen für die Zusammenarbeit genutzt. Wir sind jedoch weit davon entfernt, mit einer ähnlichen Geschwindigkeit an Datenbanken zu arbeiten, die weitaus leistungsfähigere Werkzeuge für die Datenverarbeitung sind. Versuche, dieses Problem mit SaaS-Angeboten zu lösen, bedeutete schreckliche Zugangskontrollen, Anbieterbindungen, Datenbindungen, plötzliche Preisänderungen und vor allem einen Blick in die Glaskugel, was in Zukunft möglich sein wird.

# Unsere Aufgabe

Unser Ziel ist es, die leistungsstärkste No-Code-Schnittstelle für Datenbanken, welche Open Source ist, für jedes einzelne Internet-Unternehmen in der Welt bereitzustellen. Dies würde nicht nur den Zugang zu einem leistungsstarken Computerwerkzeug demokratisieren, sondern auch mehr als eine Milliarde Menschen hervorbringen, die über radikale Bastel- und Konstruktionsfähigkeiten im Internet verfügen werden.
