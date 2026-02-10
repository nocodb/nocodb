# Backend Architecture (NocoDB - NestJS)

## Directory Structure

Location: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/`

```
src/
├── controllers/          # 97 CE REST endpoint handlers
├── services/            # 114 CE business logic services
├── models/              # 70 database entity models
├── db/                  # Query execution & data access layer
│   └── BaseModelSqlv2.ts (209KB) - Main SQL query builder
├── middlewares/         # Request processing middleware
├── guards/              # Authentication & authorization guards
├── decorators/          # Custom NestJS decorators
├── helpers/             # 64+ utility function files
├── utils/               # 52+ utility modules (ACL, builders, etc.)
├── modules/             # NestJS module definitions
│   ├── noco.module.ts   # All CE controllers & services
│   ├── jobs/            # Background job processing
│   └── oauth/           # OAuth integration
├── interface/           # TypeScript interfaces & types
├── meta/                # Database metadata management
│   └── migrations/      # Database schema migrations
├── cache/               # Caching layer (NocoCache)
├── filters/             # Exception filters
├── interceptors/        # Response/request interceptors
├── plugins/             # 24+ plugin integrations (S3, Discord, Slack, etc.)
├── strategies/          # Passport authentication strategies
├── gateways/            # WebSocket gateway (Socket.io)
├── redis/               # Redis client wrappers
├── schema/              # Schema generation & management
├── version-upgrader/    # Database upgrade migrations
├── run/                 # Runtime entry points (local, docker, cloud)
└── ee/                  # ENTERPRISE EDITION
    ├── controllers/     # 33 EE controllers (additional + overrides)
    ├── services/        # 30+ EE service extensions
    ├── models/          # EE-specific models
    ├── modules/         # EE modules (auth, oauth, payment, jobs)
    ├── strategies/      # EE auth (SSO, SAML, Google, OpenID, Cognito)
    └── [mirrors CE structure]
```

## Entry Points

### Main Application
**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/main.ts`

Bootstrap flow:
1. Express server created with CORS, trust proxy
2. `Noco.init()` initializes NestJS app and modules
3. Server listens on port 8080

### Core Singleton
**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/Noco.ts`

Manages global instances:
- `Noco.ncMeta` - Meta database connection
- `Noco.ncAudit` - Audit trail
- `Noco._nestApp` - NestJS application
- `Noco._httpServer` - HTTP server
- `Noco.ncDefaultWorkspaceId` - Default workspace ID

### App Module
**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/app.module.ts`

Middleware chain:
1. `RawBodyMiddleware` - For webhooks (/api/payment/webhook)
2. `JsonBodyMiddleware` - JSON parsing (all routes)
3. `UrlEncodeMiddleware` - URL encoding (all routes)
4. `GuiMiddleware` - Serves frontend assets
5. `GlobalMiddleware` - Global request handling

### Noco Module
**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/noco.module.ts`

Registers 100+ controllers and 100+ services:
- ApiTokensController/Service
- AttachmentsController/Service
- BasesController/Service
- ColumnsController/Service
- TablesController/Service
- ViewsController/Service
- And 90+ more pairs

## Request Flow Pattern

### Typical Request Path

```
HTTP Request
  ↓
Middleware Stack (Global, JSON, etc.)
  ↓
Guards (GlobalGuard: JWT auth + MetaApiLimiterGuard: rate limiting)
  ↓
Extract-IDs Middleware (ACL enforcement, context enrichment)
  ↓
Controller Method (@Acl decorator checks permissions)
  ↓
Service Layer (business logic)
  ↓
Model Layer (data access via ncMeta)
  ↓
Database (meta tables or user data)
```

### Example: List Bases

```typescript
// Controller: /src/controllers/bases.controller.ts
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BasesController {
  @Acl('baseList', { scope: 'org' })
  @Get(['/api/v1/db/meta/projects/', '/api/v2/meta/bases/'])
  async list(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest
  ) {
    return await this.basesService.baseList(context, {
      user: req.user,
      query: req.query
    });
  }
}

// Service: /src/services/bases.service.ts
@Injectable()
export class BasesService {
  async baseList(context: NcContext, param: { user, query }) {
    const bases = await Base.list(context, param.user.id);
    this.appHooksService.emit(AppEvents.BASE_LIST, { ... });
    return bases;
  }
}

// Model: /src/models/Base.ts
export default class Base implements BaseType {
  public static async list(context: NcContext, userId: string) {
    const list = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.BASES,
      { condition: { fk_user_id: userId } }
    );
    return list?.map((item) => this.castType(item));
  }
}
```

## Authentication & Authorization

### Guards

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/guards/global/global.guard.ts`

