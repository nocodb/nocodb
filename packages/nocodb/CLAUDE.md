# NocoDB Backend (NestJS + Knex)

## Architecture

```
src/
├── controllers/          # CE REST endpoints (legacy pattern — see internal controllers)
├── controllers/internal/ # Internal controller system (new endpoints go here)
│   └── modules/          # UiGet.operations.ts, UiPost.operations.ts, etc.
├── services/             # Business logic (~170 CE services + EE overrides)
├── models/               # Database entities (~70 CE + ~40 EE models)
├── db/                   # Query layer — Knex.js (NOT an ORM), dynamic based on column metadata
├── helpers/              # Utilities (NcError, validatePayload, etc.)
├── guards/               # Auth guards (GlobalGuard, MetaApiLimiterGuard)
├── middlewares/           # extract-ids, global middleware
├── modules/              # NestJS modules (noco.module.ts is the main registration point)
├── ee/                   # Enterprise features (extends CE via class inheritance)
├── ee-cloud/             # Cloud-specific EE overrides
└── ee-on-prem/           # On-prem EE (license validation)
```

Multi-tenancy via `NcContext` parameter passed through all services.

## Adding a New API Endpoint

Use the **internal controller pattern** — do NOT create direct controller files (legacy).

Each operations module implements `InternalApiModule`, declares its `operations` list, and routes via a `handle()` switch. Modules are registered in `controllers/internal/provider.ts` (CE) or `ee/controllers/internal/provider.ts` (EE).

**When to create a new module vs add to UiGet/UiPost:**
- Distinct feature with 3+ operations → create dedicated module (e.g., `McpGet.operations.ts`, `WorkflowPost.operations.ts`)
- Small addition to existing UI surface → add to `UiGet.operations.ts` or `UiPost.operations.ts`

Existing modules: `UiGet/UiPost` (catch-all), `McpGet/McpPost`, `OAuthGet/OAuthPost`, `DependencyPost`, `RecordAuditList`. EE adds: `WorkflowGet/WorkflowPost`, `ManagedAppGet/ManagedAppPost`, `IntegrationPost`, `SendRecordEmail`.

**Steps:**

1. Add operation scope → `src/controllers/internal/operationScopes.ts` (EE: `ee/controllers/internal/operationScopes.ts` which spreads CE)
2. Create or pick operations module → `src/controllers/internal/modules/{Feature}Get.operations.ts`
   - Implement `InternalApiModule<InternalGETResponseType>` (or `InternalPOSTResponseType`)
   - Declare `operations` array, `httpMethod`, and `handle()` switch
3. If new module: register in `src/controllers/internal/provider.ts` → `InternalApiModules` array
4. Create service → `src/services/{feature}.service.ts`
5. Create model → `src/models/{Feature}.ts`
6. Register ACL → BOTH `src/utils/acl.ts` AND `src/ee/utils/acl.ts`
7. Register service → `src/modules/noco.module.ts` providers array

## Adding a New Model/Entity

1. Create model class implementing the SDK type interface
2. Add `MetaTable` entry in BOTH `src/utils/globals.ts` AND `src/ee/utils/globals.ts`
3. Add `CacheScope` in BOTH CE and EE globals
4. Add nanoid prefix in BOTH `src/meta/meta.service.ts` AND `src/ee/meta/meta.service.ts`
5. Create migration in `src/meta/migrations/v0/` and register in `XcMigrationSourcev0.ts`

## Model Pattern

```typescript
import type { FeatureType } from 'nocodb-sdk';
import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

export default class Feature implements FeatureType {
  // Use static methods for CRUD: insert(), get(), list(), update(), delete()
  // All take optional `ncMeta = Noco.ncMeta` for testability
  // Use metaInsert2/metaGet2/metaList2/metaUpdate for database operations
}
```

Primary key scoping:
- **Base scope** (views, columns): composite PK `['base_id', 'id']` + `fk_workspace_id`
- **Workspace scope**: just `id` PK + `fk_workspace_id`
- **Org scope** (users, tokens): just `id` PK

## Cache Operations

```typescript
// IMPORTANT: appendToList() must come AFTER get() so parentKeys are set
await NocoCache.get(context, `${CacheScope.FEATURE}:${id}`, CacheGetType.TYPE_OBJECT);
await NocoCache.set(context, `${CacheScope.FEATURE}:${id}`, data);
await NocoCache.appendToList(context, CacheScope.FEATURE, [parentId], key);

// Delete — use CacheDelDirection, NOT CacheScope
await NocoCache.deepDel(context, key, CacheDelDirection.CHILD_TO_PARENT);
```

