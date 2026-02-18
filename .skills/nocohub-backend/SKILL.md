---
name: nocohub-backend
description: |
  NocoDB Enterprise (nocohub) backend development skill for NestJS-based API development.
  MANDATORY TRIGGERS: backend, API, service, controller, model, migration, NestJS, endpoint, database, EE feature, enterprise
  Use when: (1) Creating new API endpoints, (2) Adding services or controllers, (3) Writing database migrations, (4) Implementing EE-specific features, (5) Working with the data layer, (6) Adding new models, (7) Understanding CE/EE sync requirements
---

# NocoDB Enterprise Backend Development

> **📝 Skill Maintenance Note**
>
> While working on PRs, if you discover that any information in this skill is outdated, incorrect, or missing, **please update this skill as part of your PR**. Keeping these skills accurate helps the entire team work more efficiently with Claude. Update patterns, add new conventions, or correct any discrepancies you find.

## Architecture Overview

NocoDB uses **NestJS** (Node.js) with **Knex** query builder. The codebase separates Community Edition (CE) and Enterprise Edition (EE) through directory prefixes.

**Key directories:**
```
packages/nocodb/src/
├── controllers/     # CE REST endpoints
├── services/        # CE business logic
├── models/          # CE database entities
├── db/              # Query execution layer
├── helpers/         # Utility functions
├── middlewares/     # Express/NestJS middleware
├── guards/          # Auth guards
├── decorators/      # Custom decorators
├── ee/              # Enterprise-only code
│   ├── controllers/
│   ├── services/
│   ├── models/
│   └── modules/
├── ee-cloud/        # Cloud variant overrides
└── ee-on-prem/      # On-premises variant
```

## Critical Rule: CE/EE Separation

**NEVER expose `ee/` folder content to open source.** The sync workflow uses `scripts/sync/exclude-list.txt` to filter out EE code.

**EE patterns extend CE through class inheritance:**
```typescript
// src/ee/services/my.service.ts
import { MyServiceCE } from 'src/services/my.service';

@Injectable()
export class MyService extends MyServiceCE {
  // Override or extend CE functionality
}
```

## Development Workflows

### Workflow 1: Add New API Endpoint (CE)

> **IMPORTANT: Use Internal Controllers, NOT direct controllers.**
> All new API endpoints should use the **internal controller pattern** with `operationScopes.ts` + `UiPost.operations.ts` / `UiGet.operations.ts`. Do NOT create direct controller files (e.g., `{feature}.controller.ts`) — these are legacy patterns. The internal controller dispatches operations through a centralized routing system.

1. **Determine the feature scope**
    - CE feature → Files in `src/services/`, `src/models/`, and internal controller modules
    - EE feature → Files in `src/ee/services/`, `src/ee/models/`, etc.

2. **Register operations in internal controllers**

   a. **Add operation scopes** (`src/controllers/internal/operationScopes.ts`)
   ```typescript
   export const OPERATION_SCOPES = {
     // ... existing operations
     {feature}Get: 'base',
     {feature}Create: 'base',
     {feature}Update: 'base',
   }
   ```

   b. **Add GET operations** (`src/controllers/internal/modules/UiGet.operations.ts`)
    - Import your service
    - Add to constructor injection
    - Add operation names to `operations` array
    - Add handler cases to `handle()` switch statement
   ```typescript
   case '{feature}Get':
     return await this.{feature}Service.get(context, {
       {feature}Id: req.query.{feature}Id as string,
     });
   ```

   c. **Add POST operations** (`src/controllers/internal/modules/UiPost.operations.ts`)
    - Import your service
    - Add to constructor injection
    - Add operation names to `operations` array
    - Add handler cases to `handle()` switch statement
   ```typescript
   case '{feature}Create':
     return await this.{feature}Service.create(context, {
       body: payload,
       tableId: req.query.tableId,
       user: req.user,
       req,
     });
   ```

