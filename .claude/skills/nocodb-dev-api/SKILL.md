---
name: nocodb-dev-api
description: NocoDB backend API CLI for dev/test. Use when interacting with the NocoDB backend — creating test data, verifying API endpoints, testing CRUD operations, checking role-based access, or setting up workspaces/bases/tables. Provides 156 commands covering all v3 + internal API operations. Supports signup, signin, and auto-refreshes tokens on 401. Run via `npx tsx .claude/skills/nocodb-dev-api/cli.ts <command>`.
---

# nocodb-dev-api — Dev CLI for NocoDB

A CLI tool for AI agents to interact with the NocoDB backend. All commands output JSON. Run via `npx tsx`.

## API Version Priority

Endpoints use **v3 > internal > v1 > v2** preference:
- **v3** (`/api/v3/`) — workspaces, bases, tables, fields, views, records, filters, sorts, links, tokens, scripts
- **internal** (`/api/v2/internal/`) — comments, workflows, dashboards, widgets, audit, MCP, OAuth, sync, permissions, AI features (via `internal` command)
- **v2** (`/api/v2/`) — shared views, extensions, integrations, snapshots, storage, aggregate
- **v1** (`/api/v1/`) — auth, health, notifications, plugins, base users, org admin, bulk data, view configs

## Prerequisites

- NocoDB backend running (default: `http://localhost:8080`)
- Node.js 18+ with `tsx` available (via npx or globally)

## Quick Start

```bash
# Sign up a user and start using the API directly
npx tsx .claude/skills/nocodb-dev-api/cli.ts signup --email=test@example.com --password=Password123.
npx tsx .claude/skills/nocodb-dev-api/cli.ts signin --email=test@example.com --password=Password123.
npx tsx .claude/skills/nocodb-dev-api/cli.ts me
npx tsx .claude/skills/nocodb-dev-api/cli.ts list-workspaces
```

## Optional Setup (test users + sample data)

Standalone scripts create 5 test users with role assignments and populate sample data. Most agents don't need this — use `signup`/`signin` directly instead.

```bash
# Create 5 test users (owner/creator/editor/commenter/viewer) + workspace + roles
npx tsx .claude/skills/nocodb-dev-api/scripts/init.ts
npx tsx .claude/skills/nocodb-dev-api/scripts/init.ts --url=http://localhost:8080

# Populate sample data (AllTypes table with 42 fields, financial tables, scripts, etc.)
npx tsx .claude/skills/nocodb-dev-api/scripts/sample-data.ts
```

## Global Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--as=<email>` | Email to authenticate as | last signed-in user |
| `--workspace=<id>` | Workspace ID (auto-resolved from state) | from state |
| `--base=<id>` | Base ID (required for table/field/view/record ops) | — |
| `--table=<id>` | Table ID (required for field/view/record ops) | — |
| `--view=<id>` | View ID (required for filter/sort/view-column ops) | — |

When `--as` is omitted, the CLI uses the **default user** — the last user who signed in or signed up. After `scripts/init.ts`, this is `owner@agent.test`.

## Test Users (created by `scripts/init.ts`)

All users share password `Password123.`. Use `--as=<email>` to switch between them.

| Role | Email | Workspace Role |
|------|-------|----------------|
| owner | owner@agent.test | owner |
| creator | creator@agent.test | creator |
| editor | editor@agent.test | editor |
| commenter | commenter@agent.test | commenter |
| viewer | viewer@agent.test | viewer |

## Commands

### State

```bash
# View current state (tokens, workspace, etc.)
npx tsx cli.ts state
```

### Auth (v1)

```bash
# Sign in (stores credential + sets as default user)
npx tsx cli.ts signin --email=owner@agent.test --password=Password123.
npx tsx cli.ts signin --email=user@example.com --password=secret

# Sign up a new user (stores credential + sets as default user)
npx tsx cli.ts signup --email=new@example.com --password=Password123.

# Refresh all stored user tokens at once
npx tsx cli.ts refresh-tokens

# Check current user (uses default user)
npx tsx cli.ts me

# Check as a specific user
npx tsx cli.ts me --as=viewer@agent.test
```

**Auto-retry on 401**: All authenticated requests automatically detect expired tokens, re-sign in using stored credentials, and retry the request. Works for any user that has signed in — not just test users.

### Health (v1)

```bash
npx tsx cli.ts health
npx tsx cli.ts version
```

### Workspaces (v3)

