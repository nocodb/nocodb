# Task 1: Implement Hooks Controller for v3 API

## Discovery Summary

### Current State

**Existing Files:**
- [hooks-v3.controller.ts](src/controllers/v3/hooks-v3.controller.ts) - Only `hookList` endpoint implemented
- [hooks-v3.service.ts](src/services/v3/hooks-v3.service.ts) - Only `hookList` method implemented
- Neither is registered in [noco.module.ts](src/modules/noco.module.ts)

**Reference Files:**
- [hooks.controller.ts](src/controllers/hooks.controller.ts) - v1/v2 implementation
- [hooks.service.ts](src/services/hooks.service.ts) - v1/v2 service with all methods

### v3 API Conventions (from existing v3 controllers)

| Convention | Example |
|------------|---------|
| Path Prefix | `PREFIX_APIV3_METABASE` = `/api/v3/meta/bases/:baseId` |
| Response Format | `{ list: [...] }` instead of `PagedResponseImpl` |
| Context | `@TenantContext() context: NcContext` |
| Type Naming | `*V3Type` suffix (e.g., `FilterCreateV3Type`) |
| Controller Naming | `{Feature}V3Controller` |
| Service Naming | `{Feature}V3Service` |
| Data Transform | Uses `builderGenerator` from `api-v3-data-transformation.builder.ts` |

### Endpoints to Implement

| # | v1/v2 Path | v3 Path (proposed) | Method | ACL | Status |
|---|------------|-------------------|--------|-----|--------|
| 1 | `/tables/:tableId/hooks` | `/tables/:tableId/hooks` | GET | `hookList` | DONE |
| 2 | `/tables/:tableId/hooks` | `/tables/:tableId/hooks` | POST | `hookCreate` | TODO |
| 3 | `/hooks/:hookId` | `/hooks/:hookId` | DELETE | `hookDelete` | TODO |
| 4 | `/hooks/:hookId` | `/hooks/:hookId` | PATCH | `hookUpdate` | TODO |

### V3 Hook Types (from nocodb-sdk - VERIFIED)

