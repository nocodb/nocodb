---
name: compound-engineering
description: |
  NocoDB compound engineering for multi-package changes and end-to-end feature development.
  MANDATORY TRIGGERS: compound, end-to-end, e2e feature, multi-package, cross-package, full-stack, SDK + backend, backend + frontend, complete feature, integrated feature
  Use when: (1) Implementing features that span SDK → Backend → Frontend, (2) Coordinating changes across multiple packages, (3) Adding new types/interfaces that need SDK-backend-frontend alignment, (4) Building complete features with API + UI, (5) Understanding package dependencies and build order
---

# NocoDB Compound Engineering

> **📝 Skill Maintenance Note**
>
> While working on PRs, if you discover that any information in this skill is outdated, incorrect, or missing, **please update this skill as part of your PR**. Keeping these skills accurate helps the entire team work more efficiently with Claude.

## Overview

Compound engineering coordinates changes across NocoDB's monorepo packages. Use this skill when implementing features that touch multiple layers: SDK types, backend API, and frontend UI.

## Package Dependency Graph

```
nocodb-sdk (types + API client)
    ↓
nocodb (backend API)
    ↓
nc-gui (frontend)
```

**Build order matters!** Always build packages in dependency order.

## Package Overview

| Package | Purpose | Key Files |
|---------|---------|-----------|
| `nocodb-sdk` | TypeScript types, API client | `src/lib/Api.ts`, `src/lib/enums.ts` |
| `nocodb-sdk-v2` | Next-gen SDK (experimental) | Similar structure |
| `nocodb` | NestJS backend API | `src/controllers/`, `src/services/`, `src/models/` |
| `nc-gui` | Vue 3/Nuxt 3 frontend | `components/`, `composables/`, `store/` |
| `noco-integrations` | External integrations | Integration-specific modules |
| `nc-secret-mgr` | Secret management | Encryption utilities |
| `nc-sql-executor` | SQL execution service | Query execution |

## Development Workflow

### Workflow 1: End-to-End Feature Implementation

For a feature like "Add bookmark functionality":

**Phase 1: SDK Types (nocodb-sdk)**

```bash
cd packages/nocodb-sdk
```

1. Add types to `src/lib/Api.ts`:
   ```typescript
   export interface BookmarkType {
     id: string;
     fk_user_id: string;
     fk_model_id: string;
     type: 'table' | 'view';
     created_at?: string;
     updated_at?: string;
   }

   export interface BookmarkReqType {
     fk_model_id: string;
     type: 'table' | 'view';
   }
   ```

2. Add API client methods:
   ```typescript
   bookmark: {
     list: () => this._get<BookmarkType[]>('/api/v2/meta/bookmarks'),
     create: (data: BookmarkReqType) => this._post<BookmarkType>('/api/v2/meta/bookmarks', data),
     delete: (id: string) => this._delete(`/api/v2/meta/bookmarks/${id}`),
   }
   ```

3. Add events to `src/lib/enums.ts`:
   ```typescript
   export enum AppEvents {
     // ... existing events
     BOOKMARK_CREATE = 'bookmark.create',
     BOOKMARK_DELETE = 'bookmark.delete',
   }
   ```

4. Build SDK:
   ```bash
   pnpm run build      # CE
   pnpm run build:ee   # EE (if EE types added)
   ```

**Phase 2: Backend API (nocodb)**

```bash
cd packages/nocodb
```

1. Create model `src/models/Bookmark.ts`
2. Create service `src/services/bookmark.service.ts`
3. Create controller `src/controllers/bookmark.controller.ts`
4. Create migration `src/meta/migrations/v2/nc_XXX_bookmark.ts`
5. Register in `src/modules/noco.module.ts`
6. Update swagger schema

See [nocohub-backend skill](../nocohub-backend/SKILL.md) for detailed patterns.

**Phase 3: Frontend UI (nc-gui)**

```bash
cd packages/nc-gui
```

1. Create composable `composables/useBookmarks.ts`:
   ```typescript
   export function useBookmarks() {
     const { api } = useApi()
     const bookmarks = ref<BookmarkType[]>([])

     const loadBookmarks = async () => {
       bookmarks.value = await api.bookmark.list()
     }

     const addBookmark = async (data: BookmarkReqType) => {
       const bookmark = await api.bookmark.create(data)
       bookmarks.value.push(bookmark)
     }

     const removeBookmark = async (id: string) => {
       await api.bookmark.delete(id)
       bookmarks.value = bookmarks.value.filter(b => b.id !== id)
     }

     return { bookmarks, loadBookmarks, addBookmark, removeBookmark }
   }
   ```

2. Create component `components/dashboard/BookmarkButton.vue`
3. Integrate into existing UI

See [nocohub-frontend skill](../nocohub-frontend/SKILL.md) for detailed patterns.

### Workflow 2: Type-Safe API Changes