```bash
npx tsx cli.ts list-workspaces
npx tsx cli.ts create-workspace --title="My Workspace"
npx tsx cli.ts get-workspace --id=ws_xxxxx
npx tsx cli.ts update-workspace --id=ws_xxxxx --title="New Title"
npx tsx cli.ts delete-workspace --id=ws_xxxxx
```

### Workspace Members (v3 invite/update/remove, v1 list)

```bash
npx tsx cli.ts list-workspace-users
npx tsx cli.ts list-workspace-users --workspace=ws_xxxxx
npx tsx cli.ts invite-workspace-member --email=user@example.com --role=workspace-level-editor
npx tsx cli.ts update-workspace-member --user-id=usr_xxxxx --role=workspace-level-viewer
npx tsx cli.ts remove-workspace-member --user-id=usr_xxxxx
```

### Bases (v3)

```bash
npx tsx cli.ts list-bases
npx tsx cli.ts list-bases --workspace=ws_xxxxx
npx tsx cli.ts create-base --title="Test Base"
npx tsx cli.ts get-base --id=p_xxxxx
npx tsx cli.ts update-base --id=p_xxxxx --title="New Title"
npx tsx cli.ts delete-base --id=p_xxxxx
```

### Base Members (v3 — EE)

Base roles: `owner`, `creator`, `editor`, `viewer`, `commenter`, `no-access`

```bash
npx tsx cli.ts invite-base-member --base=p_xxxxx --email=user@example.com --role=editor
npx tsx cli.ts update-base-member --base=p_xxxxx --user-id=usr_xxxxx --role=viewer
npx tsx cli.ts remove-base-member --base=p_xxxxx --user-id=usr_xxxxx
```

### Tables (v3)

v3 uses `--fields` (not `--columns`) and `type` (not `uidt`).

```bash
npx tsx cli.ts list-tables --base=p_xxxxx
npx tsx cli.ts create-table --base=p_xxxxx --title="Tasks" \
  --fields='[{"title":"Name","type":"SingleLineText"},{"title":"Status","type":"SingleSelect"}]'
npx tsx cli.ts get-table --base=p_xxxxx --id=md_xxxxx
npx tsx cli.ts update-table --base=p_xxxxx --id=md_xxxxx --title="New Name"
npx tsx cli.ts delete-table --base=p_xxxxx --id=md_xxxxx
```

Common `type` values: `SingleLineText`, `LongText`, `Number`, `Checkbox`, `SingleSelect`, `MultiSelect`, `Date`, `DateTime`, `Email`, `URL`, `Attachment`, `Rating`, `Currency`, `Links`

### Fields (v3)

```bash
npx tsx cli.ts list-fields --base=p_xxxxx --table=md_xxxxx
npx tsx cli.ts get-field --base=p_xxxxx --id=cl_xxxxx
npx tsx cli.ts create-field --base=p_xxxxx --table=md_xxxxx --title="Priority" --type=SingleSelect
npx tsx cli.ts create-field --base=p_xxxxx --table=md_xxxxx --title="Status" --type=SingleSelect --dtxp="Open,In Progress,Done"
npx tsx cli.ts update-field --base=p_xxxxx --id=cl_xxxxx --title="New Name"
npx tsx cli.ts delete-field --base=p_xxxxx --id=cl_xxxxx
```

### Views (v3)

```bash
npx tsx cli.ts list-views --base=p_xxxxx --table=md_xxxxx
npx tsx cli.ts create-view --base=p_xxxxx --table=md_xxxxx --title="Board View" --type=kanban
npx tsx cli.ts get-view --base=p_xxxxx --id=vw_xxxxx
npx tsx cli.ts update-view --base=p_xxxxx --id=vw_xxxxx --title="Renamed View"
npx tsx cli.ts delete-view --base=p_xxxxx --id=vw_xxxxx
```

View types: `grid`, `form`, `gallery`, `kanban`, `calendar`, `map`

### View Columns (v3)

```bash
npx tsx cli.ts list-view-columns --base=p_xxxxx --view=vw_xxxxx
npx tsx cli.ts update-view-columns --base=p_xxxxx --view=vw_xxxxx --column=vc_xxxxx --data='{"show":true}'
```

### Filters (v3)

Filters are scoped to a view. Each filter has: `field_id`, `operator`, `value`, optional `sub_operator`.

