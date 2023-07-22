<h1 align="center" style="border-bottom: none">
    <b>
        <a href="https://www.nocodb.com">NocoDB </a><br>
    </b>
    ✨ L'alternativa Open Source ad Airtable ✨ <br>

</h1>
<p align="center">
Trasforma qualsiasi MySQL, PostgreSQL, SQL Server, SQLite & Mariadb in un foglio di calcolo intelligente. 
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

# Prova veloce

### Con Docker

```bash
docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:latest
```

- NocoDB needs a database as input : See [Production Setup](https://github.com/nocodb/nocodb/blob/master/README.md#production-setup).
- Per rendere persistenti i dati puoi montare il volume su `/usr/app/data/`.

  Example:

  ```
  docker run -d -p 8080:8080 --name nocodb -v "$(pwd)"/nocodb:/usr/app/data/ nocodb/nocodb:latest
  ```

### Con NPM

```
npx create-nocodb-app
```

### Con git

```
git clone https://github.com/nocodb/nocodb-seed
cd nocodb-seed
npm install
npm start
```

### GUI

Accedi al Pannello di Controllo visitando: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)

# Unisciti alla nostra comunità

<a href="https://discord.gg/5RgZmkW">
    <img 
    src="https://invidget.switchblade.xyz/5RgZmkW" 
    alt="Unisciti a NocoDB: Una alternativa Gratuita e Open Source ad Airtable"
    >
</a>
<br>

# Screenshots

![1](https://user-images.githubusercontent.com/86527202/136069047-e9090ea1-c95b-4ae5-9897-b48cab1ea3ab.png)
<br>

![2](https://user-images.githubusercontent.com/86527202/136069059-fb225bc4-0dac-439c-9a31-e21d02097427.png)
<br>

![5](https://user-images.githubusercontent.com/86527202/136069065-b2371359-7fff-420f-90d1-16e41b52b757.png)
<br>

![6](https://user-images.githubusercontent.com/86527202/136069070-df63e1d6-ecdf-4423-989f-51cc9f52e52a.png)
<br>

![7](https://user-images.githubusercontent.com/86527202/136069076-b32cdacf-5cb8-44ee-b8fe-4279ec1b4308.png)
<br>

![8](https://user-images.githubusercontent.com/86527202/136069078-08b5c09d-b2bd-4cc0-8c92-1d08c46e5f83.png)
<br>

![9](https://user-images.githubusercontent.com/86527202/136069081-15dad5b6-dd2c-472d-b4b7-9fdf5e00b0e8.png)
<br>

![9a](https://user-images.githubusercontent.com/86527202/136069084-31134cb0-d9b3-441f-ae29-9ff11ee1c45b.png)
<br>

![9b](https://user-images.githubusercontent.com/86527202/136069085-770cb6a4-6273-4edd-9382-01e46f59bc3b.png)
<br>

![10](https://user-images.githubusercontent.com/86527202/136069088-dba928db-d92a-4ff2-bb05-614becd208a1.png)
<br>

![11](https://user-images.githubusercontent.com/86527202/136069091-16764d3e-1995-4a45-99e8-652f28d2a946.png)
<br>

# Caratteristiche

### Interfaccia a foglio di calcolo

- ⚡ Ricerca, ordina, filtra, nascondi le colonne con super facilità
- ⚡ Crea Views: Griglie, Gallerie, Kanban, Form
- ⚡ Condividi Views: Pubbliche o protette da password
- ⚡ Views personali o bloccate
- ⚡ Carica immagini nelle celle (funziona con S3, Minio, GCP, Azure, Digitalocean, Linode, OVH, BackBlaze) !!
- ⚡ Ruoli: proprietario, creatore, editor, commentatore, visualizzatore, commentatore o ruoli personalizzati.
- ⚡ Controllo accessi: controllo di accesso anche a livello di database, tabella e colonna.

### App store per automazioni del flusso di lavoro

- ⚡ Chat: Microsoft Teams, Slack, Discord, Mattermost
- ⚡ Email: SMTP, SES, MailChimp
- ⚡ SMS: Twilio
- ⚡ Whatsapp
- ⚡ Qualsiasi API di terze parti

### Accesso API programmatico tramite

- ⚡ REST APIs (Swagger)
- ⚡ APIs GraphQL.
- ⚡ Include autenticazione JWT e AUTH
- ⚡ API Token da integrare con Zapier, Integromat.

# Impostazione in produzione

NOCODB richiede un database per memorizzare i metadati delle viste dei fogli di calcolo e dei database esterni. I parametri di connessione per questo database possono essere specificati nella variabile di ambiente NC_DB.

## Docker

#### Esempio con MySQL

```
docker run -d -p 8080:8080 \
    -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Esempio con Postgres

```
docker run -d -p 8080:8080 \
    -e NC_DB="pg://host:port?u=user&p=password&d=database" \
    -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
    nocodb/nocodb:latest
```

#### Esempio con SQL Server

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

## Variabili d'ambiente

Please refer to [Environment variables](https://docs.nocodb.com/getting-started/environment-variables)


# Setup di sviluppo

Please refer to [Development Setup](https://docs.nocodb.com/engineering/development-setup)

# Contributi

Please refer to [Contribution Guide](https://github.com/nocodb/nocodb/blob/master/.github/CONTRIBUTING.md).

# Perché lo abbiamo creato?

La maggior parte delle aziende utilizza fogli di calcolo o database per le proprie esigenze aziendali. I fogli di calcolo vengono utilizzati da oltre un miliardo di persone in modo collaborativo ogni singolo giorno. Tuttavia, i database che sono strumenti molto più potenti quando si tratta di elaborazione. I tentativi di risolvere questo problema con le offerte SaaS hanno significato orribili controlli di accesso, blocco del fornitore, blocco dei dati, brusche variazioni di prezzo e, soprattutto, un soffitto di vetro su ciò che è possibile in futuro.

# La nostra missione

La nostra missione è creare la più potente interfaccia per database "senza codice", disponibile a codice libero per ogni azienda nel mondo. Lo facciamo non solo per democratizzare l'accesso ad un potente strumento di elaborazione, ma anche per supportare i miliardi di persone che creano e costruiscono su Internet.
