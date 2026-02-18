# NocoDB Unit Testing Guide

## Overview

- **Framework**: Mocha + Chai + Supertest (NOT Jest)
- **TS Compilation**: `@swc-node/register` (faster than ts-node)
- **Location**: `packages/nocodb/tests/unit/`
- **Entry point**: `tests/unit/index.test.ts` — registers all suites, calls `run()`
- **Timeout**: 300s (5 min) per test

## Directory Structure

```
tests/unit/
├── index.test.ts          # Main entry — registers all suites + run()
├── TestDbMngr.ts          # DB manager (creates/seeds meta + sakila DBs)
├── .env                   # Active DB config (gitignored, copied from .pg.env)
├── .pg.env                # PostgreSQL config template
├── .env.sample            # MySQL config template
│
├── init/                  # Initialization & context
│   ├── index.ts           # init() → IInitContext (server + token + config)
│   ├── cleanupMeta.ts     # Wipes meta tables between tests
│   ├── cleanupSakila.ts   # Resets sakila DB between tests
│   └── db.ts              # isSqlite(), isPg(), isMysql() helpers
│
├── factory/               # Test data factories (create data without APIs)
│   ├── user.ts            # createUser()
│   ├── base.ts            # createProject(), createSakilaProject()
│   ├── table.ts           # createTable(), getTable(), getAllTables()
│   ├── column.ts          # createColumn(), createLtarColumn(), customColumns()
│   ├── row.ts             # createRow(), createBulkRows(), listRow()
│   ├── view.ts            # createView(), createViewV3(), updateView()
│   ├── viewColumns.ts     # View column config
│   └── job.ts             # Job/queue factories
│
├── utils/
│   ├── runOnSet.ts        # Test set filtering (parallel CI)
│   ├── ncAxios.ts         # HTTP helpers (supertest wrappers)
│   ├── helpers.ts         # isEE() and misc
│   └── plan.utils.ts      # EE plan/feature overrides
│
├── rest/                  # REST API tests
│   ├── index.test.ts      # Registers REST test suites
│   └── tests/
│       ├── auth.test.ts, base.test.ts, tableRow.test.ts, ...
│       ├── ee/            # EE-only tests (workspace, sso, etc.)
│       ├── dataApiV3/     # V3 data API tests
│       ├── metaApiV3/     # V3 meta API tests
│       └── meta-apis/     # Meta API tests
│
├── formula/               # Formula computation tests
├── rollup/                # Rollup tests
├── links/                 # Link field tests
├── model/                 # BaseModelSql tests
├── processor/             # Background job tests (duplicate)
├── dbQueryClient/         # DB query client tests (PG)
├── crossBaseLink/         # Cross-base link tests (EE)
├── error/                 # Error extractor tests
└── helpersTest/           # Helper function tests
```

## Running Tests

```bash
cd packages/nocodb

# SQLite (default fallback, CE)
pnpm test:unit

# PostgreSQL, CE
pnpm test:unit:pg

# PostgreSQL, EE (most common for development)
pnpm test:unit:pg:ee

# PostgreSQL, EE with coverage
pnpm test:unit:pg:ee:cov

# Run specific test set (for CI parallelism)
pnpm test:unit:pg:ee --test-set-1   # auth, base, workspace, payments, etc.
pnpm test:unit:pg:ee --test-set-2   # formula, rollup, links, dataApiV3, etc.
```

### Running a Single Test Suite

Use `describe.only()` or `it.only()` to isolate tests during development:

```typescript
describe.only('dataApiV3', () => {   // Only this suite runs
  it('my test', async () => { ... });
});
```

**Remember to remove `.only` before committing.**

## Test Set Mechanism

Tests are divided into sets for CI parallelism via `runOnSet()`:

```typescript
// In utils/runOnSet.ts
export function runOnSet(set: number, target: () => void | any) {
  return function (...args) {
    if (willRunOnSet(set)) return target.apply(this, args);
  };
}
```

**Usage:**
```typescript
export const dataApiV3Test = runOnSet(2, async () => {
  await import('./get-list.test');
  await import('./links-as-ltar.test');
});
```

**Set distribution:**
- **Set 1**: REST basics — auth, base, workspace, payments, OAuth, integration
- **Set 2**: Data layer — formula, rollup, links, viewRow, processor, dataApiV3, dbQueryClient

## Context Architecture

Three-layer context pattern:

```
IInitContext (from init())
│  └─ app, nestApp, token, xc_token, user, dbConfig, fk_workspace_id
│
└─► ITestContext (wraps IInitContext + base)
    │  └─ context: IInitContext, ctx: {workspace_id, base_id}, base: Base
    │
    └─► Test-specific setup (tables, columns, rows, views)
```

