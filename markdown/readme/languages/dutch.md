<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ Het open source Airtable alternatief ✨ <br>

</h1>
<p align="center">
Draait elke MySQL, PostgreSQL, SQL Server, SQLITE & MARIADB in een Smart-Spreadsheet. 
</p>
<div align="center">

[![Build Status](https://travis-ci.org/dwyl/esta.svg?branch=master)](https://travis-ci.com/github/NocoDB/NocoDB)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2014.18.0-brightgreen)](http://nodejs.org/download/)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-green.svg)](https://conventionalcommits.org)

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

# Snel proberen

### Docker gebruiken

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- If this input is absent, we fallback to SQLite. In order too persist sqlite, you can mount `/usr/app/data/`. 

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### Gebruik van NPM

```
npx create-nocodb-app
```

### Git gebruiken

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Toegang tot dashboard met behulp van : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# sluit je aan bij onze gemeenschap

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>

# Screenshots

![1](https://user-images.githubusercontent.com/86527202/136073796-3a7e14b3-74a3-484f-812c-2885f3e50245.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136073805-40b59a3f-8156-4cc7-8d5c-dfd611a7785e.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136073808-27f211b6-eaf9-4162-961d-f0d1a4cf6db7.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136073811-515405fe-ae36-44c4-adf7-7d400c5a3705.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136073813-2a95e935-2632-4516-8eed-15d1a9b8437e.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136073815-830941bb-c534-42f0-8a2a-37a6220c5f57.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136073816-a0875c02-f6e5-4b44-83a4-333a03b8c7a3.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136073818-99a0602b-e49d-41b6-bba5-389a4997d504.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136073821-84cdd755-3753-43ce-a00f-a138cae11797.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136073823-03a76b37-e72b-4499-9925-a8ee24ce7053.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136073826-561f9a17-8d68-4c7a-830d-1e40e0892246.png)
<br>

# Functies

### Rich Spreadsheet Interface

- ⚡ Zoeken, sorteren, filteren, kolommen verbergen met uber gemak
- ⚡ Weergaven creëren: Grid, Gallery, Kanban, Form
- ⚡ Delen Bekeken: Publiek en wachtwoord beveiligd
- ⚡ Persoonlijke en vergrendelde meningen
- ⚡ Upload afbeeldingen naar cellen (werkt met S3, Minio, GCP, Azure, Digitalocean, Linode, Ovh, Backblaze) !!
- ⚡ Rollen: Eigenaar, Schepper, Editor, Commentator, Viewer, Commentator, Aangepaste rollen.
- ⚡ Toegangscontrole: fijnkorrelige toegangscontrole, zelfs bij database, tabel- en kolomniveau.

### App Store voor Workflow Automations:

- ⚡ Chat: Microsoft-teams, Slack, Discord, Meet
- ⚡ E-mail: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ WhatsApp
- ⚡ elke 3e partij-API's

### Programmatische API-toegang via:

- ⚡ Rust API's (Swagger)
- ⚡ Grafiek API's.
- ⚡ Inclusief JWT-authenticatie en sociale auth
- ⚡ API-tokens om te integreren met zapier, integromat.

# Production Setup

NOCODB vereist een database om metadata van spreadsheets weergaven en externe databases op te slaan. En verbindingsparamumenten voor deze database kunnen worden opgegeven in de variabele NC_DB-omgeving.

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
cd nocodb
cd docker-compose
cd mysql or pg or mssql
docker-compose up -d
```

## Environment variables

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/environment-variables)

# Development setup

Please refer to [Development Setup](https://docs.nocodb.com/engineering/development-setup)

# Contributing

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Waarom bouwen we dit?

De meeste internetbedrijven stellen zich uit met een spreadsheet of een database om hun bedrijfsbehoeften op te lossen. Spreadsheets worden gebruikt door een miljard + mensen die elke dag samenwerken. We zijn echter ver weg bij vergelijkbare snelheden op databases die veel krachtigere hulpmiddelen zijn als het gaat om het berekenen. Pogingen om dit op te lossen met SaaS-aanbiedingen heeft verschrikkelijke toegangscontroles, leverancierslongin, gegevensvergrendeling, abrupte prijsveranderingen en vooral een glazen plafond op wat in de toekomst mogelijk is.

# Onze missie

Onze missie is om de krachtigste NO-CODE-interface voor databases te bieden die open source is voor elke afzonderlijke internetactiviteiten in de wereld. Dit zou niet alleen de toegang tot een krachtige rekengereedschap democratiseren, maar ook een miljard + mensen voortbrengen die radicaal tinkerende en bouwmogelijkheden op internet hebben.
