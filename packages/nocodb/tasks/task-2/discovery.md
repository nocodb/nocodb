# Task 2: Add Hooks API Definitions to swagger-v3.json

## Discovery Summary

### Task Scope
Add v3 hooks API definitions to `src/schema/swagger-v3.json` based on the endpoints identified in task-1.

**Scope for this task:** Core CRUD endpoints only (no test, sample-payload, logs, or trigger endpoints).

---

## Swagger v3 Structure Analysis

**File:** [swagger-v3.json](src/schema/swagger-v3.json)

| Section | Line Range |
|---------|------------|
| `x-tagGroups` | lines 11-32 |
| `paths` | lines 38-5764 |
| `components` | starts at line 5766 |

### Current Tag Groups
```json
{
  "name": "Meta APIs",
  "tags": ["Workspaces", "Bases", "Tables", "Views", "Fields", "View Filters", "View Sorts", "Scripts"]
}
```

**Action Required:** Add `"Hooks"` to Meta APIs tags.

---

## v3 API Conventions Observed

| Convention | Pattern | Example |
|------------|---------|---------|
| Base path | `/api/v3/meta/bases/{baseId}/...` | `/api/v3/meta/bases/{baseId}/tables/{tableId}/views` |
| List response | `{ list: [...] }` | No `pageInfo` in v3 |
| Schema naming | Descriptive names | `ViewList`, `ViewCreate`, `ViewUpdate`, `View` |
| operationId | `{resource}-{action}` | `view-create`, `field-update`, `hooks-list` |
| Tags | Simple names | `"Views"`, `"Fields"` |
| Delete response | 204 No Content | No response body |
| Parameters | Always include baseId | Even for resource-specific endpoints |

---

## Endpoints to Add

### Path: `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks`

| Method | operationId | Description | Request Body | Response |
|--------|-------------|-------------|--------------|----------|
| GET | `hooks-list` | List table hooks | - | `HookV3List` |
| POST | `hook-create` | Create hook | `HookV3Create` | `HookV3` |

### Path: `/api/v3/meta/bases/{baseId}/hooks/{hookId}`

| Method | operationId | Description | Request Body | Response |
|--------|-------------|-------------|--------------|----------|
| GET | `hook-read` | Get single hook | - | `HookV3` |
| PATCH | `hook-update` | Update hook | `HookV3Update` | `HookV3` |
| DELETE | `hook-delete` | Delete hook | - | 204 |

---

## Schemas to Add

### HookV3 (Response - Single Hook)

Based on [hooks-v3.service.ts](src/services/v3/hooks-v3.service.ts) builder + confirmed fields:

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "Unique hook identifier" },
    "table_id": { "type": "string", "description": "ID of the associated table" },
    "title": { "type": "string", "description": "Hook title" },
    "description": { "type": ["string", "null"], "description": "Hook description" },
    "event": {
      "type": "string",
      "enum": ["after", "before", "manual"],
      "description": "Event trigger type"
    },
    "operation": {
      "type": "array",
      "items": { "type": "string", "enum": ["insert", "update", "delete"] },
      "description": "Operations that trigger the hook"
    },
    "notification": { "type": "object", "description": "Notification configuration" },
    "active": { "type": "boolean", "description": "Is the hook active?" },
    "async": { "type": "boolean", "description": "Is the hook async?" },
    "version": { "type": "string", "enum": ["v1", "v2", "v3"], "description": "Hook payload version" },
    "trigger_fields": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Field IDs that trigger the hook (when trigger_field is enabled)"
    },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "table_id", "title", "event", "operation"]
}
```

### HookV3List (Response - List of Hooks)

```json
{
  "type": "object",
  "properties": {
    "list": {
      "type": "array",
      "items": { "$ref": "#/components/schemas/HookV3" }
    }
  },
  "required": ["list"]
}
```

### HookV3Create (Request - Create Hook)

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string", "description": "Hook title" },
    "description": { "type": "string", "description": "Hook description" },
    "event": { "type": "string", "enum": ["after", "before", "manual"] },
    "operation": { "type": "array", "items": { "type": "string", "enum": ["insert", "update", "delete"] } },
    "notification": { "type": "object", "description": "Notification configuration" },
    "active": { "type": "boolean", "default": true },
    "async": { "type": "boolean", "default": false },
    "version": { "type": "string", "enum": ["v1", "v2", "v3"], "default": "v3" },
    "trigger_fields": { "type": "array", "items": { "type": "string" }, "description": "Field IDs that trigger the hook" }
  },
  "required": ["title", "event", "operation", "notification"]
}
```

### HookV3Update (Request - Update Hook)

```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "description": { "type": "string" },
    "event": { "type": "string", "enum": ["after", "before", "manual"] },
    "operation": { "type": "array", "items": { "type": "string", "enum": ["insert", "update", "delete"] } },
    "notification": { "type": "object" },
    "active": { "type": "boolean" },
    "async": { "type": "boolean" },
    "version": { "type": "string", "enum": ["v1", "v2", "v3"] },
    "trigger_fields": { "type": "array", "items": { "type": "string" } }
  }
}
```

---

## Reference Files

| File | Purpose |
|------|---------|
| [swagger-v3.json](src/schema/swagger-v3.json) | Target file for changes |
| [swagger.json](src/schema/swagger.json) | v1/v2 hook definitions (reference) |
| [hooks-v3.service.ts](src/services/v3/hooks-v3.service.ts) | Field mappings and builder config |
| [hooks-v3.controller.ts](src/controllers/v3/hooks-v3.controller.ts) | Current v3 implementation |

---

## Decisions Made

| Question | Answer |
|----------|--------|
| Additional fields beyond builder config? | Only `trigger_fields` |
| Sample payload endpoint? | Not included (deferred) |
| Hook logs endpoint? | Not included (deferred) |
| Hook test endpoint? | Not included (deferred) |
| Hook trigger endpoint? | Not included (deferred) |

---

## Implementation Checklist

- [x] Add "Hooks" to x-tagGroups Meta APIs
- [x] Add path `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks` (GET, POST)
- [x] Add path `/api/v3/meta/bases/{baseId}/hooks/{hookId}` (GET, PATCH, DELETE)
- [x] Add schema `HookV3`
- [x] Add schema `HookV3List`
- [x] Add schema `HookV3Create`
- [x] Add schema `HookV3Update`

---

**Status:** ✅ Implementation complete.

## Implementation Summary

All hooks API definitions have been added to [swagger-v3.json](src/schema/swagger-v3.json):

| Change | Location |
|--------|----------|
| Added "Hooks" tag | x-tagGroups > Meta APIs |
| hooks-list (GET), hook-create (POST) | `/api/v3/meta/bases/{baseId}/tables/{tableId}/hooks` |
| hook-read (GET), hook-update (PATCH), hook-delete (DELETE) | `/api/v3/meta/bases/{baseId}/hooks/{hookId}` |
| HookV3, HookV3List, HookV3Create, HookV3Update | components/schemas |