### IInitContext — Server + Auth

```typescript
import init from '../../../init';  // or adjust path

const context = await init();
// context.app       — Express app (for supertest)
// context.token     — Auth token
// context.xc_token  — API token
// context.fk_workspace_id — Workspace ID
```

- Server starts **once** per test run (singleton)
- `init()` cleans DB + creates fresh user/workspace each call

### ITestContext — Base + Workspace

```typescript
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';

const testContext = await dataApiV3BeforeEach();
// testContext.context  — IInitContext
// testContext.base     — Base model
// testContext.ctx      — { workspace_id, base_id }
```

## Writing a New Test File

### Step 1: Create the test file

```typescript
// tests/unit/rest/tests/dataApiV3/my-feature.test.ts
import { expect } from 'chai';
import { beforeEach as dataApiV3BeforeEach } from './beforeEach';
import { ncAxios } from './ncAxios';
import type { ITestContext } from './helpers';
import type { INcAxios } from './ncAxios';

const API_VERSION = 'v3';

describe('dataApiV3', () => {
  describe('my-feature', () => {
    let testContext: ITestContext;
    let ncAxiosGet: INcAxios['ncAxiosGet'];
    let ncAxiosPost: INcAxios['ncAxiosPost'];
    let urlPrefix: string;

    beforeEach(async () => {
      testContext = await dataApiV3BeforeEach();
      const testAxios = ncAxios(testContext);
      urlPrefix = `/api/${API_VERSION}/data/${testContext.base.id}`;
      ncAxiosGet = testAxios.ncAxiosGet;
      ncAxiosPost = testAxios.ncAxiosPost;
    });

    it('should do something', async function () {
      const rsp = await ncAxiosGet({
        url: `${urlPrefix}/${table.id}/records`,
        query: { limit: 10 },
      });

      expect(rsp.body.records).to.have.length(10);
      expect(rsp.body.records[0].fields['Title']).to.equal('Title 1');
    });
  });
});
```

### Step 2: Register in index.test.ts

```typescript
// tests/unit/rest/tests/dataApiV3/index.test.ts
export const dataApiV3Test = runOnSet(2, async () => {
  await import('./get-list.test');
  // ... existing imports ...
  await import('./my-feature.test');   // ← Add here
});
```

### Step 3: Use beforeEach helpers for complex setup

The `beforeEach.ts` file provides pre-built table setups:

| Helper | Creates | Rows |
|--------|---------|------|
| `beforeEachTextBased(ctx)` | Table with text columns | 100 |
| `beforeEachNumberBased(ctx)` | Table with number columns | 100 |
| `beforeEachSelectBased(ctx)` | Table with select columns | 100 |
| `beforeEachDateBased(ctx)` | Table with date columns | 100 |
| `beforeEachLinkBased(ctx)` | 4 tables: Country↔City (HM), Actor↔Film (MM) | 100 each |
| `beforeEachCheckbox(ctx)` | Table with checkbox column | - |
| `beforeEachJSON(ctx)` | Table with JSON column | - |
| `beforeEachUserBased(ctx)` | Table with user column | - |
| `beforeEachAttachment(ctx)` | Table with attachment column | - |

**Link-based setup details (most complex):**
```
Country ─── HM ──→ City        (Country.Cities / City.Country)
Actor   ─── MM ──→ Film        (Actor.Films / Film.Actors)
```
Returns: `{ tblCountry, tblCity, tblActor, tblFilm, columnsCountry, columnsCity, columnsActor, columnsFilm }`

## ncAxios HTTP Helpers

Two versions exist — use the one matching your test location:

### V3 tests (`dataApiV3/ncAxios.ts`)

```typescript
import { ncAxios } from './ncAxios';

const testAxios = ncAxios(testContext);  // ITestContext
const { ncAxiosGet, ncAxiosPost, ncAxiosPatch, ncAxiosDelete,
        ncAxiosLinkGet, ncAxiosLinkAdd, ncAxiosLinkRemove } = testAxios;
```

### Other tests (`utils/ncAxios.ts`)

```typescript
import { ncAxios } from '../../../utils/ncAxios';

const testAxios = ncAxios(context, base.id);  // IInitContext + baseId
```

### Method signatures

```typescript
// All methods auto-inject auth token and assert status code
ncAxiosGet({ url, query?, status? })
ncAxiosPost({ url, body?, query?, status? })
ncAxiosPatch({ url, body?, query?, status? })
ncAxiosDelete({ url, body?, status? })

// Link helpers (auto-build URL from urlParams)
ncAxiosLinkGet({ urlParams: {tableId, linkId, rowId}, query?, status?, msg? })
ncAxiosLinkAdd({ urlParams: {tableId, linkId, rowId}, body?, status?, msg? })
ncAxiosLinkRemove({ urlParams: {tableId, linkId, rowId}, body?, status?, msg? })
```

