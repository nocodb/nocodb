---
name: nc-error
description: NcError reference — centralized backend error handling system. Use when throwing errors in services/controllers/models, adding new error types, or handling API errors on the frontend.
---

# NcError — Error Handling Reference

Centralized error system spanning SDK → Backend → Frontend. All backend errors go through `NcError`.

## Architecture

```
nocodb-sdk (types + base classes)
  ├── NcErrorType enum (101 error codes)         — globals.ts
  ├── NcBaseErrorv2 (Error + HTTP code + type)    — error/nc-base.error.ts
  ├── NcErrorBase (abstract, all throw methods)   — error-handler/nc-error-base.ts
  ├── NcErrorCodexManager (type → NcBaseErrorv2)  — error-handler/nc-error-codex-manager.ts
  └── presetErrorCodexMap (type → {msg, code})    — error-handler/preset-error-codex-map.ts

nocodb (backend)
  ├── NcError static facade (routes V1 or V3)     — src/helpers/ncError.ts
  ├── NcErrorV1 (extends NcErrorBase)              — src/helpers/NcErrorV1.ts
  ├── NcErrorV3 (extends V1, overrides some 404→422) — src/helpers/ncErrorV3.ts
  └── GlobalExceptionFilter (catch-all → HTTP)     — src/filters/global-exception/global-exception.filter.ts

nc-gui (frontend)
  ├── extractSdkResponseErrorMsg(e)    — legacy { msg } format
  └── extractSdkResponseErrorMsgv2(e)  — typed { error, message, details }
```

## Backend — Throwing Errors

Import from `~/helpers/catchError`. **Always prefer `NcError.get(context)`** in services/controllers — it adapts the response format for V1 vs V3 APIs:

```ts
// In services/controllers (have context) — PREFERRED
const ncError = NcError.get(context);
ncError.tableNotFound(param.tableId);
ncError.badRequest('Title is required');
ncError.fieldNotFound(columnId);

// In models/helpers (no context) — falls back to V1
NcError.tableNotFound(id);
NcError.badRequest('Invalid input');
NcError.forbidden('Unauthorized access');
```

### Guard Clause Pattern (most common)

```ts
const model = await Model.get(context, tableId);
if (!model) NcError.get(context).tableNotFound(tableId);
```

## Common Methods

| Method | HTTP | When |
|--------|------|------|
| `badRequest(msg)` | 400 | Invalid input, missing params |
| `unauthorized(msg)` | 401 | Auth required |
| `forbidden(msg)` | 403 | Access denied, read-only source |
| `tableNotFound(id)` / `baseNotFound(id)` / `viewNotFound(id)` / `fieldNotFound(id)` | 404 (422 in V3) | Resource lookup failed |
| `recordNotFound(id)` | 404 | Row not found |
| `genericNotFound(resource, id)` | 404 | Fallback for any resource |
| `requiredFieldMissing(field)` | 422 | Missing required field |
| `invalidValueForField({value, column, type})` | 422 | Type/format mismatch |
| `duplicateRecord(id)` | 422 | Unique constraint (logical) |
| `invalidFilter(filter)` | 422 | Invalid filter expression |
| `planLimitExceeded(msg, details)` | 403 | Quota exceeded (EE) |
| `featureNotSupported({feature})` | 403 | Plan gating (EE) |
| `internalServerError(msg)` | 500 | Unexpected failure |

### Other Useful Methods

- `sourceDataReadOnly(name)` / `sourceMetaReadOnly(name)` — 403 for read-only sources
- `duplicateAlias({type, alias, base})` — 422 duplicate table/column/view name
- `invalidSharedViewPassword()` / `invalidSharedDashboardPassword()` — 403
- `integrationNotFound(id)` / `integrationLinkedWithMultiple(bases, sources)` — 404
- `formulaError(msg)` / `formulaCircularRefError(msg)` — 400
- `externalError(msg)` / `externalTimeOut(msg)` — 400 / 408
- `permissionDenied(name, roles, extRoles)` — 403
- `invalidRequestBody(msg)` — 400 (V1: delegates to badRequest; V3: throws ERR_INVALID_REQUEST_BODY)

## V3 Overrides

NcErrorV3 overrides several 404 errors to **422** for stricter REST semantics:

| Error Type | V1 Code | V3 Code |
|------------|---------|---------|
| `ERR_BASE_NOT_FOUND` | 404 | 422 |
| `ERR_TABLE_NOT_FOUND` | 404 | 422 |
| `ERR_VIEW_NOT_FOUND` | 404 | 422 |
| `ERR_FIELD_NOT_FOUND` | 404 | 422 |
| `ERR_USER_NOT_FOUND` | 404 | 422 |
| `ERR_TEAM_NOT_FOUND` | 404 | 422 |
| `ERR_EXTENSION_NOT_FOUND` | 404 | 422 |
| `ERR_DASHBOARD_NOT_FOUND` | 404 | 422 |
| `ERR_WORKFLOW_NOT_FOUND` | 404 | 422 |
| `ERR_SCRIPT_NOT_FOUND` | 404 | 422 |
| `ERR_INVALID_FILTER` | 422 | 422 (different message) |

V3 also overrides `invalidRequestBody()` to throw `ERR_INVALID_REQUEST_BODY` (400) instead of delegating to `badRequest()`, and `ajvValidationError()` to throw `AjvErrorV3` (extends `NcBaseErrorv2`) instead of `AjvError` (extends `NcBaseError`).

## Adding a New Error Type

1. **SDK enum** — Add to `NcErrorType` in `nocodb-sdk/src/lib/globals.ts`
2. **SDK preset map** — Add message template + HTTP code in `nocodb-sdk/src/lib/error-handler/preset-error-codex-map.ts`
3. **SDK method** — Add throw method in `NcErrorBase` (`nocodb-sdk/src/lib/error-handler/nc-error-base.ts`)
4. **Rebuild SDK** — `cd packages/nocodb-sdk && pnpm run build:ee`
5. **(Optional) Backend proxy** — Add static method in `NcError` (`nocodb/src/helpers/ncError.ts`) for backward compat
6. **(Optional) V3 override** — Override HTTP code/message in `NcErrorV3` (`nocodb/src/helpers/ncErrorV3.ts`) if V3 needs different behavior

## Frontend — Handling Errors

```ts
// Legacy format (V1/V2 — most common)
try {
  await $api.something.do()
} catch (e: any) {
  message.error(await extractSdkResponseErrorMsg(e))
}

// Typed format (when you need the error code)
const { error, message: msg, details } = await extractSdkResponseErrorMsgv2(e)
if (error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) { /* show upgrade */ }
```

Both utilities are in `packages/nc-gui/utils/errorUtils.ts`.

## Exception Filter Flow

`GlobalExceptionFilter` (`src/filters/global-exception/global-exception.filter.ts`) catches all exceptions and transforms them to HTTP responses:

1. JSON parse errors → `ERR_INVALID_JSON`
2. DB errors → `extractDBError()` → `{ message, error, code, httpStatus }`
3. `NcBaseErrorv2` → `{ error, message, details }` with `exception.code` as HTTP status
4. Legacy errors (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`) → simple `{ msg }` with corresponding status
5. `UniqueConstraintViolationError` → `{ error: 'FIELD_UNIQUE_CONSTRAINT_VIOLATION', message, fieldName, value }` (409 in V3, 400 in V1)
6. Unknown errors → 500 with generic message (dev mode includes `innerError`)

EE filter extends CE: adds Sentry capture + telemetry for paid workspaces.

## Key Files

| Package | File | Purpose |
|---------|------|---------|
| SDK | `src/lib/globals.ts` | `NcErrorType` enum |
| SDK | `src/lib/error/nc-base.error.ts` | Base error classes (`NcBaseError`, `NcBaseErrorv2`, `BadRequestV2`, `NotFound`, etc.) |
| SDK | `src/lib/error-handler/nc-error-base.ts` | `NcErrorBase` — all typed throw methods |
| SDK | `src/lib/error-handler/preset-error-codex-map.ts` | Default HTTP code + message for each error type |
| SDK | `src/lib/error-handler/nc-error-codex-manager.ts` | Factory: type + params → `NcBaseErrorv2` |
| Backend | `src/helpers/ncError.ts` | `NcError` static facade |
| Backend | `src/helpers/NcErrorV1.ts` | V1 implementation (extends `NcErrorBase`) |
| Backend | `src/helpers/ncErrorV3.ts` | V3 implementation (extends V1) |
| Backend | `src/helpers/catchError.ts` | Re-exports all error types + `extractDBError()` |
| Backend | `src/filters/global-exception/global-exception.filter.ts` | CE exception filter |
| Backend EE | `src/ee/filters/global-exception/global-exception.filter.ts` | EE exception filter (Sentry + telemetry) |
| Frontend | `utils/errorUtils.ts` | `extractSdkResponseErrorMsg()`, `extractSdkResponseErrorMsgv2()` |