When modifying existing APIs:

1. **Update SDK types first** - This provides compile-time safety
2. **Update backend** - TypeScript will flag mismatches
3. **Update frontend** - Import types from nocodb-sdk

Example type flow:
```
nocodb-sdk: export interface TableType { ... }
     ↓
nocodb: import type { TableType } from 'nocodb-sdk'
     ↓
nc-gui: import type { TableType } from 'nocodb-sdk'
```

### Workflow 3: Adding Events/Hooks

Events flow through the system for audit logging, webhooks, and real-time updates.

1. **Define event in SDK** (`nocodb-sdk/src/lib/enums.ts`):
   ```typescript
   export enum AppEvents {
     FEATURE_ACTION = 'feature.action',
   }
   ```

2. **Emit in backend service** (`nocodb/src/services/`):
   ```typescript
   this.appHooksService.emit(AppEvents.FEATURE_ACTION, {
     userId: param.userId,
     req: param.req,
     // ... event data
   });
   ```

3. **Handle in frontend** (if real-time updates needed):
   ```typescript
   // In composable or component
   useEventListener(AppEvents.FEATURE_ACTION, (data) => {
     // Handle real-time update
   })
   ```

## Build Commands

### Full Monorepo

```bash
# Bootstrap all packages (installs deps + builds SDK)
pnpm run bootstrap        # EE
pnpm run bootstrap:ce     # CE only

# Start development
pnpm run start:backend    # Backend on :8080
pnpm run start:frontend   # Frontend on :3000
```

### Individual Packages

```bash
# SDK
cd packages/nocodb-sdk
pnpm run build            # CE build
pnpm run build:ee         # EE build (includes EE types)

# Backend
cd packages/nocodb
pnpm run watch:run        # CE dev with hot reload
pnpm run watch:run:ee     # EE dev

# Frontend
cd packages/nc-gui
pnpm run dev              # CE dev
pnpm run dev:ee           # EE dev
```

### Rebuild After SDK Changes

After modifying `nocodb-sdk`, you must rebuild dependent packages:

```bash
# Quick rebuild chain
cd packages/nocodb-sdk && pnpm run build:ee && cd ../nocodb && pnpm run build
```

Or use the root script:
```bash
pnpm run install:local-sdk
```

## CE/EE Considerations

### SDK CE/EE Split

```
nocodb-sdk/src/lib/
├── Api.ts           # CE types
├── EeApi.ts         # EE-only types (excluded from CE build)
└── enums.ts         # Shared enums
```

### Backend CE/EE Split

```
nocodb/src/
├── services/feature.service.ts      # CE implementation
└── ee/services/feature.service.ts   # EE extends CE
```

### Frontend CE/EE Split

```
nc-gui/
├── composables/useFeature.ts        # CE version
└── ee/composables/useFeature.ts     # EE override
```

**Rule**: EE code imports and extends CE code. CE code never imports EE code.

## Common Patterns

### Adding a New Field to Existing Entity

1. **SDK**: Add field to interface in `Api.ts`
2. **Backend**:
   - Add field to model class
   - Create migration to add column
   - Update service methods
3. **Frontend**:
   - Update composables/stores that use the type
   - Update UI components

### Adding a New API Endpoint

1. **SDK**: Add method to API client
2. **Backend**: Create controller route + service method
3. **Frontend**: Call via `useApi()` composable

### Renaming a Field/Endpoint

1. **SDK**: Update interface + add deprecation notice if needed
2. **Backend**: Support both old and new (backward compatibility)
3. **Frontend**: Update all usages
4. **Later**: Remove old field after migration period

## Testing Compound Changes

```bash
# Unit tests
cd packages/nocodb && pnpm test:unit

# Type checking
cd packages/nocodb-sdk && pnpm run typecheck
cd packages/nocodb && pnpm run typecheck
cd packages/nc-gui && pnpm run typecheck

# E2E tests
cd tests/playwright && pnpm test
```

## Debugging Tips

### SDK Types Not Updating

```bash
# Clear node_modules and rebuild
rm -rf packages/nocodb/node_modules/.cache
cd packages/nocodb-sdk && pnpm run build:ee
```

### Import Path Issues

- Backend: Use `~/` for `src/` imports
- Frontend: Use `~/` or relative paths
- SDK types: Import from `'nocodb-sdk'`

### Hot Reload Not Working

Backend and frontend hot reload independently. If types changed:
1. Rebuild SDK
2. Restart backend/frontend dev servers

## Reference Files

- **Backend patterns**: See [nocohub-backend skill](../nocohub-backend/SKILL.md)
- **Frontend patterns**: See [nocohub-frontend skill](../nocohub-frontend/SKILL.md)
- **Cross-package workflows**: See [references/workflows.md](references/workflows.md)
- **Package dependencies**: See [references/package-map.md](references/package-map.md)