```bash
npx tsx cli.ts list-filters --base=p_xxxxx --view=vw_xxxxx

# Create a simple filter
npx tsx cli.ts create-filter --base=p_xxxxx --view=vw_xxxxx \
  --data='{"field_id":"cl_xxxxx","operator":"eq","value":"Open"}'

# Create a filter group
npx tsx cli.ts create-filter --base=p_xxxxx --view=vw_xxxxx \
  --data='{"group_operator":"AND","filters":[{"field_id":"cl_xxx1","operator":"eq","value":"Open"},{"field_id":"cl_xxx2","operator":"gt","value":"5"}]}'

# Update (requires id in data)
npx tsx cli.ts update-filter --base=p_xxxxx --view=vw_xxxxx \
  --data='{"id":"flt_xxxxx","field_id":"cl_xxxxx","operator":"neq","value":"Closed"}'

# Replace all filters at once
npx tsx cli.ts replace-filters --base=p_xxxxx --view=vw_xxxxx \
  --data='{"group_operator":"AND","filters":[{"field_id":"cl_xxxxx","operator":"eq","value":"Active"}]}'

npx tsx cli.ts delete-filter --base=p_xxxxx --view=vw_xxxxx --id=flt_xxxxx
```

### Sorts (v3)

```bash
npx tsx cli.ts list-sorts --base=p_xxxxx --view=vw_xxxxx
npx tsx cli.ts create-sort --base=p_xxxxx --view=vw_xxxxx --field-id=cl_xxxxx --direction=asc
npx tsx cli.ts update-sort --base=p_xxxxx --view=vw_xxxxx --id=srt_xxxxx --direction=desc
npx tsx cli.ts delete-sort --base=p_xxxxx --view=vw_xxxxx --id=srt_xxxxx
```

### Records (v3)

v3 wraps field data inside `fields`. The CLI handles this automatically — just pass flat `--data` JSON.

```bash
# List with optional filtering, sorting, pagination
npx tsx cli.ts list-records --base=p_xxxxx --table=md_xxxxx
npx tsx cli.ts list-records --base=p_xxxxx --table=md_xxxxx --where="(Status,eq,Open)" --limit=10 --offset=0
npx tsx cli.ts list-records --base=p_xxxxx --table=md_xxxxx --sort="-Created" --fields="Name,Status"

# Get single record
npx tsx cli.ts get-record --base=p_xxxxx --table=md_xxxxx --id=1

# Create single record
npx tsx cli.ts create-record --base=p_xxxxx --table=md_xxxxx --data='{"Name":"Task 1","Status":"Open"}'

# Create multiple records
npx tsx cli.ts create-records --base=p_xxxxx --table=md_xxxxx \
  --data='[{"Name":"Task 1","Status":"Open"},{"Name":"Task 2","Status":"Done"}]'

# Update — requires --id and --data
npx tsx cli.ts update-record --base=p_xxxxx --table=md_xxxxx --id=1 --data='{"Status":"Done"}'

# Delete
npx tsx cli.ts delete-record --base=p_xxxxx --table=md_xxxxx --id=1

# Count
npx tsx cli.ts count-records --base=p_xxxxx --table=md_xxxxx
npx tsx cli.ts count-records --base=p_xxxxx --table=md_xxxxx --where="(Status,eq,Open)"
```

### Links (v3)

Manage linked records through Link/Links fields.

```bash
# List linked records
npx tsx cli.ts list-links --base=p_xxxxx --table=md_xxxxx --column=cl_xxxxx --row=1

# Link records (pass array of row IDs to link)
npx tsx cli.ts link-records --base=p_xxxxx --table=md_xxxxx --column=cl_xxxxx --row=1 --ids='[2,3,4]'

# Unlink records
npx tsx cli.ts unlink-records --base=p_xxxxx --table=md_xxxxx --column=cl_xxxxx --row=1 --ids='[3]'
```

### Attachment Upload (v3)

Upload base64-encoded file to an attachment field.

```bash
npx tsx cli.ts upload-attachment --base=p_xxxxx --table=md_xxxxx --row=1 --column=cl_xxxxx \
  --content-type=image/png --filename=photo.png --file="<base64-encoded-data>"
```

### Comments (internal)

```bash
npx tsx cli.ts list-comments --base=p_xxxxx --table=md_xxxxx --row=1
npx tsx cli.ts create-comment --base=p_xxxxx --table=md_xxxxx --row=1 --comment="Looks good!"
npx tsx cli.ts update-comment --base=p_xxxxx --id=cmt_xxxxx --comment="Updated comment"
npx tsx cli.ts delete-comment --base=p_xxxxx --id=cmt_xxxxx
```

