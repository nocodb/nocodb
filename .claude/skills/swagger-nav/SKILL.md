---
name: swagger-nav
description: Navigate and query large OpenAPI/Swagger JSON files. Use when reading or modifying swagger specs — listing endpoints, inspecting schemas, finding references, searching for fields. Supports swagger-v3.json (V3 API), swagger.json (CE/V2), swagger-v2.json, and EE swagger. Run via `npx tsx .claude/skills/swagger-nav/cli.ts <command>`.
---

# swagger-nav — Swagger File Navigator

CLI tool for efficiently navigating the nocohub OpenAPI specifications without loading entire files into context.

## Quick Start

```bash
# Overview of swagger-v3.json
npx tsx .claude/skills/swagger-nav/cli.ts summary

# List all endpoints
npx tsx .claude/skills/swagger-nav/cli.ts list-paths

# Find dashboard-related endpoints
npx tsx .claude/skills/swagger-nav/cli.ts list-paths --filter=dashboard

# Read a specific schema
npx tsx .claude/skills/swagger-nav/cli.ts get-schema --name=DashboardCreateReq

# Read a schema with resolved $refs
npx tsx .claude/skills/swagger-nav/cli.ts get-schema --name=DashboardCreateReq --resolve-refs --depth=2

# Find what references a schema
npx tsx .claude/skills/swagger-nav/cli.ts get-refs --name=Base

# Search for a field name across the entire spec
npx tsx .claude/skills/swagger-nav/cli.ts search --query=fk_workspace_id
```

## Swagger Files

| Alias | File | Path | Description |
|-------|------|------|-------------|
| `v3` (default) | swagger-v3.json | packages/nocodb/src/schema/ | V3 API — workspaces, bases, tables, views, dashboards |
| `ce` / `legacy` | swagger.json | packages/nocodb/src/schema/ | CE/V2 API — legacy endpoints |
| `v2` | swagger-v2.json | packages/nocodb/src/schema/ | V2 API (deprecated) |
| `ee` | swagger.json | packages/nocodb/src/ee/schema/ | EE-only endpoints |
| `v3Patch` | swagger-v3-validation-patch.json | packages/nocodb/src/schema/ | V3 validation overrides |

## Global Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--file=<alias\|path>` | `v3` | Swagger file to query (alias or file path) |
| `--include-original` | — | Merge with the original CE spec (`ee`→`ce`, `v3Patch`→`v3`). The queried spec's entries win on conflict. |
| `--format=<fmt>` | `json` | Output format: `json` (pretty), `compact` (one-line), `text` (human-readable) |

## Commands

### `summary`

File overview — paths, schemas, operations, tags, method distribution.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts summary
npx tsx .claude/skills/swagger-nav/cli.ts summary --file=ee
npx tsx .claude/skills/swagger-nav/cli.ts summary --format=text
```

### `list-paths`

List all endpoint paths with their methods, operationIds, summaries, and tags.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts list-paths
npx tsx .claude/skills/swagger-nav/cli.ts list-paths --tag=Dashboards
npx tsx .claude/skills/swagger-nav/cli.ts list-paths --filter=widget
npx tsx .claude/skills/swagger-nav/cli.ts list-paths --file=ee --format=text
```

| Flag | Description |
|------|-------------|
| `--tag=<tag>` | Filter by exact tag name (case-insensitive) |
| `--filter=<keyword>` | Filter by keyword in path, operationId, summary, or tag |

### `list-schemas`

List all schema names with type and property count.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts list-schemas
npx tsx .claude/skills/swagger-nav/cli.ts list-schemas --filter=Widget
npx tsx .claude/skills/swagger-nav/cli.ts list-schemas --filter=Field --file=ce
```

| Flag | Description |
|------|-------------|
| `--filter=<keyword>` | Filter by substring in schema name (case-insensitive) |

### `get-path`

Read the full definition of a specific endpoint. Supports exact path or fuzzy substring matching.

```bash
# Exact path
npx tsx .claude/skills/swagger-nav/cli.ts get-path --path=/api/v3/meta/workspaces

# Fuzzy match — finds all paths containing "widgets"
npx tsx .claude/skills/swagger-nav/cli.ts get-path --path=widgets

# Specific HTTP method only
npx tsx .claude/skills/swagger-nav/cli.ts get-path --path=/api/v3/meta/workspaces --method=post
```

| Flag | Description |
|------|-------------|
| `--path=<path>` | Full path or fuzzy substring (**required**) |
| `--method=<method>` | Filter to specific HTTP method (get, post, patch, delete) |

### `get-schema`

Read the full definition of a specific schema. Optionally resolves `$ref` pointers inline.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts get-schema --name=Base
npx tsx .claude/skills/swagger-nav/cli.ts get-schema --name=DashboardCreateReq --resolve-refs
npx tsx .claude/skills/swagger-nav/cli.ts get-schema --name=WidgetRead --resolve-refs --depth=2
```

| Flag | Description |
|------|-------------|
| `--name=<name>` | Schema name (**required**) |
| `--resolve-refs` | Inline-resolve `$ref` pointers to other schemas |
| `--depth=<n>` | Max ref resolution depth (default: 1). Higher = more detail but larger output |

### `search`

Full-text search across the entire spec — matches string values and keys.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts search --query=dashboard
npx tsx .claude/skills/swagger-nav/cli.ts search --query=fk_workspace_id --limit=20
npx tsx .claude/skills/swagger-nav/cli.ts search --query=widget_id --file=v3Patch
```

| Flag | Description |
|------|-------------|
| `--query=<keyword>` | Search term (**required**) |
| `--limit=<n>` | Max results (default: 50) |

### `get-refs`

Find all locations (paths and schemas) that reference a given schema via `$ref`.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts get-refs --name=Base
npx tsx .claude/skills/swagger-nav/cli.ts get-refs --name=Paginated
```

| Flag | Description |
|------|-------------|
| `--name=<name>` | Schema name (**required**) |

### `validate-refs`

Find broken `$ref` references — refs pointing to schemas that don't exist.

```bash
npx tsx .claude/skills/swagger-nav/cli.ts validate-refs
npx tsx .claude/skills/swagger-nav/cli.ts validate-refs --file=ee
```

## Common Workflows

### Adding a new V3 endpoint

1. `summary` — see current path/schema counts
2. `list-paths --tag=<SimilarTag>` — find similar endpoints to use as template
3. `get-path --path=<similar>` — copy the structure
4. `list-schemas --filter=<Entity>` — find related request/response schemas
5. `get-schema --name=<SimilarReq> --resolve-refs` — understand the request shape

### Finding all uses of a schema before renaming

1. `get-refs --name=SchemaName` — find all `$ref` locations
2. Update all references along with the schema name

### Checking validation patch overrides

1. `list-schemas --file=v3Patch` — see what schemas the patch overrides
2. `get-schema --name=SchemaName --file=v3Patch` — see the override only
3. `get-schema --name=SchemaName --file=v3Patch --include-original` — see override merged with v3 schemas

### Verifying spec integrity after edits

1. `validate-refs` — check for broken references
2. `summary` — verify counts match expectations
