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

1. **Determine the feature scope**
   - CE feature → Files in `src/controllers/`, `src/services/`, `src/models/`
   - EE feature → Files in `src/ee/controllers/`, `src/ee/services/`, etc.

2. **Create the controller** (`src/controllers/{feature}.controller.ts`)
   ```typescript
   import { Controller, Get, Post, UseGuards, Req, Body, Param } from '@nestjs/common';
   import { GlobalGuard } from '~/guards/global/global.guard';
   import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
   import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
   import { NcRequest } from '~/interface/config';
   import { {Feature}Service } from '~/services/{feature}.service';

   @Controller()
   @UseGuards(MetaApiLimiterGuard, GlobalGuard)
   export class {Feature}Controller {
     constructor(private readonly {feature}Service: {Feature}Service) {}

     @Get(['/api/v1/db/meta/{resource}', '/api/v2/meta/{resource}'])
     @Acl('{feature}List')
     async list(@Req() req: NcRequest) {
       return await this.{feature}Service.list({ userId: req['user'].id, req });
     }

     @Post(['/api/v1/db/meta/{resource}', '/api/v2/meta/{resource}'])
     @HttpCode(200)
     @Acl('{feature}Create')
     async create(@Req() req: NcRequest, @Body() body) {
       return await this.{feature}Service.create({ body, userId: req['user'].id, req });
     }
   }
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

6. **Register in noco.module.ts** (`src/modules/noco.module.ts`)
   - Add controller to `controllers` array
   - Add service to `providers` array

7. **Add ACL permissions** in the middleware configuration

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

1. **Determine next migration number**
   ```bash
   ls packages/nocodb/src/meta/migrations/v2/ | grep -E '^nc_[0-9]+' | sort | tail -1
   ```

2. **Create migration file** (`src/meta/migrations/v2/nc_{XXX}_{description}.ts`)
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

3. **Register migration in XcMigrationSourcev2.ts**
   - Add import for new migration
   - Add to migrations array

4. **Update MetaTable enum** in `src/utils/globals.ts` if adding new table

### Workflow 4: Add New Model/Entity

1. **Define the model** in `src/models/{Feature}.ts`

2. **Add to MetaTable enum** (`src/utils/globals.ts`)
   ```typescript
   export enum MetaTable {
     // ... existing tables
     {FEATURE}S = 'nc_{feature}s',
   }
   ```

3. **Add CacheScope** if caching needed (`src/utils/globals.ts`)
   ```typescript
   export enum CacheScope {
     // ... existing scopes
     {FEATURE} = '{feature}',
   }
   ```

4. **Create migration** for the new table

5. **Add SDK types** in `packages/nocodb-sdk/src/lib/Api.ts` (auto-generated from swagger)

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
- **Sync Exclusions**: See `scripts/sync/exclude-list.txt` for CE/EE sync rules