3. **Create the service** (`src/services/{feature}.service.ts`)
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { AppEvents } from 'nocodb-sdk';
   import type { NcRequest } from '~/interface/config';
   import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
   import { validatePayload } from '~/helpers';
   import { {Feature} } from '~/models';

   @Injectable()
   export class {Feature}Service {
     constructor(protected readonly appHooksService: AppHooksService) {}

     async list(param: { userId: string; req: NcRequest }) {
       return await {Feature}.list(param.userId);
     }

     async create(param: { body: any; userId: string; req: NcRequest }) {
       validatePayload('swagger.json#/components/schemas/{Feature}Req', param.body);

       const result = await {Feature}.insert({ ...param.body, fk_user_id: param.userId });

       this.appHooksService.emit(AppEvents.{FEATURE}_CREATE, {
         userId: param.userId,
         req: param.req,
       });

       return result;
     }
   }
   ```

4. **Create the model** (`src/models/{Feature}.ts`)
   ```typescript
   import type { {Feature}Type } from 'nocodb-sdk';
   import { CacheScope, MetaTable, RootScopes } from '~/utils/globals';
   import Noco from '~/Noco';
   import NocoCache from '~/cache/NocoCache';

   export default class {Feature} implements {Feature}Type {
     id?: string;
     // ... properties

     constructor(data: Partial<{Feature}>) {
       Object.assign(this, data);
     }

     public static async insert(data: Partial<{Feature}>, ncMeta = Noco.ncMeta) {
       const result = await ncMeta.metaInsert2(
         RootScopes.ROOT,
         RootScopes.ROOT,
         MetaTable.{FEATURE}S,
         data,
         true,
       );
       return this.castType(result);
     }

     public static async list(userId: string, ncMeta = Noco.ncMeta) {
       const list = await ncMeta.metaList2(
         RootScopes.ROOT,
         RootScopes.ROOT,
         MetaTable.{FEATURE}S,
         { condition: { fk_user_id: userId } },
       );
       return list?.map((item) => this.castType(item));
     }

     public static castType(data: {Feature}): {Feature} {
       return data && new {Feature}(data);
     }
   }
   ```

5. **Create the spec file** (`src/services/{feature}.service.spec.ts`)
   ```typescript
   import { Test } from '@nestjs/testing';
   import { {Feature}Service } from './{feature}.service';
   import type { TestingModule } from '@nestjs/testing';

   describe('{Feature}Service', () => {
     let service: {Feature}Service;

     beforeEach(async () => {
       const module: TestingModule = await Test.createTestingModule({
         providers: [{Feature}Service],
       }).compile();

       service = module.get<{Feature}Service>({Feature}Service);
     });

     it('should be defined', () => {
       expect(service).toBeDefined();
     });
   });
   ```

6. **Add ACL permissions** in **BOTH** CE and EE:
    - CE: `src/utils/acl.ts` — add operation names with role permissions
    - EE: `src/ee/utils/acl.ts` — mirror the same entries
    - The operation name (e.g., `{feature}Create`) IS the ACL key

7. **Register service in noco.module.ts** (`src/modules/noco.module.ts`)
    - Add service to `providers` array
    - Note: Do NOT add controllers — internal controllers handle routing automatically

### Workflow 2: Add EE-Only Feature

1. **Create EE service extending CE** (`src/ee/services/{feature}.service.ts`)
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { {Feature}Service as {Feature}ServiceCE } from 'src/services/{feature}.service';
   import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

   @Injectable()
   export class {Feature}Service extends {Feature}ServiceCE {
     constructor(protected readonly appHooksService: AppHooksService) {
       super(appHooksService);
     }

     // Override methods or add new EE-specific methods
     async eeSpecificMethod(param: { ... }) {
       // EE-only logic
     }
   }
   ```

2. **Create EE controller if needed** (`src/ee/controllers/{feature}.controller.ts`)

3. **Register in EE module** (`src/ee/modules/noco.module.ts`)
    - Import from EE path, not CE path
    - Module system will use EE version when built with EE flag

### Workflow 3: Database Migration

> **IMPORTANT: Always add migrations in `v0/` directory.**
> The `v1/`, `v2/`, and `v3/` migration directories are deprecated. All new migrations go in `v0/` and are registered in `XcMigrationSourcev0.ts`.

1. **Determine next migration number**
   ```bash
   ls packages/nocodb/src/meta/migrations/v0/ | grep -E '^nc_[0-9]+' | sort | tail -1
   ```

2. **Create migration file** (`src/meta/migrations/v0/nc_{XXX}_{description}.ts`)
   ```typescript
   import type { Knex } from 'knex';
   import { MetaTable } from '~/utils/globals';

   const up = async (knex: Knex) => {
     await knex.schema.alterTable(MetaTable.{TABLE}, (table) => {
       table.string('new_column', 255);
       table.index('new_column');
     });
   };

   const down = async (knex: Knex) => {
     await knex.schema.alterTable(MetaTable.{TABLE}, (table) => {
       table.dropIndex('new_column');
       table.dropColumn('new_column');
     });
   };

   export { up, down };
   ```

3. **Register migration in XcMigrationSourcev0.ts**
    - Add import for new migration
    - Add to migrations array in `getMigrations()`
    - Add case to `getMigration()` switch statement

4. **Update MetaTable enum** in `src/utils/globals.ts` if adding new table

5. **Primary keys and scoping depend on entity scope:**
    - **Base scope** (views, columns, sorts, filters): composite PK `['base_id', 'id']` or `['base_id', 'fk_view_id']` + include `fk_workspace_id`
    - **Workspace scope** (e.g., workspace-level settings): just `id` PK + include `fk_workspace_id`, no `base_id`
    - **Org scope** (e.g., users, API tokens): just `id` PK, no `fk_workspace_id` or `base_id`

