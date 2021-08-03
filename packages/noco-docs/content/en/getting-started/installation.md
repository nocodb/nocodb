---
title: 'Installation'
description: 'Simple installation - takes about three minutes!'
position: 1
category: 'Getting started'
menuTitle: 'Installation'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---

Simple installation - takes about three minutes!

## Prerequisites

- __Must haves__
    * [node.js >= 12](https://nodejs.org/en/download) / [Docker](https://www.docker.com/get-started)
    * [MySql](https://dev.mysql.com/downloads/mysql/) / [Postgres](https://www.postgresql.org/download/) / [SQLserver](https://www.microsoft.com/en-gb/sql-server/sql-server-downloads) / SQLite Database
- Nice to haves
    - Existing schemas can help to create APIs quickly.
    - An example database schema can be found <a class="grey--text" href="https://github.com/lerocha/chinook-database/tree/master/ChinookDatabase/DataSources"> <u>here</u></a>.
    
## Quick try

### 1-Click Deploy to Heroku

<a href="https://heroku.com/deploy?template=https://github.com/npgia/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>

### Node app / Docker 


<code-group>
  <code-block label="NPX" active> 

  ```bash
  npx create-nocodb-app
  ```

  </code-block>

  <code-block label="Docker" >

  ```bash
  docker run -d --name nocodb -p 8080:8080 nocodb/nocodb
  ```

  </code-block>

  <code-block label="Using Git" >

  ```bash
  git clone https://github.com/nocodb/nocodb-seed
  cd nocodb-seed
  npm install
  npm start
  ```

  </code-block>
</code-group>  

> To persist data in docker you can mount volume at `/usr/app/data/` since 0.10.6. In older version mount at `/usr/src/app`.
        

## Local Setup

If you want to modify the source code, 

- Start the backend locally

```bash
cd packages/nocodb
npm install
npm run watch:run
```

- Start the frontend locally

```bash
cd packages/nc-gui
npm install
npm run dev
```

- Open ``localhost:3000/dashboard`` in browser

<alert>
  nocodb/packages/nocodb includes nc-lib-gui which is the built version of nc-gui hosted in npm registry. <br>
   You can visit localhost:8000/dashboard in browser after starting the backend locally if you just want to modify the backend only.
</alert>

## Production Setup 

NocoDB requires a database to store metadata of spreadsheets views and external databases. 
And connection params for this database can be specified in `NC_DB` environment variable. 

### Docker 

<code-group>
  <code-block label="MySQL" active>

  ```bash
  docker run -d -p 8080:8080 \
      -e NC_DB="mysql2://host.docker.internal:3306?u=root&p=password&d=d1" \
      -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
      nocodb/nocodb
  ```
    
  </code-block> 

  <code-block label="Postgres">

  ```bash
  docker run -d -p 8080:8080 \
      -e NC_DB="pg://host:port?u=user&p=password&d=database" \
      -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
      nocodb/nocodb
  ```

  </code-block> 

  <code-block label="SQL Server">

  ```bash
  docker run -d -p 8080:8080 \
      -e NC_DB="mssql://host:port?u=user&p=password&d=database" \
      -e NC_AUTH_JWT_SECRET="569a1821-0a93-45e8-87ab-eb857f20a010" \
      nocodb/nocodb
  ```

  </code-block> 
</code-group> 

### Docker Compose

<code-group>
  <code-block label="MySQL" active> 
  
  ```bash
  git clone https://github.com/nocodb/nocodb
  cd docker-compose
  cd mysql
  docker-compose up
  ```

  </code-block>

  <code-block label="Postgres"> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd docker-compose
  cd pg
  docker-compose up
  ```

  </code-block>
  
  <code-block label="SQL Server"> 

  ```bash
  git clone https://github.com/nocodb/nocodb
  cd docker-compose
  cd mssql
  docker-compose up
  ```

  </code-block> 
</code-group> 

### Sample app        
<code-sandbox :src="link"></code-sandbox>

## Sample Demos

### Docker deploying with one command

<youtube id="K-UEecQyiOk"></youtube>

### Using NPX

<youtube id="v6Nn75P1p7I"></youtube>

### Heroku Deployment
<youtube id="v6Nn75P1p7I"></youtube>