### Hooks (v3 — list only)

```bash
npx tsx cli.ts list-hooks --base=p_xxxxx --table=md_xxxxx
```

### API Tokens (v3 — EE)

```bash
npx tsx cli.ts list-tokens
npx tsx cli.ts create-token --title="CI Token"
npx tsx cli.ts delete-token --id=tok_xxxxx
```

### Scripts (v3 — EE)

```bash
npx tsx cli.ts list-scripts --base=p_xxxxx
npx tsx cli.ts get-script --base=p_xxxxx --id=scr_xxxxx
npx tsx cli.ts create-script --base=p_xxxxx \
  --data='{"title":"My Script","description":"Does X","script":"console.log(1)","config":{},"meta":{}}'
npx tsx cli.ts update-script --base=p_xxxxx --id=scr_xxxxx --data='{"title":"Renamed"}'
npx tsx cli.ts delete-script --base=p_xxxxx --id=scr_xxxxx
```

### Raw / Custom API Request

The `raw` command lets you hit any API endpoint — useful for testing newly added endpoints that don't have a dedicated command yet.

```bash
# GET request
npx tsx cli.ts raw --method=GET --path=/api/v3/meta/bases/p_xxxxx

# POST with JSON body
npx tsx cli.ts raw --method=POST --path=/api/v3/meta/bases/p_xxxxx/some-endpoint \
  --data='{"key":"value"}'

# PATCH as different user
npx tsx cli.ts raw --method=PATCH --path=/api/v3/meta/bases/p_xxxxx/some-endpoint \
  --data='{"updated":"value"}' --as=editor@agent.test

# DELETE
npx tsx cli.ts raw --method=DELETE --path=/api/v3/meta/bases/p_xxxxx/some-endpoint

# With query parameters (use --param-* prefix)
npx tsx cli.ts raw --method=GET --path=/api/v3/data/p_xxxxx/md_xxxxx/records \
  --param-limit=10 --param-offset=0 --param-where="(Status,eq,Open)"
```

| Flag | Description | Default |
|------|-------------|---------|
| `--method` | HTTP method (GET, POST, PATCH, PUT, DELETE) | `GET` |
| `--path` | API path starting with `/api/...` | required |
| `--data` | JSON body | — |
| `--as` | Email to authenticate as | last signed-in user |
| `--param-*` | Query parameters (e.g. `--param-limit=10`) | — |

### Internal API (generic)

The `internal` command hits the `/api/v2/internal/:wsId/:baseId?operation=...` pattern used for internal operations not covered by named commands.

```bash
npx tsx cli.ts internal --base=p_xxxxx --operation=operationName \
  --data='{"key":"value"}' --method=POST

# With query params
npx tsx cli.ts internal --base=p_xxxxx --operation=listWorkflows \
  --method=GET --param-limit=10
```

### Shared Views (v2)

```bash
npx tsx cli.ts list-shared-views --base=p_xxxxx --table=md_xxxxx
npx tsx cli.ts create-shared-view --base=p_xxxxx --view=vw_xxxxx
npx tsx cli.ts create-shared-view --base=p_xxxxx --view=vw_xxxxx --data='{"password":"secret"}'
npx tsx cli.ts update-shared-view --base=p_xxxxx --view=vw_xxxxx --data='{"password":"newpass"}'
npx tsx cli.ts delete-shared-view --base=p_xxxxx --view=vw_xxxxx
```

### Shared Bases (v2)

```bash
npx tsx cli.ts get-shared-base --base=p_xxxxx
npx tsx cli.ts create-shared-base --base=p_xxxxx
npx tsx cli.ts update-shared-base --base=p_xxxxx --data='{"roles":"viewer"}'
npx tsx cli.ts delete-shared-base --base=p_xxxxx
```

### Public Shared View Data (no auth)

Access shared view data without authentication using the view's UUID.

```bash
npx tsx cli.ts get-shared-view-meta --uuid=abc123-def456
npx tsx cli.ts get-shared-view-rows --uuid=abc123-def456 --param-limit=25 --param-offset=0
npx tsx cli.ts submit-shared-view-row --uuid=abc123-def456 --data='{"Name":"Alice","Email":"alice@example.com"}'
```

### File Storage (v1)

