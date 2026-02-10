# SDK & Type System

## SDK Overview

**Location**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/`

The `nocodb-sdk` package is the **foundation** of the monorepo. It provides:
- TypeScript types shared across backend and frontend
- API client (auto-generated from Swagger)
- Shared utilities (formula, filter, column helpers)
- Enums (AppEvents, Roles, UITypes)

**Version**: 0.111.4 (as of last exploration)

## Directory Structure

```
nocodb-sdk/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── lib/
│   │   ├── Api.ts                  # 440KB auto-generated API types
│   │   ├── enums.ts                # AppEvents, Roles enums
│   │   ├── UITypes.ts              # Column type definitions
│   │   ├── ncTypes.ts              # NcContext, NcRequest, NcRecord
│   │   ├── columnHelper/           # Column value handling
│   │   ├── formula/                # Formula evaluation engine
│   │   ├── filter/                 # Filter parsing
│   │   ├── error/                  # Error handling hierarchy
│   │   ├── workflow/               # Workflow orchestration
│   │   ├── dashboard/              # Dashboard types
│   │   ├── roleHelper.ts           # CE role extraction
│   │   ├── sqlUi/                  # Database dialect UI
│   │   └── [60+ helper files]
│   └── ee/
│       └── lib/
│           ├── form-ee.ts          # EE form features
│           ├── roleHelper-ee.ts    # EE role extraction (extends CE)
│           ├── teams/              # Teams management (v3)
│           ├── workflow/           # EE workflow features
│           └── realtime/           # Realtime updates
├── build/
│   ├── main/                       # CommonJS output
│   └── module/                     # ESM output
├── package.json
└── tsconfig.json
```

## Type Flow Architecture

```
┌─────────────────┐
│  nocodb-sdk     │  Types defined here (source of truth)
│  /src/lib/      │
└────────┬────────┘
         │
         ├──────────────────┬──────────────────┐
         ↓                  ↓                  ↓
   ┌──────────┐      ┌─────────────┐   ┌─────────────┐
   │ nocodb   │      │  nc-gui     │   │ Other pkgs  │
   │ (backend)│      │ (frontend)  │   │             │
   └──────────┘      └─────────────┘   └─────────────┘
   Import from       Import from        Import from
   'nocodb-sdk'      'nocodb-sdk'       'nocodb-sdk'
```

## Core Types

### NcContext (Request Context)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/ncTypes.ts`

```typescript
export interface NcContext {
  org_id?: string;
  workspace_id: string;
  base_id: string;
  api_version?: NcApiVersion;
  user?: UserType & {
    base_roles?: Record<string, boolean>;
    workspace_roles?: Record<string, boolean>;
    provider?: string;
  };
  req?: NcRequest;
  skipJobsRunning?: boolean;
  skipWebhooks?: boolean;
  skipHooks?: boolean;
  skipAudit?: boolean;
  skipCache?: boolean;
  // ... 12+ fields total
}
```

**Usage**: Passed to every backend method for multi-tenant isolation.

### NcRequest (Enhanced Express Request)

```typescript
export interface NcRequest extends Partial<Request> {
  context: NcContext;        // Multi-tenant context
  ncSocketId?: string;       // WebSocket ID
  ncModel?: TableType;       // Current table model
  user: UserType;            // Authenticated user
  clientIp?: string;
  ncWorkspaceId?: string;
  ncBaseId?: string;
  ncSourceId?: string;
  // ... 7+ fields total
}
```

**Usage**: Extends Express Request with NocoDB-specific fields.

### UserType

```typescript
export interface UserType {
  id: string;
  email: string;
  firstname?: string;
  lastname?: string;
  roles?: string;
  token_version?: string;
  invite_token?: string;
  provider?: string;
  // ... more fields
}
```

## Enums

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/enums.ts`

### Role Enums

```typescript
export enum OrgUserRoles {
  SUPER_ADMIN = 'super',
  CREATOR = 'org-level-creator',
  VIEWER = 'org-level-viewer',
}

export enum WorkspaceUserRoles {
  OWNER = 'owner',
  CREATOR = 'creator',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
  NO_ACCESS = 'no-access',
  INHERIT = 'inherit',
}

export enum ProjectRoles {
  OWNER = 'owner',
  CREATOR = 'creator',
  EDITOR = 'editor',
  COMMENTER = 'commenter',
  VIEWER = 'viewer',
  NO_ACCESS = 'no-access',
  INHERIT = 'inherit',
}

export enum TeamUserRoles {
  MEMBER = 'member',
  OWNER = 'owner',
}
```

### App Events

```typescript
export enum AppEvents {
  // Base events
  BASE_CREATE = 'base.create',
  BASE_UPDATE = 'base.update',
  BASE_DELETE = 'base.delete',