### Workflow 4: Add New Model/Entity

> **CRITICAL: Always update BOTH CE and EE globals and meta.service files.**
> The EE `globals.ts` and `meta.service.ts` are **separate overrides** that do not inherit from CE. If you add a new MetaTable/CacheScope in CE, you MUST also add it in the EE versions or the enum values will resolve to `undefined` at runtime.

1. **Define the model** in `src/models/{Feature}.ts`

2. **Add to MetaTable enum** in **BOTH** locations:

   a. **CE** (`src/utils/globals.ts`)
   ```typescript
   export enum MetaTable {
     // ... existing tables
     {FEATURE}S = 'nc_{feature}s',
   }
   ```

   b. **EE** (`src/ee/utils/globals.ts`) — **MUST mirror CE entries**
   ```typescript
   export enum MetaTable {
     // ... existing tables (this overrides CE enum entirely)
     {FEATURE}S = 'nc_{feature}s',
   }
   ```
   Also update `BaseRelatedMetaTables` and `orderedMetaTables` arrays in EE globals.

3. **Add CacheScope** in **BOTH** CE and EE `globals.ts`

4. **Add nanoid prefixes** in **BOTH** meta.service files:
    - CE: `src/meta/meta.service.ts` → `genNanoid()` prefixMap
    - EE: `src/ee/meta/meta.service.ts` → `genNanoid()` prefixMap

5. **Create migration** for the new table

6. **Add SDK types** in `packages/nocodb-sdk` (Do not manually modify Api.ts. It is aauto-generated from swagger located in `packages/nocodb/src/schema/swagger.json`)

## Key Conventions

### File Naming
- Controllers: `{feature}.controller.ts`
- Services: `{feature}.service.ts`
- Models: `{Feature}.ts` (PascalCase)
- Specs: `{feature}.service.spec.ts`
- Migrations: `nc_{number}_{description}.ts`

### Import Aliases
- `~/` → `src/` (configured in tsconfig)
- `src/` → CE source (used in EE imports)

### API Versioning
- Support both v1 and v2 routes: `@Get(['/api/v1/...', '/api/v2/...'])`
- v3 endpoints in `src/ee/controllers/v3/`

### Error Handling
```typescript
import { NcError } from '~/helpers/catchError';

// Usage
NcError.notFound('Resource not found');
NcError.badRequest('Invalid input');
NcError.unauthorized('Not authorized');
```

### Validation
```typescript
import { validatePayload } from '~/helpers';

validatePayload('swagger.json#/components/schemas/SchemaName', body);
```

### Caching Pattern
```typescript
import NocoCache from '~/cache/NocoCache';
import { CacheScope, CacheGetType, CacheDelDirection } from '~/utils/globals';

// Get from cache
const cached = await NocoCache.get('context', `${CacheScope.FEATURE}:${id}`, CacheGetType.TYPE_OBJECT);

// Set cache
await NocoCache.set('context', `${CacheScope.FEATURE}:${id}`, data);

// Delete from cache
await NocoCache.deepDel('context', `${CacheScope.FEATURE}:${id}`, CacheDelDirection.CHILD_TO_PARENT);
```

### Event Emission
```typescript
import { AppEvents } from 'nocodb-sdk';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

this.appHooksService.emit(AppEvents.FEATURE_CREATE, { userId, req, ...data });
```

## Build & Test Commands

```bash
# Development
pnpm run watch:run           # CE dev server
pnpm run watch:run:ee        # EE dev server

# Build
pnpm run build               # CE build
pnpm run build:on-prem       # EE on-prem build
pnpm run build:cloud         # EE cloud build

# Test
pnpm test:unit               # Unit tests
pnpm test:unit:pg:ee         # PostgreSQL + EE tests
```

## Quick Scaffolding

Use the scaffolding script to generate boilerplate files:

```bash
# Create a CE feature with all files (controller, service, model, spec, migration)
python .skills/nocohub-backend/scripts/scaffold-feature.py bookmark

# Create CE + EE feature
python .skills/nocohub-backend/scripts/scaffold-feature.py workspace-tag --ee

# Create feature without migration
python .skills/nocohub-backend/scripts/scaffold-feature.py note --no-migration
```

The script generates files and prints next steps for manual registration.

## Reference Files

- **Patterns & Templates**: See [references/patterns.md](references/patterns.md) for complete code examples
- **MetaTable Reference**: See [references/meta-tables.md](references/meta-tables.md) for database table enums
- **View Creation Guide**: See [references/view-creation.md](references/view-creation.md) for adding a new view type (meta layer)
- **Unit Testing Guide**: See [references/unit-testing.md](references/unit-testing.md) for test architecture, writing tests, running tests
- **Sync Exclusions**: See `scripts/sync/exclude-list.txt` for CE/EE sync rules