```bash
# Upload a local file (base64 encoded)
npx tsx cli.ts upload-file --file="<base64-data>"
npx tsx cli.ts upload-file --file="<base64-data>" --path="custom/path"

# Upload from URL
npx tsx cli.ts upload-by-url --data='[{"url":"https://example.com/image.png","fileName":"photo.png"}]'
```

### Bulk Data Operations (v1)

Efficient batch operations on table records.

```bash
# Bulk insert
npx tsx cli.ts bulk-insert --base=p_xxxxx --table=md_xxxxx \
  --data='[{"Name":"A"},{"Name":"B"},{"Name":"C"}]'

# Bulk update (each record needs Id)
npx tsx cli.ts bulk-update --base=p_xxxxx --table=md_xxxxx \
  --data='[{"Id":1,"Status":"Done"},{"Id":2,"Status":"Done"}]'

# Bulk delete (each item needs Id)
npx tsx cli.ts bulk-delete --base=p_xxxxx --table=md_xxxxx \
  --data='[{"Id":1},{"Id":2}]'

# Update all matching where clause
npx tsx cli.ts bulk-update-all --base=p_xxxxx --table=md_xxxxx \
  --data='{"where":"(Status,eq,Open)","fields":{"Status":"Archived"}}'

# Delete all matching where clause
npx tsx cli.ts bulk-delete-all --base=p_xxxxx --table=md_xxxxx \
  --data='{"where":"(Status,eq,Archived)"}'
```

### Aggregate (v2)

```bash
npx tsx cli.ts aggregate --base=p_xxxxx --table=md_xxxxx
npx tsx cli.ts aggregate --base=p_xxxxx --table=md_xxxxx --column_name=Amount --func=sum
```

### Notifications (v1)

```bash
npx tsx cli.ts list-notifications
npx tsx cli.ts mark-notification-read --id=notif_xxxxx
npx tsx cli.ts mark-notification-read --id=notif_xxxxx --data='{"is_read":false}'
npx tsx cli.ts mark-all-notifications-read
npx tsx cli.ts delete-notification --id=notif_xxxxx
```

### View Configs (v1)

#### Form

```bash
npx tsx cli.ts get-form-view --base=p_xxxxx --id=vw_xxxxx
npx tsx cli.ts update-form-view --base=p_xxxxx --id=vw_xxxxx --data='{"heading":"Submit Request","subheading":"Fill out the form"}'
npx tsx cli.ts update-form-column --base=p_xxxxx --id=cl_xxxxx --data='{"label":"Your Name","required":true}'
```

#### Gallery

```bash
npx tsx cli.ts get-gallery-view --base=p_xxxxx --id=vw_xxxxx
npx tsx cli.ts update-gallery-view --base=p_xxxxx --id=vw_xxxxx --data='{"fk_cover_image_col_id":"cl_xxxxx"}'
```

#### Kanban

```bash
npx tsx cli.ts get-kanban-view --base=p_xxxxx --id=vw_xxxxx
npx tsx cli.ts update-kanban-view --base=p_xxxxx --id=vw_xxxxx --data='{"fk_grp_col_id":"cl_xxxxx"}'
```

#### Grid

```bash
npx tsx cli.ts list-grid-columns --base=p_xxxxx --id=vw_xxxxx
npx tsx cli.ts update-grid-column --base=p_xxxxx --id=cl_xxxxx --data='{"width":"300"}'
```

#### Map

```bash
npx tsx cli.ts get-map-view --base=p_xxxxx --id=vw_xxxxx
npx tsx cli.ts update-map-view --base=p_xxxxx --id=vw_xxxxx --data='{"fk_geo_data_col_id":"cl_xxxxx"}'
```

### Calendar Data (v1)

```bash
npx tsx cli.ts calendar-data --base=p_xxxxx --table=md_xxxxx --view-name="Calendar View" \
  --param-from_date=2026-01-01 --param-to_date=2026-01-31

npx tsx cli.ts calendar-count-by-date --base=p_xxxxx --table=md_xxxxx --view-name="Calendar View" \
  --param-from_date=2026-01-01 --param-to_date=2026-01-31
```

### Base Users / Collaborators (v1)

These are v1 base-level collaborators (different from v3 base members).

```bash
npx tsx cli.ts list-base-users --base=p_xxxxx
npx tsx cli.ts invite-base-user --base=p_xxxxx --email=user@example.com --roles=editor
npx tsx cli.ts update-base-user --base=p_xxxxx --user-id=usr_xxxxx --roles=viewer
npx tsx cli.ts remove-base-user --base=p_xxxxx --user-id=usr_xxxxx
```

