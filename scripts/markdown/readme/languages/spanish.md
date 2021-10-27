<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ La alternativa de código abierto Airtable ✨ <br>

</h1>
<p align="center">
Convierte cualquier MySQL, PostgreSQL, SQL Server, SQLite y Mariadb en una hoja de cálculo inteligente. 
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

<a href="https://www.producthunt.com/posts/nocodb?utm_source=badge-featured&utm_medium=badge&utm_souce=badge-nocodb" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=297536&theme=dark" alt="NocoDB - The Open Source Airtable alternative | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>

# Intento rápido

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

### Usando docker

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

> To persist data you can mount volume at `/usr/app/data/`.

### Usando npm.

```
npx create-nocodb-app
```

### Usando git.

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Tablero de acceso de acceso usando : [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Únete a nuestra comunidad

<a href="https://discord.gg/5RgZmkW">
<img src="https://discordapp.com/api/guilds/661905455894888490/widget.png?style=banner3" alt="">
</a>
<br>
<br>

# Capturas de pantalla

![1](https://user-images.githubusercontent.com/86527202/136071158-4eaf1670-085e-435b-a2ef-cd7a90241ad4.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136071168-eb20d405-0b98-43ed-9033-510fbe8d87ab.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136071175-d28d33a1-4ffe-4d50-ad22-cf4787d98ae1.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136071177-911285df-f0ea-4b52-a17b-63421c6d2129.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136071180-99c3400b-9674-4124-9618-3273c4099d59.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136071183-40005b11-727f-4f11-b6b5-402900e33d14.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136071185-3ee9c9ad-b6e9-4579-aad8-55a76c2eb1b3.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136071188-61fc67a0-56bb-48a0-8984-f3860d52d572.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136071193-7b7da5cd-c0b3-4258-81c6-35c485cd69da.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136071197-6914e6ef-4a27-49a8-be27-72abae5c595b.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136071198-ea7994a7-82ca-4d2a-9026-71cdc38883b4.png)
<br>

# Características

### Interfaz de hoja de cálculo rica

- ⚡ Buscar, ordenar, filtrar, ocultar columnas con la facilidad de Uber
- ⚡ Crear vistas: Grid, Galería, Kanban, Gantt, Forma
- ⚡ Compartir Vistas: Publicas & Protegidas por contraseña
- ⚡ Vistas personales y cerradas
- ⚡ Sube imágenes en celdas (funciona con S3, Minio, GCP, Azure, DigitalCean, Linode, OVH, BackBlaze) !!
- ⚡ Roles: Propietario, Creador, Editor, Comentarista, Visor, Comentarista, Roles personalizados.
- ⚡ Control de acceso: Control de acceso de grano fino Incluso en la base de datos, la tabla y el nivel de columna.

### App Store para Workflow Automations:

- ⚡ Chat: Microsoft Equips, Slack, Discord, MOSE
- ⚡ Correo electrónico: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ whatsapp
- ⚡ Cualquier API de terceros

### Acceso a API programático a través de:

- ⚡ APIES DE RESTIDO (SWAGGERS)
- ⚡ GRAPHQL APIES.
- ⚡ Incluye Autenticación JWT y AUTE SOCIAL
- ⚡ Tokens API para integrarse con Zapier, Integromat.

# Production Setup

Nocodb requiere una base de datos para almacenar metadatos de vistas a las hojas de cálculo y bases de datos externas. Y los parámetros de conexión para esta base de datos se pueden especificar en la variable de entorno NC_DB.

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

## Variables de entorno

| Variable                           | Obligatorio | Comentarios                                                                                              | If absent                                     |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| NC_DB                              | Si          | Ver nuestras URLs de bases de datos                                                                      | A local SQLite will be created in root folder |
| DATABASE_URL                       | No          | JDBC URL Format. Can be used instead of NC_DB. Used in 1-Click Heroku deployment                         |                                               |
| DATABASE_URL_FILE                  | No          | path to file containing JDBC URL Format. Can be used instead of NC_DB. Used in 1-Click Heroku deployment |                                               |
| NC_PUBLIC_URL                      | Si          | Used for sending Email invitations                                                                       | Best guess from http request params           |
| NC_AUTH_JWT_SECRET                 | Si          | JWT secret used for auth and storing other secrets                                                       | A Random secret will be generated             |
| NC_SENTRY_DSN                      | No          | For Sentry monitoring                                                                                    |                                               |
| NC_CONNECT_TO_EXTERNAL_DB_DISABLED | No          | Disable Project creation with external database                                                          |                                               |
| NC_DISABLE_TELE                    | No          | Disable telemetry                                                                                        |                                               |
| NC_BACKEND_URL                     | No          | Custom Backend URL                                                                                       | `http://localhost:8080` will be used          |

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

## Correr los tests de Cypress localmente

```shell
# install dependencies(cypress)
npm install

# run mysql database with required database using docker compose
docker-compose -f ./scripts/docker-compose-cypress.yml up

# Run backend api using following command
npm run start:api

# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# and run cypress test using following command
npm run cypress:run

# or run following command to run it with GUI
npm run cypress:open
```

# Contribuciones

- Por favor vea ./scripts/contribute/HowToApplyLicense.md
- Ignore adding headers for .json or .md or .yml

# 🎯 Por qué estamos construyendo esto?

La mayoría de las empresas de Internet emplean una hoja de cálculo o una base de datos para resolver sus necesidades comerciales. Las hojas de cálculo son utilizadas por mil millones de personas colaborativamente todos los días. Sin embargo, estamos lejos de trabajar a velocidades similares en bases de datos, ya que son herramientas computacionalmente más poderosas. Los intentos de resolver esto con las ofrendas de SaaS han significado horribles controles de acceso, lockin de proveedores, lockin de datos, cambios abruptos de precios y, lo que es más importante, un techo de vidrio sobre lo que es posible en el futuro."

# ❤ Nuestra misión :

Nuestra misión es proporcionar la interfaz sin-código más potente para bases de datos open-source para negocios de Internet en el mundo. Esto no solo democratizaría el acceso a una poderosa herramienta de computación, sino que también brindará a mil millones de personas que tendrán habilidades radicales de retención y construcción en Internet."
