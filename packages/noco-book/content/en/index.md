---
title: 'Setup and Usage'
description: 'Simple installation - takes about three minutes!'
position: 0
category: 'Getting started'
fullscreen: true
menuTitle: 'Install'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---


## Simple installation - takes about three minutes!

### Prerequisites

- __Must haves__
    * [node.js >= 12](https://nodejs.org/en/download) / [Docker](https://www.docker.com/get-started)
    * [MySql](https://dev.mysql.com/downloads/mysql/) / [Postgres](https://www.postgresql.org/download/) / [SQLserver](https://www.microsoft.com/en-gb/sql-server/sql-server-downloads) / SQLite Database
- Nice to haves
    - Existing schemas can help to create APIs quickly.
    - An example database schema can be found :<a class="grey--text"
                                                                                         href="https://github.com/lerocha/chinook-database/tree/master/ChinookDatabase/DataSources">
                        <u>here</u>
                    </a>
    


## Quick try
### 1-Click Deploy
<a href="https://heroku.com/deploy?template=https://github.com/npgia/nocodb-seed-heroku">
    <img 
    src="https://www.herokucdn.com/deploy/button.svg" 
    width="300px"
    alt="Deploy NocoDB to Heroku with 1-Click" 
    />
</a>

### Node app or docker 


<code-group>
  <code-block label="NPX" active> 

  ```bash
  npx create-nocodb-app
  ```

  </code-block>
  <code-block label="Docker" >

  ```bash
  docker run -d --name nocodb -p 8080:8080 nocodb/nocodb:0.11.33
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
                  
          
### Sample app        
<code-sandbox :src="link"></code-sandbox>


# Sample Demos
### Docker deploying with one command

<youtube id="K-UEecQyiOk"></youtube>

### Using Npx

<youtube id="v6Nn75P1p7I"></youtube>

### Heroku Deployment
<youtube id="v6Nn75P1p7I"></youtube>

