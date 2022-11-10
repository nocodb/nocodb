# Playwright E2E tests

## Setup

Make sure to install the dependencies(in the playwright folder):

```bash
npm install
npx playwright install chromium --with-deps
```

## Run Test Server

Start the backend test server (in `packages/nocodb` folder):

```bash
npm run watch:run:playwright:quick
```

Start the frontend test server (in `packages/nc-gui` folder):

```bash
NUXT_PAGE_TRANSITION_DISABLE=true npm run dev
```

## Running Tests

### Running all tests

For selecting db type, rename `.env.example` to `.env` and set `E2E_DEV_DB_TYPE` to  `sqlite`(default), `mysql` or `pg`.

```bash
npm run test
```

### Running individual tests

Add `.only` to the test you want to run:

```js
test.only('should login', async ({ page }) => {
  // ...
})
```

```bash
npm run test
```

## Developing tests

### WebStorm

In Webstorm, you can use the `test-debug` run action to run the tests.

Add `.only` to the test you want to run. This will open the test in a chromium session and you can also add break points.

i.e `test.only('should login', async ({ page }) => {`

### VSCode

In VSCode, use this [https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chromium](extension).

It will have run button beside each test in the file.

### Page Objects

Page object is a class which has methods to interact with a page/component. Methods should be thin and should not do a whole lot. They should also be reusable.

All the action methods i.e click of a page object is also responsible for waiting till the action is completed. This can be done by waiting on an API call or some ui change.

Do not add any logic to the tests. Instead, create a page object for the page you are testing.
All the selection, UI actions and assertions should be in the page object.

Page objects should be in `packages/nc-gui/tests/playwright/pages` folder.

### Verify if tests are not flaky

Add `.only` to the added test and run `npm run test:repeat`. This will run the test multiple times and should show if the test is flaky.
