---
title: "Development setup"
description: "How to set-up your development environment"
position: 3200
category: "Engineering"
menuTitle: "Development setup"
---

## Clone the repo
```
git clone https://github.com/nocodb/nocodb
cd nocodb/packages
```

## Build SDK
```
# build nocodb-sdk
cd nocodb-sdk
npm install
npm run build
```

## Build Backend
```
# build backend - runs on port 8080
cd ../nocodb
npm install
npm run watch:run
```

## Build Frontend
```
# build frontend - runs on port 3000
cd ../nc-gui
npm install
npm run dev 
```

Any changes made to frontend and backend will be automatically reflected in the browser.

## Cypress - e2e tests
Cypress tests are divided into 4 suites
- SQLite tests
- Postgres tests
- MySQL tests
- Quick import tests

First 3 suites, each have 4 test category
- Table operations (create, delete, rename, add column, delete column, rename column)
- Views (Grid, Gallery, Form)
- Roles (user profiles, access control & preview)
- Miscellaneous (Import, i18n, etc)


### MySQL tests (ExtDB project)
```shell
# install dependencies(cypress)
npm install
# start MySQL database using docker compose
docker-compose -f ./scripts/docker-compose-cypress.yml up

# Run backend api using following command
npm run start:api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run one of 4 test scripts
- Table operations : restTableOps.js
- Views : restViews.js
- Roles & access control : restRoles.js
- Miscellaneous : restMisc.js
```

### SQLite tests (XCDB project)
```shell
# install dependencies(cypress)
npm install
# start MySQL database using docker compose
docker-compose -f ./scripts/docker-compose-cypress.yml up

# Run backend api using following command
npm run start:xcdb-api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run one of 4 test scripts
- Table operations : xcdb-restTableOps.js
- Views : xcdb-restViews.js
- Roles & access control : xcdb-restRoles.js
- Miscellaneous : xcdb-restMisc.js
```

### PG tests (ExtDB project)
```shell
# install dependencies(cypress)
npm install
# start PG database using docker compose
docker-compose -f ./scripts/cypress/docker-compose-pg.yml up -d

# Run backend api using following command
npm run start:api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run one of 4 test scripts
- Table operations : pg-restTableOps.js
- Views : pg-restViews.js
- Roles & access control : pg-restRoles.js
- Miscellaneous : pg-restMisc.js
```

### Quick import tests (SQLite project)
```shell
# install dependencies(cypress)
npm install
# start MySQL database using docker compose
docker-compose -f ./scripts/docker-compose-cypress.yml up

# copy existing xcdb (v0.91.7) database to ./packages/nocodb/
cp ./scripts/cypress/fixtures/quickTest/noco_0_91_7.db ./packages/nocodb/noco.db

# Run backend api using following command
npm run start:api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run test script
- quickTest.js
```

### Quick import tests (PG)
```shell
# install dependencies(cypress)
npm install
# start PG database using docker compose
docker-compose -f ./scripts/cypress/docker-compose-pg.yml up -d

# copy existing xcdb (v0.91.7) database to ./packages/nocodb/
cp ./scripts/cypress/fixtures/quickTest/noco_0_91_7.db ./packages/nocodb/noco.db

# Run backend api using following command
npm run start:api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run test script
- quickTest.js
```
