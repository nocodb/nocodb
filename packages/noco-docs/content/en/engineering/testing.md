---
title: "Writing Tests"
description: "Overview to testing"
position: 3250
category: "Engineering"
menuTitle: "Writing Tests"
---

## Unit Tests

- All individual unit tests are independent of each other. We don't use any shared state between tests.
- Test environment includes `sakila` sample database and any change to it by a test is reverted before running other tests.
- While running unit tests, it tries to connect to mysql server running on `localhost:3306` with username `root` and password `password` (which can be configured) and if not found, it will use `sqlite` as a fallback, hence no requirement of any sql server to run tests.

### Pre-requisites

- MySQL is preferred - however tests can fallback on SQLite too

### Setup  

```bash
cd packages/nocodb

npm install

# add a .env file
cp tests/unit/.env.sample tests/unit/.env

# open .env file
open tests/unit/.env
```
Configure the following variables
> DB_HOST : host </br>
> DB_PORT : port </br>
> DB_USER : username </br>
> DB_PASSWORD : password </br>

### Run Tests

``` bash
npm run test:unit
```

### Folder Structure

The root folder for unit tests is `packages/tests/unit`

- `rest` folder contains all the test suites for rest apis.
- `model` folder contains all the test suites for models.
- `factory` folder contains all the helper functions to create test data.
- `init` folder contains helper functions to configure test environment.
- `index.test.ts` is the root test suite file which imports all the test suites.
- `TestDbMngr.ts` is a helper class to manage test databases (i.e. creating, dropping, etc.).

### Factory Pattern

- Use factories for create/update/delete data. No data should be directly create/updated/deleted in the test.
- While writing a factory make sure that it can be used with as less parameters as possible and use default values for other parameters.
- Use named parameters for factories.
  ```ts
  createUser({ email, password})
  ```
- Use one file per factory.


### Walk through of writing a Unit Test

We will create an `Table` test suite as an example.

#### Configure test

We will configure `beforeEach` which is called before each test is executed. We will use `init` function from `nocodb/packages/tests/unit/init/index.ts`, which is a helper function which configures the test environment(i.e resetting state, etc.).

`init` does the following things -

- It initializes a `Noco` instance(reused in all tests).
- Restores `meta` and `sakila` database to its initial state.
- Creates the root user.
- Returns `context` which has `auth token` for the created user, node server instance(`app`), and `dbConfig`.

We will use `createProject` and `createProject` factories to create a project and a table.

```typescript
let context;

beforeEach(async function () {
  context = await init();

  project = await createProject(context);
  table = await createTable(context, project);
});
```

#### Test case

We will use `it` function to create a test case. We will use `supertest` to make a request to the server. We use `expect`(`chai`) to assert the response.

```typescript
it('Get table list', async function () {
  const response = await request(context.app)
    .get(`/api/v1/db/meta/projects/${project.id}/tables`)
    .set('xc-auth', context.token)
    .send({})
    .expect(200);

  expect(response.body.list).to.be.an('array').not.empty;
});
```

<alert>
We can also run individual test by using `.only` in `describe` or `it` function and the running the test command.
</alert>

```typescript
it.only('Get table list', async () => {
```

#### Integrating the New Test Suite

We create a new file `table.test.ts` in `packages/nocodb/tests/unit/rest/tests` directory.

```typescript
import 'mocha';
import request from 'supertest';
import init from '../../init';
import { createTable, getAllTables } from '../../factory/table';
import { createProject } from '../../factory/project';
import { defaultColumns } from '../../factory/column';
import Model from '../../../../src/lib/models/Model';
import { expect } from 'chai';

function tableTest() {
  let context;
  let project;
  let table;

  beforeEach(async function () {
    context = await init();

    project = await createProject(context);
    table = await createTable(context, project);
  });

  it('Get table list', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/meta/projects/${project.id}/tables`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);

    expect(response.body.list).to.be.an('array').not.empty;
  });
}

export default function () {
  describe('Table', tableTests);
}
```

We can then import the `Table` test suite to `Rest` test suite in `packages/nocodb/tests/unit/rest/index.test.ts` file(`Rest` test suite is imported in the root test suite file which is `packages/nocodb/tests/unit/index.test.ts`).

### Seeding Sample DB (Sakila)

```typescript

function tableTest() {
  let context;
  let sakilaProject: Project;
  let customerTable: Model;

  beforeEach(async function () {
    context = await init();
    
    /******* Start : Seeding sample database **********/
    sakilaProject = await createSakilaProject(context);
    /******* End : Seeding sample database **********/
    
    customerTable = await getTable({project: sakilaProject, name: 'customer'})
  });

  it('Get table data list', async function () {
    const response = await request(context.app)
      .get(`/api/v1/db/data/noco/${sakilaProject.id}/${customerTable.id}`)
      .set('xc-auth', context.token)
      .send({})
      .expect(200);

    expect(response.body.list[0]['FirstName']).to.equal('MARY');
  });
}
```

## Cypress Tests

### End-to-end (E2E) Tests
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

### SQLite Tests (XCDB Project)

```shell
# install dependencies(cypress)
npm install
# start MySQL database using docker compose
docker-compose -f ./scripts/cypress/docker-compose-cypress.yml up

# Run backend api using following command
npm run start:xcdb-api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run one of 4 test scripts
# - Table operations : xcdb-restTableOps.js
# - Views : xcdb-restViews.js
# - Roles & access control : xcdb-restRoles.js
# - Miscellaneous : xcdb-restMisc.js
```

### MySQL Tests (External DB Project)

```shell
# install dependencies(cypress)
npm install
# start MySQL database using docker compose
docker-compose -f ./scripts/cypress/docker-compose-cypress.yml up

# Run backend api using following command
npm run start:api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run one of 4 test scripts
# - Table operations : restTableOps.js
# - Views : restViews.js
# - Roles & access control : restRoles.js
# - Miscellaneous : restMisc.js
```

### Postgres Tests (External DB Project)

```shell
# install dependencies(cypress)
npm install
# start Postgres database using docker compose
docker-compose -f ./scripts/cypress/docker-compose-pg.yml up -d

# Run backend api using following command
npm run start:api:cache
# Run frontend web UI using following command
npm run start:web

# wait until both 3000 and 8080 ports are available
# or run following command to run it with GUI
npm run cypress:open

# run one of 4 test scripts
# - Table operations : pg-restTableOps.js
# - Views : pg-restViews.js
# - Roles & access control : pg-restRoles.js
# - Miscellaneous : pg-restMisc.js
```

### Quick Import Tests (SQLite Project)

```shell
# install dependencies(cypress)
npm install
# start MySQL database using docker compose
docker-compose -f ./scripts/cypress/docker-compose-cypress.yml up

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
# - quickTest.js
```

### Quick import tests (Postgres)

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
# - quickTest.js
```

## Accessing CI-CD CY Screenshots

1. On Jobs link, click on `Summary`
  
  
![Screenshot 2022-10-31 at 9 25 23 PM](https://user-images.githubusercontent.com/86527202/199052696-af0bf066-d82f-487a-b487-602f55594fd7.png)

  
2. Click on `Artifacts`
  
  
![Screenshot 2022-10-31 at 9 26 01 PM](https://user-images.githubusercontent.com/86527202/199052712-04508921-32b1-4926-8291-396c804f7c3b.png)

  
3. Download logs for desired suite
  
  
![Screenshot 2022-10-31 at 9 26 34 PM](https://user-images.githubusercontent.com/86527202/199052727-9aebbdd1-749e-4bda-ab00-3cdd0e3f48fe.png)

