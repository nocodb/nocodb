# Code Patterns & Templates

## Table of Contents
1. [Controller Patterns](#controller-patterns)
2. [Service Patterns](#service-patterns)
3. [Model Patterns](#model-patterns)
4. [Cache Patterns](#cache-patterns)
5. [Migration Patterns](#migration-patterns)
6. [EE Extension Patterns](#ee-extension-patterns)
7. [Guard & Decorator Patterns](#guard--decorator-patterns)
8. [Testing Patterns](#testing-patterns)

## Controller Patterns

> **Note:** Direct controller files are a **legacy pattern**. New endpoints should use the **internal controller pattern** (`operationScopes.ts` + `UiPost.operations.ts` / `UiGet.operations.ts`). The patterns below are kept for reference when working with existing controllers.

### Basic CRUD Controller (Legacy)
```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcRequest } from '~/interface/config';
import { FeatureService } from '~/services/feature.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FeatureController {
  constructor(private readonly featureService: FeatureService) {}

  // List with pagination
  @Get(['/api/v1/db/meta/bases/:baseId/features', '/api/v2/meta/bases/:baseId/features'])
  @Acl('featureList')
  async list(@Req() req: NcRequest, @Query('limit') limit?: number, @Query('offset') offset?: number) {
    return new PagedResponseImpl(
      await this.featureService.list({
        baseId: req.ncBaseId,
        limit: limit ? +limit : undefined,
        offset: offset ? +offset : undefined,
        req,
      }),
    );
  }

  // Get single
  @Get(['/api/v1/db/meta/features/:featureId', '/api/v2/meta/features/:featureId'])
  @Acl('featureRead')
  async get(@Param('featureId') featureId: string, @Req() req: NcRequest) {
    return await this.featureService.get({ featureId, req });
  }

  // Create
  @Post(['/api/v1/db/meta/bases/:baseId/features', '/api/v2/meta/bases/:baseId/features'])
  @HttpCode(200)
  @Acl('featureCreate')
  async create(@Req() req: NcRequest, @Body() body: FeatureReqType) {
    return await this.featureService.create({
      baseId: req.ncBaseId,
      feature: body,
      userId: req.user.id,
      req,
    });
  }

  // Update
  @Patch(['/api/v1/db/meta/features/:featureId', '/api/v2/meta/features/:featureId'])
  @Acl('featureUpdate')
  async update(@Param('featureId') featureId: string, @Body() body: FeatureReqType, @Req() req: NcRequest) {
    return await this.featureService.update({
      featureId,
      feature: body,
      req,
    });
  }

  // Delete
  @Delete(['/api/v1/db/meta/features/:featureId', '/api/v2/meta/features/:featureId'])
  @Acl('featureDelete')
  async delete(@Param('featureId') featureId: string, @Req() req: NcRequest) {
    return await this.featureService.delete({ featureId, req });
  }
}
```

### Bulk Operations Controller
```typescript
@Post(['/api/v2/meta/bases/:baseId/features/bulk'])
@HttpCode(200)
@Acl('featureBulkCreate')
async bulkCreate(@Req() req: NcRequest, @Body() body: FeatureReqType[]) {
  return await this.featureService.bulkCreate({
    baseId: req.ncBaseId,
    features: body,
    userId: req.user.id,
    req,
  });
}

@Delete(['/api/v2/meta/bases/:baseId/features/bulk'])
@Acl('featureBulkDelete')
async bulkDelete(@Req() req: NcRequest, @Body() body: { ids: string[] }) {
  return await this.featureService.bulkDelete({
    baseId: req.ncBaseId,
    ids: body.ids,
    req,
  });
}
```

## Service Patterns

### Basic Service with Events
```typescript
import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { Feature } from '~/models';

@Injectable()
export class FeatureService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async list(param: { baseId: string; limit?: number; offset?: number; req: NcRequest }) {
    const features = await Feature.list(param.baseId, {
      limit: param.limit,
      offset: param.offset,
    });
    return features;
  }

  async get(param: { featureId: string; req: NcRequest }) {
    const feature = await Feature.get(param.featureId);
    if (!feature) {
      NcError.notFound('Feature not found');
    }
    return feature;
  }

  async create(param: { baseId: string; feature: FeatureReqType; userId: string; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/FeatureReq', param.feature);

    const feature = await Feature.insert({
      ...param.feature,
      fk_base_id: param.baseId,
      fk_user_id: param.userId,
    });

    this.appHooksService.emit(AppEvents.FEATURE_CREATE, {
      feature,
      userId: param.userId,
      req: param.req,
    });

    return feature;
  }

  async update(param: { featureId: string; feature: FeatureReqType; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/FeatureReq', param.feature);

    const existing = await Feature.get(param.featureId);
    if (!existing) {
      NcError.notFound('Feature not found');
    }

    await Feature.update(param.featureId, param.feature);

    this.appHooksService.emit(AppEvents.FEATURE_UPDATE, {
      featureId: param.featureId,
      feature: param.feature,
      req: param.req,
    });

    return await Feature.get(param.featureId);
  }

  async delete(param: { featureId: string; req: NcRequest }) {
    const feature = await Feature.get(param.featureId);
    if (!feature) {
      NcError.notFound('Feature not found');
    }

    await Feature.delete(param.featureId);

    this.appHooksService.emit(AppEvents.FEATURE_DELETE, {
      featureId: param.featureId,
      req: param.req,
    });

    return true;
  }
}
```

### Service with Transaction
```typescript
async createWithRelations(param: { ... }) {
  const ncMeta = Noco.ncMeta;

  return await ncMeta.withTransaction(async (trx) => {
    const feature = await Feature.insert(data, trx);

    await FeatureRelation.insert({
      fk_feature_id: feature.id,
      ...relationData,
    }, trx);

    return feature;
  });
}
```

## Model Patterns

### Complete Model Example

> **Note:** Most models use the `NcContext` pattern (workspace_id + base_id scoping) rather than `RootScopes`. Only use `RootScopes.ROOT` for truly global entities (e.g., users, API tokens). View/table-scoped entities use `context.workspace_id` and `context.base_id`.

```typescript
import type { FeatureType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse, stringifyMetaProp } from '~/utils/modelUtils';

export default class Feature implements FeatureType {
  id?: string;
  title?: string;
  description?: string;
  fk_base_id?: string;
  fk_user_id?: string;
  meta?: Record<string, any>;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<Feature>) {
    Object.assign(this, data);
  }

  // INSERT
  public static async insert(context: NcContext, data: Partial<Feature>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(data, [
      'title',
      'description',
      'fk_base_id',
      'fk_user_id',
      'meta',
    ]);

    if (insertObj.meta) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FEATURES,
      insertObj,
      true,
    );

    return this.get(context, id, ncMeta);
  }

  // GET BY ID
  public static async get(context: NcContext, featureId: string, ncMeta = Noco.ncMeta): Promise<Feature | null> {
    let data = await NocoCache.get(
      context,
      `${CacheScope.FEATURE}:${featureId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FEATURES,
        featureId,
      );

      data = prepareForResponse(data);

      if (data) {
        await NocoCache.set(context, `${CacheScope.FEATURE}:${featureId}`, data);
      }
    }

    return data && new Feature(data);
  }

  // LIST
  public static async list(
    context: NcContext,
    { condition, limit, offset }: { condition?: Record<string, any>; limit?: number; offset?: number } = {},
    ncMeta = Noco.ncMeta,
  ): Promise<Feature[]> {
    const cachedList = await NocoCache.getList(context, CacheScope.FEATURE, [condition?.fk_base_id]);
    let { list } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !list.length) {
      list = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FEATURES,
        { condition, limit, offset },
      );
      await NocoCache.setList(context, CacheScope.FEATURE, [condition?.fk_base_id], list);
    }

    return list.map((item) => new Feature(item));
  }

  // UPDATE
  public static async update(context: NcContext, featureId: string, data: Partial<Feature>, ncMeta = Noco.ncMeta) {
    const updateObj = extractProps(data, ['title', 'description', 'meta']);

    if (updateObj.meta) {
      updateObj.meta = stringifyMetaProp(updateObj);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FEATURES,
      prepareForDb(updateObj),
      featureId,
    );

    await NocoCache.update(context, `${CacheScope.FEATURE}:${featureId}`, prepareForResponse(updateObj));

    return this.get(context, featureId, ncMeta);
  }

  // DELETE
  public static async delete(context: NcContext, featureId: string, ncMeta = Noco.ncMeta) {
    // Always clear cache BEFORE or alongside DB delete
    await NocoCache.deepDel(
      context,
      `${CacheScope.FEATURE}:${featureId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.FEATURES,
      featureId,
    );
  }
}
```

## Cache Patterns

### Insert Order — CRITICAL

When inserting a new record that belongs to a cached list, you **must** call `get()` before `appendToList()`. The `appendToList` method reads the value at the cache key to set `parentKeys`. If the value doesn't exist yet, it logs an error and fails to set parentKeys, which breaks later `deepDel(CHILD_TO_PARENT)` calls.

```typescript
// ✓ CORRECT — get() caches the item BEFORE appendToList reads it
const { id } = await ncMeta.metaInsert2(
  context.workspace_id, context.base_id, MetaTable.MY_TABLE, insertObj,
);

return this.get(context, id, ncMeta).then(async (item) => {
  await NocoCache.appendToList(
    context,
    CacheScope.MY_SCOPE,
    [parentId],
    `${CacheScope.MY_SCOPE}:${id}`,
  );
  return item;
});

// ✗ WRONG — appendToList can't find the value, logs "value is empty", parentKeys never set
const { id } = await ncMeta.metaInsert2(...);
await NocoCache.appendToList(context, CacheScope.MY_SCOPE, [parentId], `${CacheScope.MY_SCOPE}:${id}`);
return this.get(context, id, ncMeta);  // Too late — parentKeys already missing
```

**Reference models using correct pattern:** `GalleryViewColumn.insert()`, `Sort.insert()`

### Cache List Operations

| Operation | Method | When to Use |
|-----------|--------|-------------|
| **setList** | `NocoCache.setList(context, scope, [parentId], items)` | Bulk rebuild — clears old list + children, rebuilds from scratch |
| **getList** | `NocoCache.getList(context, scope, [parentId])` | Read list — returns `{ list, isNoneList }`. If miss, load from DB then `setList` |
| **appendToList** | `NocoCache.appendToList(context, scope, [parentId], key)` | Add single item to existing list. **Returns false if list doesn't exist** (no-op, not an error) |

**Lazy initialization pattern:** `appendToList` after insert is an optimization. If the list isn't cached, `appendToList` is a no-op and the next `getList` call loads from DB + calls `setList`. This is safe — don't worry if `appendToList` returns false.

### Delete & Cache Invalidation

```typescript
// DELETE SINGLE ITEM — remove from all parent lists, then delete
await NocoCache.deepDel(
  context,
  `${CacheScope.MY_SCOPE}:${itemId}`,
  CacheDelDirection.CHILD_TO_PARENT,  // "I'm deleting this child, update my parents"
);
await ncMeta.metaDelete(context.workspace_id, context.base_id, MetaTable.MY_TABLE, itemId);

// DELETE ENTIRE LIST — delete all children in the list, then delete the list
await NocoCache.deepDel(
  context,
  `${CacheScope.MY_SCOPE}:${parentId}`,
  CacheDelDirection.PARENT_TO_CHILD,  // "I'm deleting this list, kill all children"
);
await ncMeta.metaDelete(context.workspace_id, context.base_id, MetaTable.MY_TABLE, { fk_parent_id: parentId });
```

> **CRITICAL:** `metaDelete` does NOT clear cache. Always pair DB deletes with cache operations.

> **CRITICAL:** The third arg to `deepDel` must be `CacheDelDirection.CHILD_TO_PARENT` or `CacheDelDirection.PARENT_TO_CHILD` — NOT a `CacheScope` value. They're different enums with string values that look similar but behave completely differently.

### Bulk Cleanup Pattern

When deleting multiple child records by condition (e.g., all sorts for a level):

```typescript
// 1. Query records to get IDs
const records = await ncMeta.metaList2(
  context.workspace_id, context.base_id,
  MetaTable.SORT,
  { condition: { fk_level_id: levelId } },
);

// 2. Remove each from cache (removes from parent list + deletes individual cache)
for (const record of records) {
  await NocoCache.deepDel(
    context,
    `${CacheScope.SORT}:${record.id}`,
    CacheDelDirection.CHILD_TO_PARENT,
  );
}

// 3. Bulk DB delete
await ncMeta.metaDelete(
  context.workspace_id, context.base_id,
  MetaTable.SORT,
  { fk_level_id: levelId },
);
```

### Cache Update

For in-place updates (no list membership change):

```typescript
await ncMeta.metaUpdate(
  context.workspace_id, context.base_id,
  MetaTable.MY_TABLE, prepareForDb(updateObj), itemId,
);
await NocoCache.update(
  context,
  `${CacheScope.MY_SCOPE}:${itemId}`,
  prepareForResponse(updateObj),
);
```

---

## Migration Patterns

### Add Column
```typescript
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FEATURES, (table) => {
    table.string('new_field', 255);
    table.boolean('is_active').defaultTo(true);
    table.text('metadata');
    table.index('new_field');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FEATURES, (table) => {
    table.dropIndex('new_field');
    table.dropColumn('new_field');
    table.dropColumn('is_active');
    table.dropColumn('metadata');
  });
};

export { up, down };
```

### Create New Table

> **Note:** Primary keys and scoping depend on entity scope. NocoDB does NOT use foreign key constraints — FK columns are just regular string columns.
> - **Base scope** (views, columns, sorts, filters): composite PK `['base_id', 'id']` + `fk_workspace_id`
> - **Workspace scope** (workspace-level settings): just `id` PK + `fk_workspace_id`, no `base_id`
> - **Org scope** (users, API tokens): just `id` PK, no `fk_workspace_id` or `base_id`
>
> The example below shows the **base scope** pattern (most common for view-related tables).

```typescript
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.FEATURES, (table) => {
    table.string('id', 20);
    table.string('base_id', 20);
    table.string('source_id', 128);
    table.string('title', 255);
    table.text('description');
    table.string('fk_user_id', 20);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.FEATURES);
};

export { up, down };
```

### Data Migration
```typescript
const up = async (knex: Knex) => {
  // Add column
  await knex.schema.alterTable(MetaTable.FEATURES, (table) => {
    table.string('status', 50).defaultTo('active');
  });

  // Migrate existing data
  await knex(MetaTable.FEATURES)
    .where('is_active', true)
    .update({ status: 'active' });

  await knex(MetaTable.FEATURES)
    .where('is_active', false)
    .update({ status: 'inactive' });
};
```

## EE Extension Patterns

### Service Extension
```typescript
// src/ee/services/feature.service.ts
import { Injectable } from '@nestjs/common';
import { FeatureService as FeatureServiceCE } from 'src/services/feature.service';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { LicenseService } from '~/services/license.service';

@Injectable()
export class FeatureService extends FeatureServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly licenseService: LicenseService,
  ) {
    super(appHooksService);
  }

  // Override CE method
  async create(param: { ... }) {
    // EE-specific validation
    await this.licenseService.validateFeature('advanced_feature');

    // Call parent implementation
    return super.create(param);
  }

  // Add EE-only method
  async advancedFeature(param: { ... }) {
    // EE-only logic
  }
}
```

### Controller Extension
```typescript
// src/ee/controllers/feature.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureController as FeatureControllerCE } from 'src/controllers/feature.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FeatureController extends FeatureControllerCE {
  // Add EE-only endpoints
  @Get(['/api/v2/meta/features/:featureId/advanced'])
  @Acl('featureAdvancedRead')
  async getAdvanced(@Param('featureId') featureId: string) {
    return await this.featureService.getAdvanced({ featureId });
  }
}
```

## Guard & Decorator Patterns

### Custom Guard
```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class FeatureGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (!request.user) {
      NcError.unauthorized('Not authenticated');
    }

    // Custom logic
    return true;
  }
}
```

### Custom Decorator
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Usage: @CurrentUser() user: User
// Usage: @CurrentUser('id') userId: string
```

## Testing Patterns

### Service Unit Test
```typescript
import { Test } from '@nestjs/testing';
import { FeatureService } from './feature.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import type { TestingModule } from '@nestjs/testing';

describe('FeatureService', () => {
  let service: FeatureService;
  let appHooksService: AppHooksService;

  const mockAppHooksService = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureService,
        { provide: AppHooksService, useValue: mockAppHooksService },
      ],
    }).compile();

    service = module.get<FeatureService>(FeatureService);
    appHooksService = module.get<AppHooksService>(AppHooksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a feature', async () => {
      const mockFeature = { id: '1', title: 'Test' };
      jest.spyOn(Feature, 'insert').mockResolvedValue(mockFeature);

      const result = await service.create({
        baseId: 'base1',
        feature: { title: 'Test' },
        userId: 'user1',
        req: {} as NcRequest,
      });

      expect(result).toEqual(mockFeature);
      expect(mockAppHooksService.emit).toHaveBeenCalledWith(
        AppEvents.FEATURE_CREATE,
        expect.any(Object),
      );
    });
  });
});
```

### Controller Unit Test
```typescript
import { Test } from '@nestjs/testing';
import { FeatureController } from './feature.controller';
import { FeatureService } from '~/services/feature.service';

describe('FeatureController', () => {
  let controller: FeatureController;
  let service: FeatureService;

  const mockService = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FeatureController],
      providers: [{ provide: FeatureService, useValue: mockService }],
    }).compile();

    controller = module.get<FeatureController>(FeatureController);
    service = module.get<FeatureService>(FeatureService);
  });

  it('should list features', async () => {
    const features = [{ id: '1' }];
    mockService.list.mockResolvedValue(features);

    const req = { ncBaseId: 'base1', user: { id: 'user1' } } as any;
    const result = await controller.list(req);

    expect(result.list).toEqual(features);
  });
});
```