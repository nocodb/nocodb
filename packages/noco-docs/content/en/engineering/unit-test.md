---
title: "Unit Test"
description: "How to write unit tests"
position: 3300
category: "Engineering"
menuTitle: "Unit Test"
---

## Key points

- We use [Mocha](https://mochajs.org/) as our test runner and [chai](https://www.chaijs.com/) as our assertion library.
- We use [Supertest](https://www.npmjs.com/package/supertest) to test our API endpoints.
- All individual unit tests are independent of each other. We don't use any shared state between tests.
- Test environment also includes `sakila` database and any change on `sakila` by a test is reverted before running other tests.
- While running unit tests, it tries to connect to mysql server running on `localhost:3306` with username `root` and password `password`(which can be configured) and if not found, it will use `sqlite` as a fallback, hence no requirement of any sql server to run tests.

## Walk through of writing a unit test

We will create an `Table` test suite as an example.

### Describing test suite

Create `Table` test suite by using `describe` function of mocha.

```typescript
export default function () {
  describe('Table', tableTests);
}
```

### Configure test

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

### Test case

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

### Integrating the new test suite

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

## Running test

To run tests, run `npm run test:unit` in `packages/nocodb` directory.

> NOTE: We can also run individual test by using `.only` in `describe` or `it` function and the running the test command.

```typescript
it.only('Get table list', async () => {
```

## Folder structure

The root folder for unit tests is `packages/tests/unit`

- `rest` folder contains all the test suites for rest apis.
- `model` folder contains all the test suites for models.
- `factory` folder contains all the helper functions to create test data.
- `init` folder contains helper functions to configure test environment.
- `index.test.ts` is the root test suite file which imports all the test suites.
- `TestDbMngr.ts` is a helper class to manage test databases (i.e. creating, dropping, etc.).

## Patterns to follow

- **Factories**
  - Use factories for create/update/delete data. No data should be directly create/updated/deleted in the test.
  - While writing a factory make sure that it can be used with as less parameters as possible and use default values for other parameters.
  - Use named parameters for factories.

  ``` typescript
    createUser({ email, password})
  ```

  - Use one file per factory.

## Using sakila db

To use sakila db use `createSakilaProject` from `factory/project` to create a project. This project will be seeded with `sakila` tables.

## Configurations

- For Mysql db configuration, use the following environment variables to configure.
  - `DB_USER` : mysql username
  - `DB_PASSWORD` : mysql password
  - `DB_HOST` : mysql host
  - `DB_PORT` : mysql port