Location: [Api.ts:2115-2204](packages/nocodb-sdk/src/lib/Api.ts#L2115-L2204)

```typescript
// Response type for single hook
export interface HookV3V3Type {
  id: string;
  table_id: string;
  title: string;
  description?: string | null;
  event: 'after' | 'before' | 'manual';
  operation: ('insert' | 'update' | 'delete')[];
  notification?: object;
  active?: boolean;
  async?: boolean;
  version?: 'v1' | 'v2' | 'v3';
  trigger_fields?: string[];
  created_at?: string;
  updated_at?: string;
}

// Response type for list
export interface HookV3ListV3Type {
  list: HookV3V3Type[];
}

// Request type for create
export interface HookV3CreateV3Type {
  title: string;                              // required
  description?: string;
  event: 'after' | 'before' | 'manual';       // required
  operation: ('insert' | 'update' | 'delete')[]; // required
  notification: object;                        // required
  active?: boolean;
  async?: boolean;
  version?: 'v1' | 'v2' | 'v3';
  trigger_fields?: string[];
}

// Request type for update
export interface HookV3UpdateV3Type {
  title?: string;
  description?: string;
  event?: 'after' | 'before' | 'manual';
  operation?: ('insert' | 'update' | 'delete')[];
  notification?: object;
  active?: boolean;
  async?: boolean;
  version?: 'v1' | 'v2' | 'v3';
  trigger_fields?: string[];
}
```

**Key differences from v1/v2 types:**
| Property | v1/v2 | v3 |
|----------|-------|-----|
| Table reference | `fk_model_id` | `table_id` |
| Event types | `'view' \| 'field' \| 'after' \| 'before' \| 'manual'` | `'after' \| 'before' \| 'manual'` |
| Operation types | `'insert' \| 'update' \| 'delete' \| 'trigger'` | `'insert' \| 'update' \| 'delete'` |
| Boolean type | `BoolType` | `boolean` |
| Version | `string` | `'v1' \| 'v2' \| 'v3'` |
| Timestamps | Not included | `created_at`, `updated_at` |

### V3 Builder Configuration

**Current** ([hooks-v3.service.ts](src/services/v3/hooks-v3.service.ts)):
```typescript
protected builder = builderGenerator<Hook>({
  allowed: ['id', 'fk_model_id', 'title', 'event', 'operation', 'notification', 'payload'],
  mappings: { fk_model_id: 'table_id' },
  meta: { snakeCase: true, metaProps: ['notification'] },
});
```

**Required for V3 types** (to match `HookV3V3Type`):
```typescript
protected builder = builderGenerator<Hook>({
  allowed: [
    'id',
    'fk_model_id',
    'title',
    'description',
    'event',
    'operation',
    'notification',
    'active',
    'async',
    'version',
    'trigger_fields',
    'created_at',
    'updated_at',
  ],
  mappings: { fk_model_id: 'table_id' },
  meta: { snakeCase: true, metaProps: ['notification'] },
});
```

---

## Decisions Confirmed

| Question | Decision |
|----------|----------|
| **Path Style** | Base-scoped: `/api/v3/meta/bases/:baseId/...` |
| **SDK Types** | Auto-generated from swagger-v3, no manual types needed |
| **Service Architecture** | Extend hooks-v3.service with new methods, delegate to CE service |

---

## Final Implementation Plan

### V3 API Endpoints (Full Paths)

| # | Method | v3 Path | ACL | Status |
|---|--------|---------|-----|--------|
| 1 | GET | `/api/v3/meta/bases/:baseId/tables/:tableId/hooks` | `hookList` | ✅ DONE |
| 2 | POST | `/api/v3/meta/bases/:baseId/tables/:tableId/hooks` | `hookCreate` | ✅ DONE |
| 3 | GET | `/api/v3/meta/bases/:baseId/hooks/:hookId` | `hookRead` | ✅ DONE |
| 4 | PATCH | `/api/v3/meta/bases/:baseId/hooks/:hookId` | `hookUpdate` | ✅ DONE |
| 5 | DELETE | `/api/v3/meta/bases/:baseId/hooks/:hookId` | `hookDelete` | ✅ DONE |

> **Note:** `hookTest`, `hookLogList`, `tableSampleData`, and `hookTrigger` endpoints are excluded from this implementation scope.

### Implementation Steps

#### Phase 1: Setup & Registration
1. Register `HooksV3Controller` in noco.module.ts
2. Register `HooksV3Service` in noco.module.ts
3. Inject `HooksService` (CE) into `HooksV3Service` for delegation

#### Phase 2: Controller Endpoints
4. Add `hookCreate` endpoint (POST)
5. Add `hookGet` endpoint (GET single hook)
6. Add `hookUpdate` endpoint (PATCH)
7. Add `hookDelete` endpoint (DELETE)

#### Phase 3: Service Layer
12. Add v3 transformation builders for request/response
13. Implement service methods delegating to CE service
14. Transform responses using `builderGenerator`

#### Phase 4: Swagger & Types ✅ DONE
15. ~~Add hook endpoints to swagger-v3.json~~ - Already defined
16. ~~Verify auto-generated types are correct~~ - Verified

### Files to Modify

| File | Changes | Status |
|------|---------|--------|
| `src/modules/noco.module.ts` | Register controller + service | ✅ DONE |
| `src/controllers/v3/hooks-v3.controller.ts` | Add 4 new endpoints | ✅ DONE |
| `src/services/v3/hooks-v3.service.ts` | Add service methods + inject HooksService | ✅ DONE |
| `src/controllers/internal/operationScopes.ts` | Add `hookRead` ACL | ✅ DONE |
| `src/schema/swagger-v3.json` | Add hook API definitions | ✅ DONE |

---

## Verification Checkpoints

### ✅ SDK Types Verified (2026-02-10)
- V3 types confirmed in [Api.ts:2115-2204](packages/nocodb-sdk/src/lib/Api.ts#L2115-L2204)
- Types: `HookV3V3Type`, `HookV3ListV3Type`, `HookV3CreateV3Type`, `HookV3UpdateV3Type`
- Builder configuration needs update to include all V3 fields

### ✅ Swagger Definitions Verified (2026-02-10)
- Endpoints defined in [swagger-v3.json](src/schema/swagger-v3.json):
  - `GET /api/v3/meta/bases/{baseId}/tables/{tableId}/hooks` (line 2439)
  - `POST /api/v3/meta/bases/{baseId}/tables/{tableId}/hooks` (line 2439)
  - `GET /api/v3/meta/bases/{baseId}/hooks/{hookId}` (line 2614)
  - `PATCH /api/v3/meta/bases/{baseId}/hooks/{hookId}` (line 2614)
  - `DELETE /api/v3/meta/bases/{baseId}/hooks/{hookId}` (line 2614)
- Schemas: `HookV3`, `HookV3List`, `HookV3Create`, `HookV3Update` (lines 7449-7600)

---

---

## Implementation Summary (2026-02-10)

### Completed Changes

1. **noco.module.ts** - Registered `HooksV3Controller` and `HooksV3Service`
   - Added imports for controller and service
   - Added controller to controllers array
   - Added service to providers array

2. **hooks-v3.controller.ts** - Implemented 5 endpoints (renamed class from `HooksController` to `HooksV3Controller`)
   - `GET /api/v3/meta/bases/:baseId/tables/:tableId/hooks` - hookList (existing)
   - `POST /api/v3/meta/bases/:baseId/tables/:tableId/hooks` - hookCreate
   - `GET /api/v3/meta/bases/:baseId/hooks/:hookId` - hookRead
   - `PATCH /api/v3/meta/bases/:baseId/hooks/:hookId` - hookUpdate
   - `DELETE /api/v3/meta/bases/:baseId/hooks/:hookId` - hookDelete

3. **hooks-v3.service.ts** - Implemented service methods (renamed class from `HooksService` to `HooksV3Service`)
   - Updated builder with all V3 fields (id, table_id, title, description, event, operation, notification, active, async, version, trigger_fields, created_at, updated_at)
   - Added requestBuilder for V3 → internal format transformation
   - Injected CE `HooksService` for delegation
   - Implemented: hookList, hookGet, hookCreate, hookUpdate, hookDelete

4. **operationScopes.ts** - Added `hookRead` ACL for the new GET single hook endpoint

### V3 Response Format
- Uses `{ list: [...] }` format for hookList
- Returns transformed hook object directly for single-item operations
- Field mapping: `fk_model_id` → `table_id`

**Implementation complete.**