GlobalGuard handles multiple auth strategies:
1. JWT token (xc-auth header)
2. API token (xc-token header)
3. Bearer token (Authorization header)
4. Public/shared base tokens

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/guards/meta-api-limiter.guard.ts`

Rate limiting for meta API endpoints.

### Strategies

**CE Strategies** (`/src/strategies/`):
- `jwt.strategy.ts` - JWT validation
- `local.strategy.ts` - Username/password

**EE Strategies** (`/src/ee/strategies/`):
- `saml.strategy.ts` - SAML SSO
- `google.strategy.ts` - Google OAuth
- `openid.strategy.ts` - OpenID Connect
- `cognito.strategy.ts` - AWS Cognito
- `short-lived-token.strategy.ts` - Temporary tokens

### ACL (Access Control)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/utils/acl.ts`

Role hierarchy:
- **Organization**: SuperAdmin, Creator, Viewer
- **Workspace**: Owner, Creator, Editor, Viewer, Commenter
- **Base (Project)**: Owner, Creator, Editor, Viewer, Commenter, No-Access

ACL decorator usage:
```typescript
@Acl('baseList', { scope: 'org' })           // Organization scope
@Acl('tableUpdate', { scope: 'base' })       // Base scope
@Acl('dataList', { blockApiTokenAccess: true }) // Block API tokens
```

### Middleware: Extract-IDs

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/middlewares/extract-ids/extract-ids.middleware.ts`

Multi-role middleware that:
- Extracts workspace/base/table IDs from request
- Enriches `NcRequest.context` with tenant info
- Enforces ACL permissions via `@Acl()` decorator
- Implements both `CanActivate` and `NestMiddleware`

### Decorators

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/decorators/tenant-context.decorator.ts`

```typescript
export const TenantContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<NcRequest>();
    return request.context;  // Returns NcContext with workspace/base IDs
  },
);
```

## Database Layer

### Meta Database Access

Models use the global `ncMeta` instance:

```typescript
import Noco from '~/Noco';

// Inside model method:
const result = await Noco.ncMeta.metaInsert2(
  RootScopes.ROOT,           // Workspace scope
  RootScopes.ROOT,           // Base scope
  MetaTable.BASES,           // Table name
  { title, description }     // Data
);
```

**Common ncMeta methods**:
- `metaInsert2(workspace, base, table, data)`
- `metaUpdate2(workspace, base, table, data, condition)`
- `metaGet2(workspace, base, table, condition)`
- `metaList2(workspace, base, table, { condition, orderBy, limit })`
- `metaDelete(workspace, base, table, condition)`

### Meta Tables

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/utils/globals.ts`

Key meta tables (see [meta-tables-reference.md](./meta-tables-reference.md) for complete list):
- `MetaTable.BASES` ('nc_bases_v2') - Projects/bases
- `MetaTable.SOURCES` ('nc_sources_v2') - Data sources
- `MetaTable.MODELS` ('nc_models_v2') - Tables
- `MetaTable.COLUMNS` ('nc_columns_v2') - Columns
- `MetaTable.GRID_VIEW` ('nc_grid_view_v2') - Grid views
- `MetaTable.FORM_VIEW` ('nc_form_view_v2') - Form views
- `MetaTable.HOOKS` ('nc_hooks') - Webhooks
- And 90+ more

### BaseModelSqlv2 (Query Builder)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/db/BaseModelSqlv2.ts` (209KB)

Core data access layer for user data (not meta tables):
- CRUD operations with complex filters
- Nested record handling
- Relation management
- Aggregation queries
- Formula evaluation
- Lookup column handling

Subdirectories:
- `src/db/field-handler/` - Column type handlers
- `src/db/formulav2/` - Formula engine
- `src/db/links/` - Relation management
- `src/db/aggregations/` - Aggregation functions

## Caching Layer

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/cache/NocoCache.ts`

Usage pattern:
```typescript
// Get from cache
const cached = await NocoCache.get(
  context,
  `${CacheScope.BASE}:${baseId}`,
  CacheGetType.TYPE_OBJECT
);

// Set cache
await NocoCache.set(
  context,
  `${CacheScope.BASE}:${baseId}`,
  baseData
);

// Deep delete (with parent/child relationships)
await NocoCache.deepDel(
  context,
  `${CacheScope.BASE}:${baseId}`,
  CacheDelDirection.CHILD_TO_PARENT
);
```

**Cache Scopes** (from `src/utils/globals.ts`):
- `CacheScope.ROOT`
- `CacheScope.WORKSPACE`
- `CacheScope.BASE`
- `CacheScope.SOURCE`
- `CacheScope.TABLE`
- `CacheScope.COLUMN`
- `CacheScope.VIEW`
- And 15+ more

## Event System

### App Hooks

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/services/app-hooks/app-hooks.service.ts`