### Extensions (v2)

```bash
npx tsx cli.ts list-extensions --base=p_xxxxx
npx tsx cli.ts get-extension --base=p_xxxxx --id=ext_xxxxx
npx tsx cli.ts create-extension --base=p_xxxxx --data='{"title":"My Extension","extension_id":"ext.abc"}'
npx tsx cli.ts update-extension --base=p_xxxxx --id=ext_xxxxx --data='{"title":"Renamed"}'
npx tsx cli.ts delete-extension --base=p_xxxxx --id=ext_xxxxx
```

### Integrations (v2)

List/create are workspace-scoped; get/update/delete use the integration ID directly.

```bash
npx tsx cli.ts list-integrations
npx tsx cli.ts get-integration --id=integ_xxxxx
npx tsx cli.ts create-integration --data='{"title":"My PG","type":"database","sub_type":"pg","config":{"host":"localhost","port":5432}}'
npx tsx cli.ts update-integration --id=integ_xxxxx --data='{"title":"Renamed","type":"database","sub_type":"pg","config":{...}}'
npx tsx cli.ts delete-integration --id=integ_xxxxx
```

### Sources / Data Sources (v1)

```bash
npx tsx cli.ts list-sources --base=p_xxxxx
npx tsx cli.ts get-source --base=p_xxxxx --id=src_xxxxx
npx tsx cli.ts update-source --base=p_xxxxx --id=src_xxxxx --data='{"alias":"Renamed Source"}'
```

### Snapshots (v2 — EE)

```bash
npx tsx cli.ts list-snapshots --base=p_xxxxx
npx tsx cli.ts update-snapshot --base=p_xxxxx --id=snap_xxxxx --data='{"title":"Renamed"}'
npx tsx cli.ts delete-snapshot --base=p_xxxxx --id=snap_xxxxx
```

### Plugins (v1)

```bash
npx tsx cli.ts list-plugins
npx tsx cli.ts get-plugin --id=plugin_xxxxx
npx tsx cli.ts update-plugin --id=plugin_xxxxx --data='{"active":true,"input":"{\"key\":\"val\"}"}'
npx tsx cli.ts test-plugin --data='{"id":"plugin_xxxxx","input":"{\"key\":\"val\"}"}'
```

### Model Visibilities / UI ACL (v1)

Control which views are visible to which roles.

```bash
npx tsx cli.ts get-visibility-rules --base=p_xxxxx
npx tsx cli.ts set-visibility-rules --base=p_xxxxx \
  --data='[{"id":"vw_xxxxx","disabled":{"commenter":true,"viewer":true}}]'
```

### Org Users — Admin (v1)

Requires super admin (owner) access.

```bash
npx tsx cli.ts list-org-users
npx tsx cli.ts create-org-user --data='{"email":"new@example.com","roles":"org-level-viewer"}'
npx tsx cli.ts update-org-user --id=usr_xxxxx --data='{"roles":"org-level-creator"}'
npx tsx cli.ts delete-org-user --id=usr_xxxxx
```

### Org Tokens (v1)

```bash
npx tsx cli.ts list-org-tokens
npx tsx cli.ts create-org-token --data='{"description":"CI Pipeline"}'
npx tsx cli.ts delete-org-token --id=tok_xxxxx
```

### Jobs (v1)

```bash
npx tsx cli.ts list-jobs --base=p_xxxxx
npx tsx cli.ts list-jobs --base=p_xxxxx --data='{"status":"completed"}'
```

### Swagger (v1)

```bash
npx tsx cli.ts swagger --base=p_xxxxx
```

### App Info / Utils (v1)

```bash
npx tsx cli.ts app-info
npx tsx cli.ts test-connection --data='{"client":"pg","connection":{"host":"localhost","port":5432,"database":"mydb","user":"pg","password":"secret"}}'
```

### Cache Admin (v1)

```bash
npx tsx cli.ts get-cache
npx tsx cli.ts clear-cache
```

### User Profile (v1)

```bash
npx tsx cli.ts update-profile --data='{"display_name":"Agent Test"}'
```

### SQL Views (v1)

```bash
npx tsx cli.ts create-sql-view --base=p_xxxxx --source=src_xxxxx \
  --data='{"title":"Active Users","sql":"SELECT * FROM users WHERE active = true"}'
```

### Role-based Testing

