# Key File Locations

Quick reference for frequently accessed files in the NocoDB Hub codebase.

## Root Configuration

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/package.json` | Root package.json with workspace scripts |
| `/Users/fendyheryanto/Documents/project_node/nocohub/pnpm-workspace.yaml` | Workspace configuration |
| `/Users/fendyheryanto/Documents/project_node/nocohub/CLAUDE.md` | Project-wide Claude instructions |

## Skill Files (Documentation)

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/nocohub-backend/SKILL.md` | Backend patterns and conventions |
| `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/nocohub-frontend/SKILL.md` | Frontend patterns and conventions |
| `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/compound-engineering/SKILL.md` | Cross-package workflows |
| `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/nocohub-automations/SKILL.md` | Automation patterns |
| `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/nocohub-sync/SKILL.md` | CE/EE sync patterns |

## SDK (nocodb-sdk)

### Core SDK Files

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/index.ts` | Main SDK entry point |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/index.ts` | Type exports |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/Api.ts` | Auto-generated API types (440KB) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/ncTypes.ts` | Core types (NcContext, NcRequest) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/enums.ts` | Enums (AppEvents, Roles) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/UITypes.ts` | Column type definitions |

### EE SDK Files

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/lib/index.ts` | EE re-exports |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/lib/roleHelper-ee.ts` | EE role helpers |

### Build Configuration

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/package.json` | SDK package config |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/tsconfig.json` | CE TypeScript config |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/ee/tsconfig.json` | EE TypeScript config |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/build-script/mergeAndGenerateSwaggerCE.js` | Swagger merge script |

## Backend (nocodb)

### Entry Points

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/main.ts` | Express + NestJS bootstrap |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/Noco.ts` | Core application singleton |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/app.module.ts` | NestJS root module |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/noco.module.ts` | All CE controllers & services |

### Example Controller/Service/Model

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/controllers/bases.controller.ts` | Bases controller |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/services/bases.service.ts` | Bases service |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/models/Base.ts` | Base model |

### Database & Meta

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/db/BaseModelSqlv2.ts` | Main SQL query builder (209KB) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/utils/globals.ts` | MetaTable enum, CacheScope enum |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/meta/migrations/` | Database migrations |

### Guards & Middleware

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/guards/global/global.guard.ts` | Authentication guard |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/guards/meta-api-limiter.guard.ts` | Rate limiting |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/middlewares/extract-ids/extract-ids.middleware.ts` | ACL enforcement |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/middlewares/global/global.middleware.ts` | Global middleware |

### Auth Strategies

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/strategies/jwt.strategy.ts` | JWT strategy |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/ee/strategies/saml.strategy.ts` | SAML SSO (EE) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/ee/strategies/google.strategy.ts` | Google OAuth (EE) |

### Utilities

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/utils/acl.ts` | ACL permissions (19KB) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/helpers/catchError.ts` | Error handling (NcError) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/helpers/validatePayload.ts` | Payload validation |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/helpers/extractProps.ts` | Property extraction |

### Caching & Events

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/cache/NocoCache.ts` | Caching layer |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/services/app-hooks/app-hooks.service.ts` | Event emitter |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/services/app-hooks-listener.service.ts` | Event listener |

### Jobs & Background Processing

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/jobs/jobs.module.ts` | Jobs module |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/jobs/jobs.service.ts` | Job queue service |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/jobs/jobs.processor.ts` | Job processor |

### WebSocket

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/gateways/socket.gateway.ts` | Socket.io gateway |

### Decorators

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/decorators/tenant-context.decorator.ts` | @TenantContext decorator |

## Frontend (nc-gui)

### Configuration

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/nuxt.config.ts` | Nuxt 3 configuration |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/package.json` | Frontend package config |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/tsconfig.json` | TypeScript config |

### Core Composables

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useApi/index.ts` | API client wrapper |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useGlobal/index.ts` | Global app state |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useInjectionState/` | Injection state helper |

### Key Stores

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/bases.ts` | Bases store |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/base.ts` | Current base store |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/views.ts` | Views store (40KB) |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/tables.ts` | Tables store |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/workspace.ts` | Workspace store |

### Component Examples

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/components/webhook/WebhookV2.vue` | Webhook component |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/components/dlg/InviteDlg.vue` | Invite dialog |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/components/smartsheet/Grid.vue` | Grid view |

### Middleware

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/middleware/01.redirect.global.ts` | Redirect middleware |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/middleware/02.security.global.ts` | Security middleware |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/middleware/03.auth.global.ts` | Auth middleware |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/middleware/04.payment.global.ts` | Payment middleware |

### Plugins

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/plugins/a.dayjs.ts` | Dayjs setup |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/plugins/a.i18n.ts` | i18n setup |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/plugins/a.socket.ts` | WebSocket setup |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/plugins/api.ts` | API instance |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/plugins/state.ts` | Global state init |

### Utilities & Libraries

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/utils/errorUtils.ts` | Error utilities |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/utils/formValidations.ts` | Form validation |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/lib/acl.ts` | ACL helpers |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/lib/constants.ts` | Constants |

### Layouts & Pages

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/layouts/dashboard.vue` | Dashboard layout |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/pages/index.vue` | Home page |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/pages/signin.vue` | Sign in page |

## EE Files

### Backend EE

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/ee/controllers/` | EE controllers |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/ee/services/` | EE services |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/ee/models/` | EE models |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/ee/modules/` | EE modules |

### Frontend EE

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/ee/components/` | EE components |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/ee/store/` | EE store extensions |
| `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/ee/composables/` | EE composables |

## Scripts

| File | Purpose |
|------|---------|
| `/Users/fendyheryanto/Documents/project_node/nocohub/scripts/installLocalSdk.js` | Local SDK rebuild script |

## Common Search Patterns

### Find Controllers

```bash
# CE controllers
ls packages/nocodb/src/controllers/

# EE controllers
ls packages/nocodb/src/ee/controllers/
```

### Find Services

```bash
# CE services
ls packages/nocodb/src/services/

# EE services
ls packages/nocodb/src/ee/services/
```

### Find Components

```bash
# All component categories
ls packages/nc-gui/components/

# Specific category
ls packages/nc-gui/components/webhook/
```

### Find Stores

```bash
ls packages/nc-gui/store/
```

### Find Composables

```bash
ls packages/nc-gui/composables/
```

### Find Types in SDK

```bash
ls packages/nocodb-sdk/src/lib/
```

## Directory Landmarks

When navigating the codebase, these directories serve as landmarks:

| Directory | What's Here |
|-----------|-------------|
| `packages/nocodb-sdk/src/lib/` | All shared types and SDK code |
| `packages/nocodb/src/controllers/` | All REST endpoint handlers |
| `packages/nocodb/src/services/` | All business logic |
| `packages/nocodb/src/models/` | All data access layer models |
| `packages/nc-gui/components/` | All Vue components (31 categories) |
| `packages/nc-gui/composables/` | All composables (104 files) |
| `packages/nc-gui/store/` | All Pinia stores (24 stores) |
| `.skills/` | All skill documentation |

## See Also

- [Backend Architecture](./backend-architecture.md) - Backend directory details
- [Frontend Architecture](./frontend-architecture.md) - Frontend directory details
- [SDK & Types](./sdk-and-types.md) - SDK structure
- [MEMORY.md](./MEMORY.md) - Main navigation starting point