Event emission pattern:
```typescript
this.appHooksService.emit(AppEvents.BASE_CREATE, {
  userId: param.userId,
  req: param.req,
  base: result
});
```

**Event types** (from nocodb-sdk enums):
- `AppEvents.BASE_CREATE`, `AppEvents.BASE_UPDATE`, `AppEvents.BASE_DELETE`
- `AppEvents.TABLE_CREATE`, `AppEvents.TABLE_UPDATE`, `AppEvents.TABLE_DELETE`
- `AppEvents.COLUMN_CREATE`, `AppEvents.COLUMN_UPDATE`, `AppEvents.COLUMN_DELETE`
- `AppEvents.USER_SIGNUP`, `AppEvents.USER_SIGNIN`
- And 40+ more event types

### App Hooks Listener

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/services/app-hooks-listener.service.ts`

Listens to events and triggers:
- Webhook execution
- Notification delivery
- Audit logging
- Cache invalidation

## Job Processing

### Jobs Module

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/jobs/`

Files:
- `jobs.module.ts` - Module definition
- `jobs.service.ts` - Job queue service
- `jobs.processor.ts` - Job processing logic
- `jobs-event.service.ts` - Job events

**Job types**:
- Data export (CSV, Excel)
- Airtable import
- Attachment URL upload
- Source create/delete
- Webhook handling
- Thumbnail generation
- Meta sync

**Optional Redis Queue**: `/src/modules/jobs/redis/jobs.service.ts` for distributed processing via Bull queue.

## CE/EE Extension Pattern

### EE Directory Mirror

EE code in `/src/ee/` mirrors CE structure:

```
src/ee/
├── controllers/         # 33 additional/override controllers
│   ├── v3/              # V3 API endpoints (EE only)
│   ├── internal.controller.ts
│   ├── integrations.controller.ts
│   └── ...
├── services/            # 30+ service extensions
├── models/              # EE-specific models
├── modules/             # EE modules
│   ├── auth/            # EE auth extensions
│   ├── oauth/           # OAuth integration
│   ├── payment/         # Payment/billing
│   └── jobs/            # EE job types
└── [mirrors CE dirs]
```

### EE Service Extension

```typescript
// src/ee/services/bases.service.ts
import { BasesService as BasesServiceCE } from '../../services/bases.service';

@Injectable()
export class BasesService extends BasesServiceCE {
  // Override CE methods or add EE-specific methods
  async createWithTeam(context: NcContext, param: { ... }) {
    // EE-specific logic
  }
}
```

### EE Module Registration

EE modules override CE modules in NestJS DI:

```typescript
// src/ee/modules/noco-ee.module.ts
@Module({
  imports: [NocoModule],  // Import CE module
  providers: [
    // EE providers override CE providers
    { provide: BasesService, useClass: BasesServiceEE }
  ]
})
export class NocoEEModule {}
```

## Common Utilities

### Error Handling

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/helpers/catchError.ts`

```typescript
import { NcError } from 'nocodb-sdk';

throw NcError.badRequest('Invalid input');
throw NcError.unauthorized('Not authorized');
throw NcError.notFound('Base not found');
```

### Validation

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/helpers/validatePayload.ts`

```typescript
validatePayload(
  'swagger.json#/components/schemas/BaseReq',
  req.body
);
```

### Extracting Properties

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/helpers/extractProps.ts`

```typescript
const sanitized = extractProps(data, ['id', 'title', 'description']);
```

## Plugins

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/plugins/`

24+ plugin integrations:

**Storage**:
- `s3/`, `genericS3/`, `backblaze/`, `linode/`, `spaces/`, `minio/`, `gcs/`, `vultr/`, `scaleway/`, `upcloud/`

**Email**:
- `smtp/`, `ses/`, `mailersend/`

**Chat/Notifications**:
- `discord/`, `slack/`, `mattermost/`, `twilio/`, `twilioWhatsapp/`, `teams/`

## WebSocket Gateway

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/gateways/socket.gateway.ts`

Real-time updates via Socket.io:
- Table data changes
- Multi-user collaboration
- Live notifications
- Redis adapter for distributed systems

## Key Imports from SDK

Controllers, services, and models import types from `nocodb-sdk`:

```typescript
import type {
  NcContext,
  NcRequest,
  UserType,
  BaseType,
  TableType,
  ColumnType
} from 'nocodb-sdk';

import {
  AppEvents,
  OrgUserRoles,
  ProjectRoles,
  WorkspaceUserRoles
} from 'nocodb-sdk';
```

## See Also

- [Common Patterns](./common-patterns.md) - Code pattern examples
- [Key File Locations](./key-file-locations.md) - Important file paths
- [Meta Tables Reference](./meta-tables-reference.md) - Database schema
- [SDK & Types](./sdk-and-types.md) - Type system details