Any command can be run as a different user with `--as=<email>`:

```bash
# Viewer trying to create a record (should fail with 403)
npx tsx cli.ts create-record --base=p_xxxxx --table=md_xxxxx --data='{"Name":"Test"}' --as=viewer@agent.test

# Editor creating a record (should succeed)
npx tsx cli.ts create-record --base=p_xxxxx --table=md_xxxxx --data='{"Name":"Test"}' --as=editor@agent.test
```

## v3 Response Formats

### Records

```json
{
  "records": [
    {
      "id": 1,
      "fields": {
        "Name": "Alice",
        "Email": "alice@example.com"
      }
    }
  ]
}
```

### Filters

```json
{
  "group_operator": "AND",
  "filters": [
    { "id": "flt_xxx", "field_id": "cl_xxx", "operator": "eq", "value": "Open" }
  ]
}
```

### Sorts

```json
[
  { "id": "srt_xxx", "field_id": "cl_xxx", "direction": "asc" }
]
```

## State File

State is persisted in `.claude/skills/nocodb-dev-api/.state.json` (gitignored):

```json
{
  "url": "http://localhost:8080",
  "credentials": {
    "owner@agent.test": {
      "email": "owner@agent.test",
      "password": "Password123.",
      "token": "jwt..."
    },
    "editor@agent.test": {
      "email": "editor@agent.test",
      "password": "Password123.",
      "token": "jwt..."
    }
  },
  "defaultUser": "owner@agent.test",
  "workspace": {
    "id": "ws_xxxxx",
    "title": "Agent Workspace"
  },
  "baseWorkspaces": {
    "p_abc123": "ws_xxxxx"
  },
  "updatedAt": "2026-02-19T18:00:00.000Z"
}
```

Tokens auto-refresh on 401 errors — the CLI re-signs in using stored credentials and retries the request automatically. Legacy state files with `tokens` are auto-migrated on first read. `baseWorkspaces` is auto-populated — when an internal API call needs a workspace ID for a base, it fetches via `get-base` and caches the mapping.

## Common Workflows

### Create a table with fields, views, filters, and data

```bash
# 1. Create base
npx tsx cli.ts create-base --title="Demo"
# Note the base id, e.g. p_abc123

# 2. Create table with initial fields
npx tsx cli.ts create-table --base=p_abc123 --title="Contacts" \
  --fields='[{"title":"Name","type":"SingleLineText"},{"title":"Email","type":"Email"},{"title":"Status","type":"SingleSelect"}]'
# Note the table id, e.g. md_def456

# 3. Add more fields
npx tsx cli.ts create-field --base=p_abc123 --table=md_def456 --title="Company" --type=SingleLineText

# 4. Insert records
npx tsx cli.ts create-records --base=p_abc123 --table=md_def456 \
  --data='[{"Name":"Alice","Email":"alice@example.com","Company":"Acme","Status":"Active"},{"Name":"Bob","Email":"bob@example.com","Company":"Globex","Status":"Inactive"}]'

# 5. Create a view with filters
npx tsx cli.ts create-view --base=p_abc123 --table=md_def456 --title="Active Contacts" --type=grid
# Note the view id, e.g. vw_ghi789

# 6. Add a filter to the view
npx tsx cli.ts create-filter --base=p_abc123 --view=vw_ghi789 \
  --data='{"field_id":"cl_status_id","operator":"eq","value":"Active"}'

# 7. Add sort
npx tsx cli.ts create-sort --base=p_abc123 --view=vw_ghi789 --field-id=cl_name_id --direction=asc

# 8. Query through the view
npx tsx cli.ts list-records --base=p_abc123 --table=md_def456 --view=vw_ghi789
```

### Work with linked records

```bash
# Assuming a Links field cl_link_id on table md_tasks linking to md_contacts
npx tsx cli.ts list-links --base=p_abc123 --table=md_tasks --column=cl_link_id --row=1
npx tsx cli.ts link-records --base=p_abc123 --table=md_tasks --column=cl_link_id --row=1 --ids='[2,3]'
npx tsx cli.ts unlink-records --base=p_abc123 --table=md_tasks --column=cl_link_id --row=1 --ids='[3]'
```

### Manage base access

```bash
npx tsx cli.ts invite-base-member --base=p_abc123 --email=dev@example.com --role=editor
npx tsx cli.ts update-base-member --base=p_abc123 --user-id=usr_xxxxx --role=viewer
npx tsx cli.ts remove-base-member --base=p_abc123 --user-id=usr_xxxxx
```