  // Table events
  TABLE_CREATE = 'table.create',
  TABLE_UPDATE = 'table.update',
  TABLE_DELETE = 'table.delete',

  // Column events
  COLUMN_CREATE = 'column.create',
  COLUMN_UPDATE = 'column.update',
  COLUMN_DELETE = 'column.delete',

  // View events
  VIEW_CREATE = 'view.create',
  VIEW_UPDATE = 'view.update',
  VIEW_DELETE = 'view.delete',

  // User events
  USER_SIGNUP = 'user.signup',
  USER_SIGNIN = 'user.signin',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',

  // Webhook events
  WEBHOOK_TRIGGER = 'webhook.trigger',
  WEBHOOK_CREATE = 'webhook.create',
  WEBHOOK_UPDATE = 'webhook.update',
  WEBHOOK_DELETE = 'webhook.delete',

  // ... 40+ total event types
}
```

## API Types (Auto-Generated)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/Api.ts` (440KB)

Generated from backend Swagger spec using `swagger-typescript-api`.

### Generation Pipeline

```
Backend OpenAPI Specs
  ├─ packages/nocodb/src/schema/swagger.json (CE)
  └─ packages/nocodb/src/schema/swagger-v3.json (V3 API)
         ↓
  Merge Script (mergeAndGenerateSwaggerCE.js)
         ↓
  nc_swagger.json (merged spec)
         ↓
  swagger-typescript-api@10.0.3 CLI
         ↓
  Api.ts (440KB file with 100+ types and methods)
```

**Merge Script**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/build-script/mergeAndGenerateSwaggerCE.js`

### Api Class Structure

```typescript
export class Api<SecurityDataType = any> {
  public base: BaseApi<SecurityDataType>;
  public dbTable: DbTableApi<SecurityDataType>;
  public dbTableColumn: DbTableColumnApi<SecurityDataType>;
  public dbView: DbViewApi<SecurityDataType>;
  public dbViewColumn: DbViewColumnApi<SecurityDataType>;
  public webhook: WebhookApi<SecurityDataType>;
  // ... 30+ API groups

  constructor(config?: ApiConfig<SecurityDataType>) {
    // Axios-based HTTP client
  }
}
```

**Usage**:
```typescript
const api = new Api({ baseURL: 'http://localhost:8080' });
const bases = await api.base.list();
const tables = await api.dbTable.list(baseId);
```

### Example Generated Types

```typescript
// Request type
export interface BaseReqType {
  title: string;
  description?: string;
  color?: string;
  meta?: Record<string, any>;
}

// Response type
export interface BaseType extends BaseReqType {
  id: string;
  fk_workspace_id: string;
  created_at: string;
  updated_at: string;
}

// V3 types (suffixed with V3)
export interface ApiTokenV3V3Type {
  id: string;
  title: string;
  token?: string;
  // ...
}
```

## Build System

### Build Order (Critical!)

```
1. nocodb-sdk    (build first - foundation)
   ↓
2. nocodb        (backend depends on SDK)
   ↓
3. nc-gui        (frontend depends on SDK)
```

**Why it matters**: Backend and frontend import types from SDK. SDK must be built before they can compile.

### SDK Build Scripts

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/package.json`

| Script | Purpose |
|--------|---------|
| `pnpm run build` | CE: generate types + compile (main + module) |
| `pnpm run build:ee` | EE: generate types + compile (main + module) |
| `pnpm run generate:sdk` | CE: merge swagger + generate Api.ts |
| `pnpm run generate:sdk:ee` | EE: merge swagger + generate Api.ts |
| `pnpm run build:ce:main` | Compile to CommonJS (build/main) |
| `pnpm run build:ce:module` | Compile to ESM (build/module) |
| `pnpm run build:ee:main` | Compile EE to CommonJS |
| `pnpm run build:ee:module` | Compile EE to ESM |

### Build Output

**Package.json exports**:
```json
{
  "main": "build/main/index.js",           // CommonJS entry
  "typings": "build/main/index.d.ts",      // Type definitions
  "module": "build/module/index.js",       // ESM entry
  "files": [
    "build/main",
    "build/module"
  ]
}
```

## CE/EE Type Split

### CE Build (TypeScript Config)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/tsconfig.json`

```json
{
  "compilerOptions": {
    "outDir": "build/main",
    "rootDir": "src",
    "baseUrl": "./src",
    "paths": {
      "~/*": ["./*"],
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules/**", "src/ee/**"]  // Excludes EE
}
```

### EE Build (Overrides)

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../build/main",
    "baseUrl": "../../src/",
    "paths": {
      "~/*": ["./ee/*", "./*"],  // EE first, CE fallback
      "@/*": ["./ee/*", "./*"]
    }
  }
}
```

**Path Resolution**: EE files override CE files with same relative path.

### EE Re-export Pattern

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/lib/index.ts`

