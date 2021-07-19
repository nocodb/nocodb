---
title: 'Setup and Usages'
description: 'Simple installation - takes about three minutes!'
position: 1
category: 'Setup and Usages'
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

<br>
<br>

## Local Setup

If you want to modify the source code, there are two scenarios. You can either 

- change backend only or 
- change both frontend and backend separately

Even though the package ``nocodb/packages/nocodb`` is a backend project, you can still visit the dashboard as it includes ``nc-lib-gui``. 

```bash
cd packages/nocodb
npm install
npm run watch:run
# open localhost:8080/dashboard in browser
```

As ``nc-lib-gui`` is hosted in npm registry, for local development on frontend part, you should run ``nc-gui`` separately. 

```bash
cd packages/nc-gui
npm install
npm run dev
# open localhost:3000/dashboard in browser
```

If you wish to combine the frontend and backend together in your local devlopment environment, you may use ``packages/nc-lib-gui`` as a local depenedency by updating the ``packages/nocodb/package.json`` to 

```json
"nc-lib-gui": "file:../nc-lib-gui"
```

In this case, whenever there is any changes made in frontend, you need to run ``npm run build:copy`` under ``packages/nc-gui/``.

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