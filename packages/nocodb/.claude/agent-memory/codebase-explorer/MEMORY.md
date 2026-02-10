# NocoDB Hub Codebase Explorer Memory

This memory provides institutional knowledge about the NocoDB Hub (nocohub) repository architecture, patterns, and key locations to accelerate codebase exploration.

## Repository Identity

**IMPORTANT**: This is `nocohub` (NocoDB Enterprise/Hub) — NOT the open-source `nocodb` repository.

## Quick Architecture Overview

NocoDB Hub is a monorepo with three main packages:

```
nocodb-sdk → nocodb (backend) → nc-gui (frontend)
  (types)      (NestJS)          (Vue 3/Nuxt 3)
```

**Build Order Matters**: SDK must be built before backend/frontend.

## Core Packages

| Package | Location | Purpose |
|---------|----------|---------|
| **nocodb-sdk** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/` | TypeScript types, API client, shared utilities |
| **nocodb** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/` | NestJS backend (97 CE controllers, 114 CE services, 70 models) |
| **nc-gui** | `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/` | Vue 3/Nuxt 3 frontend (217 components, 104 composables, 24 stores) |

## CE/EE Separation Pattern

- **EE code** lives in `ee/` subdirectories that mirror CE structure
- **EE extends CE** — never the reverse
- **Path resolution**: EE files override CE files with same relative path
- CE code must work independently without EE code

**Example**:
```
src/services/bases.service.ts           (CE)
src/ee/services/bases.service.ts        (EE extends CE)
```

## Topic Files

Detailed documentation organized by domain:

### Architecture
- [Backend Architecture](./backend-architecture.md) — Controllers, services, models, middleware, guards, caching, jobs
- [Frontend Architecture](./frontend-architecture.md) — Components, composables, stores, state management
- [SDK & Types](./sdk-and-types.md) — Type system, API generation, build order, cross-package integration

### References
- [Meta Tables](./meta-tables-reference.md) — 100+ database meta table enums
- [Common Patterns](./common-patterns.md) — Frequently used code patterns across packages
- [Key File Locations](./key-file-locations.md) — Quick lookup for important files

## Common Entry Points

### Backend
- **Main**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/main.ts`
- **Core App**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/Noco.ts`
- **App Module**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/app.module.ts`
- **Noco Module**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb/src/modules/noco.module.ts` (all controllers/services)

### Frontend
- **Nuxt Config**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/nuxt.config.ts`
- **Main API Composable**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/composables/useApi/index.ts`
- **Stores**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nc-gui/store/`

### SDK
- **Main Entry**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/index.ts`
- **Types**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/ncTypes.ts`
- **Enums**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/enums.ts`
- **API Types**: `/Users/fendyheryanto/Documents/project_node/nocohub/packages/nocodb-sdk/src/lib/Api.ts` (440KB auto-generated)

## Quick Pattern Reference

**Backend API Pattern**:
```typescript
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class MyController {
  @Acl('action', { scope: 'org' })
  @Get(['/api/v1/...', '/api/v2/...'])
  async method(@TenantContext() context: NcContext) { }
}
```

**Frontend Composable Pattern**:
```typescript
const { api } = useApi()
const { t } = useI18n()
const response = await api.dbTable.list(baseId)
```

**Model Data Access Pattern**:
```typescript
const result = await ncMeta.metaInsert2(
  RootScopes.ROOT,
  RootScopes.ROOT,
  MetaTable.BASES,
  data
)
```

## Skill Reference Files

Always check skill files for documented patterns:
- Backend: `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/nocohub-backend/SKILL.md`
- Frontend: `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/nocohub-frontend/SKILL.md`
- Compound: `/Users/fendyheryanto/Documents/project_node/nocohub/.skills/compound-engineering/SKILL.md`

## Navigation Tips

1. **Find controllers**: Search in `packages/nocodb/src/controllers/` (CE) or `packages/nocodb/src/ee/controllers/` (EE)
2. **Find services**: Search in `packages/nocodb/src/services/` (CE) or `packages/nocodb/src/ee/services/` (EE)
3. **Find components**: Search in `packages/nc-gui/components/` (31 categories)
4. **Find stores**: Check `packages/nc-gui/store/` (24 stores)
5. **Find types**: Start from `packages/nocodb-sdk/src/lib/`
6. **Find meta tables**: Check `packages/nocodb/src/utils/globals.ts` (MetaTable enum)

## Common Commands

```bash
# Bootstrap
pnpm run bootstrap        # Full EE setup
pnpm run bootstrap:ce     # CE only

# Development
pnpm run start:backend    # Backend on :8080
pnpm run start:frontend   # Frontend on :3000

# Build SDK (after type changes)
cd packages/nocodb-sdk && pnpm run build:ee
```

## Last Updated

Generated: 2026-02-10
