# NocoDB Package Map

## Package Dependency Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      ROOT (nocodb-root)                      │
│                    pnpm workspaces + lerna                   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  nocodb-sdk   │    │ nocodb-sdk-v2 │    │nc-secret-mgr  │
│   (types)     │    │  (next-gen)   │    │  (secrets)    │
└───────┬───────┘    └───────────────┘    └───────┬───────┘
        │                                         │
        ▼                                         ▼
┌───────────────────────────────────────────────────────────┐
│                        nocodb                              │
│                   (backend - NestJS)                       │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    imports from                      │  │
│  │  • nocodb-sdk (types)                               │  │
│  │  • nc-secret-mgr (encryption)                       │  │
│  │  • noco-integrations (external services)            │  │
│  │  • nc-sql-executor (query execution)                │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│                        nc-gui                              │
│                  (frontend - Nuxt 3)                       │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    imports from                      │  │
│  │  • nocodb-sdk (types + API client)                  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

## Package Details

### Core Packages

| Package | Path | Purpose | Key Exports |
|---------|------|---------|-------------|
| **nocodb-sdk** | `packages/nocodb-sdk` | TypeScript types, API client | `Api`, `UITypes`, `AppEvents`, interfaces |
| **nocodb** | `packages/nocodb` | Backend API server | REST endpoints, business logic |
| **nc-gui** | `packages/nc-gui` | Frontend application | Vue components, pages |

### Support Packages

| Package | Path | Purpose | Used By |
|---------|------|---------|---------|
| **nocodb-sdk-v2** | `packages/nocodb-sdk-v2` | Next-gen SDK (experimental) | Experimental features |
| **nc-secret-mgr** | `packages/nc-secret-mgr` | Secret encryption/decryption | `nocodb` |
| **nc-sql-executor** | `packages/nc-sql-executor` | Raw SQL execution service | `nocodb` |
| **noco-integrations** | `packages/noco-integrations` | External service integrations | `nocodb` |
| **nc-migrator** | `packages/nc-migrator` | Database migration utilities | `nocodb` |
| **nc-knex-dialects** | `packages/nc-knex-dialects` | Knex dialect extensions | `nocodb` |

### Utility Packages

| Package | Path | Purpose |
|---------|------|---------|
| **nc-connectors** | `packages/nc-connectors` | Database connectors |
| **nc-mail-assets** | `packages/nc-mail-assets` | Email templates |
| **nc-integration-scaffolder** | `packages/nc-integration-scaffolder` | Integration generator |

## Build Order

When rebuilding from scratch:

```bash
# 1. SDK (no dependencies)
cd packages/nocodb-sdk && pnpm install && pnpm run build:ee

# 2. Support packages (depend on SDK)
cd packages/nc-secret-mgr && pnpm install && pnpm run build
cd packages/noco-integrations && pnpm install && pnpm run build

# 3. Backend (depends on SDK + support packages)
cd packages/nocodb && pnpm install && pnpm run build

# 4. Frontend (depends on SDK)
cd packages/nc-gui && pnpm install && pnpm run build
```

Or use root bootstrap:
```bash
pnpm run bootstrap      # Full EE bootstrap
pnpm run bootstrap:ce   # CE only
```

## Package Communication

### SDK → Backend

Types flow from SDK to backend:
```typescript
// Backend imports SDK types
import type { TableType, ViewType } from 'nocodb-sdk';
import { UITypes, AppEvents } from 'nocodb-sdk';
```

### SDK → Frontend

Frontend uses SDK types + API client:
```typescript
// Frontend imports types
import type { TableType, ViewType } from 'nocodb-sdk';

// Frontend uses API client
import { Api } from 'nocodb-sdk';
const api = new Api({ baseURL: '/api/v2' });
```

### Backend → Frontend

Communication via REST API:
- Frontend calls backend endpoints
- Backend returns typed responses (matching SDK types)
- WebSocket for real-time updates

## Version Alignment

All packages should use compatible versions:
- Check `package.json` in each package
- SDK version must match what backend/frontend expect
- Use `pnpm run install:local-sdk` to sync local SDK changes

## CE/EE Package Variants

### SDK
- CE: `pnpm run build` (excludes EE types)
- EE: `pnpm run build:ee` (includes all types)

### Backend
- CE: `pnpm run build`
- EE: `pnpm run build:on-prem` or `pnpm run build:cloud`

### Frontend
- CE: `pnpm run build`
- EE: `pnpm run build:ee`

## Development Ports

| Service | Default Port | Command |
|---------|-------------|---------|
| Backend | 8080 | `pnpm run start:backend` |
| Frontend | 3000 | `pnpm run start:frontend` |
| SQL Executor | 8081 | `pnpm run start:sql-executor` |