## Error Format

All errors are JSON with non-zero exit code:

```json
{
  "error": "404 Table not found"
}
```

## Complete Command List (156 commands)

| Category | Commands |
|----------|----------|
| **Setup** | `state`, `raw`, `internal` |
| **Auth** | `signin`, `signup`, `refresh-tokens`, `me` |
| **Health** | `health`, `version` |
| **Workspaces** | `list-workspaces`, `create-workspace`, `get-workspace`, `update-workspace`, `delete-workspace` |
| **Workspace Members** | `list-workspace-users`, `invite-workspace-member`, `update-workspace-member`, `remove-workspace-member` |
| **Bases** | `list-bases`, `create-base`, `get-base`, `update-base`, `delete-base` |
| **Base Members (v3)** | `invite-base-member`, `update-base-member`, `remove-base-member` |
| **Tables** | `list-tables`, `create-table`, `get-table`, `update-table`, `delete-table` |
| **Fields** | `list-fields`, `get-field`, `create-field`, `update-field`, `delete-field` |
| **Views** | `list-views`, `create-view`, `get-view`, `update-view`, `delete-view` |
| **View Columns** | `list-view-columns`, `update-view-columns` |
| **Filters** | `list-filters`, `create-filter`, `update-filter`, `replace-filters`, `delete-filter` |
| **Sorts** | `list-sorts`, `create-sort`, `update-sort`, `delete-sort` |
| **Records** | `list-records`, `get-record`, `create-record`, `create-records`, `update-record`, `delete-record`, `count-records` |
| **Links** | `list-links`, `link-records`, `unlink-records` |
| **Attachments** | `upload-attachment` |
| **Comments** | `list-comments`, `create-comment`, `update-comment`, `delete-comment` |
| **Hooks** | `list-hooks` |
| **API Tokens** | `list-tokens`, `create-token`, `delete-token` |
| **Scripts** | `list-scripts`, `get-script`, `create-script`, `update-script`, `delete-script` |
| **Shared Views** | `list-shared-views`, `create-shared-view`, `update-shared-view`, `delete-shared-view` |
| **Shared Bases** | `get-shared-base`, `create-shared-base`, `update-shared-base`, `delete-shared-base` |
| **Public Views** | `get-shared-view-meta`, `get-shared-view-rows`, `submit-shared-view-row` |
| **File Storage** | `upload-file`, `upload-by-url` |
| **Bulk Operations** | `bulk-insert`, `bulk-update`, `bulk-delete`, `bulk-update-all`, `bulk-delete-all` |
| **Aggregate** | `aggregate` |
| **Notifications** | `list-notifications`, `mark-notification-read`, `delete-notification`, `mark-all-notifications-read` |
| **Form View** | `get-form-view`, `update-form-view`, `update-form-column` |
| **Gallery View** | `get-gallery-view`, `update-gallery-view` |
| **Kanban View** | `get-kanban-view`, `update-kanban-view` |
| **Grid View** | `list-grid-columns`, `update-grid-column` |
| **Map View** | `get-map-view`, `update-map-view` |
| **Calendar** | `calendar-data`, `calendar-count-by-date` |
| **Base Users (v1)** | `list-base-users`, `invite-base-user`, `update-base-user`, `remove-base-user` |
| **Extensions** | `list-extensions`, `get-extension`, `create-extension`, `update-extension`, `delete-extension` |
| **Integrations** | `list-integrations`, `get-integration`, `create-integration`, `update-integration`, `delete-integration` |
| **Sources** | `list-sources`, `get-source`, `update-source` |
| **Snapshots (EE)** | `list-snapshots`, `update-snapshot`, `delete-snapshot` |
| **Plugins** | `list-plugins`, `get-plugin`, `update-plugin`, `test-plugin` |
| **Visibility / UI ACL** | `get-visibility-rules`, `set-visibility-rules` |
| **Org Users (Admin)** | `list-org-users`, `create-org-user`, `update-org-user`, `delete-org-user` |
| **Org Tokens** | `list-org-tokens`, `create-org-token`, `delete-org-token` |
| **Jobs** | `list-jobs` |
| **Swagger** | `swagger` |
| **App Info** | `app-info`, `test-connection` |
| **Cache** | `get-cache`, `clear-cache` |
| **Profile** | `update-profile` |
| **SQL Views** | `create-sql-view` |