```typescript
// Re-export all CE exports
export * from 'src/lib/index';

// Add EE-specific exports
export * from '~/lib/form-ee';
export * from '~/lib/teams/index';

// Override specific exports with EE versions
export {
  extractProjectRolePower,
  hasMinimumRoleAccess,
} from '~/lib/roleHelper-ee';
```

## Import Patterns

### Backend Imports

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/interface/config.ts`

```typescript
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
```

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/services/bases.service.ts`

```typescript
import type { BaseType } from 'nocodb-sdk';
import { AppEvents, OrgUserRoles } from 'nocodb-sdk';
```

### Frontend Imports

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useViewData.ts`

```typescript
import type {
  Api,
  BaseType,
  ColumnType,
  FormColumnType,
  FormType,
  TableType,
  ViewType
} from 'nocodb-sdk';
```

**File**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/middleware/03.auth.global.ts`

```typescript
import type { Api } from 'nocodb-sdk';
import { NcErrorType } from 'nocodb-sdk';
```

## Workspace Dependencies

### Package References

**Backend** (`packages/nocodb/package.json`):
```json
{
  "dependencies": {
    "nocodb-sdk": "workspace:^",  // Workspace symlink
    // 200+ other deps
  }
}
```

**Frontend** (`packages/nc-gui/package.json`):
- Installed via pnpm workspace
- Uses types via `useApi()` composable

### Local SDK Installation

**Script**: `/Users/fendyheryanto/Documents/project_node/nocohub/scripts/installLocalSdk.js`

Rebuilds SDK and reinstalls in backend/frontend:
```bash
1. cd packages/nocodb-sdk && pnpm i && npm run build
2. cd packages/nc-gui && pnpm i ${sdkPath}
3. cd packages/nocodb && pnpm i ${sdkPath}
```

**Root command**: `pnpm run install:local-sdk`

## Monorepo Structure

**Workspace Config**: `/Users/fendyheryanto/Documents/project_node/nocohub/pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/nocodb-sdk'
  - 'packages/nocodb'
  - 'packages/nc-gui'
  - 'packages/nc-knex-dialects/*'
  - 'packages/nc-sql-executor'
  - 'packages/nc-secret-mgr'
  - 'tests/playwright'
  - 'packages/nc-integration-scaffolder'
```

## Type Safety Workflows

### Workflow 1: Adding New API Endpoint

```
1. Backend: Create endpoint in controller
   └─ Generate Swagger spec

2. SDK: Regenerate API types
   └─ pnpm run generate:sdk (merges swagger → Api.ts)
   └─ pnpm run build (compile & export)

3. Backend: Import types
   └─ TypeScript validates request/response types

4. Frontend: Rebuild SDK
   └─ Import types in composables
   └─ Call via useApi() with typed methods
```

### Workflow 2: Modifying Core Types

```
1. SDK: Edit NcContext in ncTypes.ts
   └─ pnpm run build

2. Backend: TypeScript flags mismatches
   └─ Update code to match new type

3. Frontend: TypeScript flags mismatches
   └─ Update code to match new type
```

### Workflow 3: CE/EE Type Divergence

```
1. Create EE extension:
   └─ nocodb-sdk/src/ee/lib/my-feature.ts
   └─ Re-export in src/ee/lib/index.ts

2. Build EE:
   └─ pnpm run build:ee
   └─ Path resolution loads EE version first

3. Backend/Frontend EE build:
   └─ Imports from 'nocodb-sdk'
   └─ Automatically gets EE types
```

## Common Root Commands

From monorepo root (`/Users/fendyheryanto/Documents/project_node/nocohub/`):

```bash
# Bootstrap
pnpm run bootstrap        # Full EE setup
pnpm run bootstrap:ce     # CE only

# Development
pnpm run start:backend    # Backend on :8080
pnpm run start:frontend   # Frontend on :3000

# SDK rebuild
cd packages/nocodb-sdk && pnpm run build:ee

# Quick SDK rebuild & reinstall
pnpm run install:local-sdk
```

## Key SDK Files Reference

| Purpose | File Path |
|---------|-----------|
| **Main Entry** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/index.ts` |
| **Type Exports** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/index.ts` |
| **API Types** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/Api.ts` (440KB) |
| **Core Types** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/ncTypes.ts` |
| **Enums** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/enums.ts` |
| **EE Re-exports** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/lib/index.ts` |
| **Swagger Merge** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/build-script/mergeAndGenerateSwaggerCE.js` |
| **CE tsconfig** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/tsconfig.json` |
| **EE tsconfig** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/tsconfig.json` |

## See Also

- [Backend Architecture](./backend-architecture.md) - Backend usage of SDK types
- [Frontend Architecture](./frontend-architecture.md) - Frontend usage of SDK types
- [Common Patterns](./common-patterns.md) - Type usage patterns