### Link body formats

```typescript
// Add links — array of {id} objects
await ncAxiosLinkAdd({
  urlParams: { tableId, linkId, rowId: '1' },
  body: [{ id: 1 }, { id: 2 }, { id: 3 }],
});

// Remove links — array of plain IDs
await ncAxiosLinkRemove({
  urlParams: { tableId, linkId, rowId: '1' },
  body: [1, 2, 3],
});
```

## Factory Usage

Factories create data directly via models/APIs (faster than going through REST endpoints):

```typescript
import { createTable } from '../../../../factory/table';
import { createColumn, createLtarColumn, customColumns } from '../../../../factory/column';
import { createBulkRows, createRow, listRow } from '../../../../factory/row';
import { createView } from '../../../../factory/view';

// Create table with custom columns
const table = await createTable(context, base, {
  table_name: 'TestTable',
  title: 'TestTable',
  columns: customColumns('textBased'),
});

// Create LTAR relationship
await createLtarColumn(context, {
  title: 'Cities',
  parentTable: countryTable,
  childTable: cityTable,
  type: 'hm',  // or 'mm', 'bt'
});

// Bulk insert rows
await createBulkRows(context, {
  base,
  table,
  values: Array.from({ length: 100 }, (_, i) => ({
    Title: `Title ${i + 1}`,
  })),
});
```

## Common Helpers

```typescript
import { getColumnId, idc, prepareRecords } from './helpers';

// Get column ID by title
const linkId = getColumnId(columns, 'Cities');

// Sort by ID comparator (for stable deep-equals)
expect(results.sort(idc)).to.deep.equal(expected);

// Generate test records
const records = prepareRecords('Country', 100);
// → [{Id: 1, Country: 'Country 1'}, {Id: 2, Country: 'Country 2'}, ...]
```

## CE/EE Test Patterns

### Conditional EE tests

```typescript
// In rest/index.test.ts
let workspaceTest = () => {};
if (process.env.EE === 'true') {
  workspaceTest = require('./tests/ee/workspace.test').default;
}
```

### Runtime EE check

```typescript
import { isEE } from '../../utils/helpers';

it('EE-only feature', async function () {
  if (!isEE()) this.skip();
  // ... EE test logic
});
```

## Database Support

Tests auto-detect DB from `.env`:

| DB | Config Source | Fallback |
|----|-------------|----------|
| PostgreSQL | `.pg.env` → `.env` | — |
| MySQL | `.env.sample` → `.env` | — |
| SQLite | Auto-fallback | Always works |

- Server initializes DB once, cleans between tests
- Sakila DB seeded from `tests/pg-sakila-db/` or `tests/mysql-sakila-db/` or `tests/sqlite-sakila-db/`
- `TestDbMngr` handles all DB lifecycle

## Assertion Patterns

```typescript
import { expect } from 'chai';

// Status code (auto-checked by ncAxios, but manual for raw supertest)
expect(response.status).to.equal(200);

// Array checks
expect(rsp.body.records).to.be.an('array');
expect(rsp.body.records).to.have.length(5);

// Deep equal (sort first for stable comparison)
expect(cities.sort(idc)).to.deep.equal(expectedCities);

// Property checks
expect(record.fields).to.have.property('Title');
expect(record.fields).to.not.have.property('Secret');

// Type checks
expect(record.fields['Count']).to.equal(5);          // number
expect(record.fields['Items']).to.be.an('array');     // array
expect(record.fields['Parent']).to.be.an('object');   // object

// Error response
const rsp = await ncAxiosGet({ url: badUrl, status: 404 });
expect(rsp.body.message).to.equal("Record '999' not found");
```

## Checklist: Adding a New Test Suite

1. **Create test file** in the appropriate directory
2. **Import setup helpers** (`beforeEach`, `ncAxios`, `helpers`)
3. **Use `describe`/`it` blocks** — Mocha style, no `test()`
4. **Register in `index.test.ts`** — add `await import('./my-test');`
5. **Choose correct test set** — wrap parent in `runOnSet(1)` or `runOnSet(2)`
6. **Use factories** for data setup, ncAxios for HTTP assertions
7. **Clean up**: no `.only`, no `console.log`, no hardcoded IDs
8. **Test locally**: `pnpm test:unit:pg:ee --test-set-2` (or appropriate set)