Common mistake: passing `CacheScope.*` instead of `CacheDelDirection.*` to `deepDel` — these are different enums.

## Migrations

All new migrations in `src/meta/migrations/v0/` — v1/v2/v3 are deprecated. **1 migration per PR max** — if schema evolves during the PR, update the same migration file.

```bash
# Find next migration number:
ls src/meta/migrations/v0/ | grep -E '^nc_[0-9]+' | sort | tail -1
```

Register in `XcMigrationSourcev0.ts`: add import, add to `getMigrations()`, add case to `getMigration()`.

## EE Extension Pattern

```typescript
// src/ee/services/feature.service.ts
import { FeatureService as FeatureServiceCE } from 'src/services/feature.service';

@Injectable()
export class FeatureService extends FeatureServiceCE {
  // Override or extend CE methods
}
```

Register EE services in `src/ee/modules/noco.module.ts`.

## Testing

### Unit Tests

Framework: **Mocha + Chai + Supertest** (NOT Jest). Uses `@swc-node/register` for TS compilation.

```bash
pnpm test:unit              # SQLite
pnpm test:unit:pg:ee        # PostgreSQL + EE
```

Test context uses 3-layer pattern: IInitContext → ITestContext → test-specific setup.
beforeEach helpers: `textBased`, `numberBased`, `selectBased`, `dateBased`, `linkBased`.

### API Testing (Live Backend)

When building or modifying API endpoints, validate by running the backend and testing APIs directly:

1. Start backend in EE mode: `cd packages/nocodb && pnpm run watch:run:pg:ee` (hot reload, ~5s)
2. Wait for health: `curl -s http://localhost:8080/api/v1/health`
3. Create test users as needed, authenticate as multiple roles (owner, editor, viewer)
4. Build a single self-contained test script at `.claude/branches/{branch}/test.py` that:
   - Authenticates as multiple roles
   - Exercises all API operations (CRUD + edge cases + permission checks)
   - Asserts expected vs actual with PASS/FAIL output
5. Run after each code change — keep updating the same file to prevent regressions
6. Do NOT mark an API task as complete until tests pass

Always test in **EE mode** unless explicitly asked for CE testing.

## Data Operations Layer

When working on data operations (CRUD, filtering, sorting, RLS, etc.), changes may need to touch multiple layers:

| Layer | Path | Description |
|-------|------|-------------|
| **BaseModel CE** | `src/db/BaseModelSqlv2.ts` | Core data access (~206KB), all CRUD operations |
| **BaseModel EE** | `ee/db/BaseModelSqlv2.ts` | EE override — license checks, RLS, audit enhancements |
| **Optimized read** | `ee/dbQueryClient/cross-db-utils/single-query-read.ts` | Single-query record fetch (bypasses N+1) |
| **Optimized list** | `ee/dbQueryClient/cross-db-utils/single-query-list.ts` | Single-query record list with pagination/filtering |
| **PG helpers** | `ee/services/data-opt/pg-helpers.ts` | PostgreSQL-specific optimized paths |
| **MySQL helpers** | `ee/services/data-opt/mysql-helpers.ts` | MySQL-specific optimized paths |
| **DataOpt service** | `ee/services/data-opt/data-opt.service.ts` | Routes operations to DB-specific helpers |

When modifying data operations, ensure changes are applied across all relevant layers — not just BaseModel.

## Key Files

- `src/db/BaseModelSqlv2.ts` — Core data access layer (~206KB, handles all CRUD)
- `src/controllers/internal/operationScopes.ts` — All API operation registrations
- `src/utils/globals.ts` — MetaTable, CacheScope, CacheDelDirection enums
- `src/modules/noco.module.ts` — Main service registration
- `src/middlewares/extract-ids/extract-ids.middleware.ts` — ACL + permission extraction
- `src/meta/migrations/v0/` — All database migrations

## Anti-Patterns

| Don't | Do Instead |
|-------|-----------|
| Run backend in CE mode for EE features | Use `pnpm run watch:run:pg:ee` — CE mode uses SQLite and lacks workspace support |
| Cast with `as unknown` to bypass type errors | Update the type definition (e.g., `InternalGETResponseType`) |
| Create new abstractions when one already exists | Search for existing patterns first (e.g., don't create `NcLicenseState` when `NocoLicense` exists) |
| Apply data operation changes only to BaseModel | Check all layers: BaseModel CE/EE, optimized paths, pg-helpers, mysql-helpers |
| Forget to rebuild SDK after adding AppEvents | `cd packages/nocodb-sdk && pnpm run build:ee` — server will crash on missing enums |
