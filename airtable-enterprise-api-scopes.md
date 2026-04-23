# Plan — Airtable Enterprise parity for fine-grained API token scopes

## Goal

Support the additional scopes Airtable's **Enterprise** plan exposes on fine-grained personal access tokens. We already cover the "standard" set (records, schema, webhooks, users, base). This plan adds the admin/audit/SCIM surfaces unique to Enterprise.

## What Airtable supports

### Standard scopes (all plans)

| Airtable scope | NocoDB equivalent (already supported) |
|---|---|
| `data.records:read` / `data.records:write` | `records` (read/write) |
| `data.recordComments:read` / `data.recordComments:write` | `comments` (read/write) |
| `schema.bases:read` / `schema.bases:write` | `tables`, `fields`, `views`, `base` (read/write) |
| `webhook:manage` | `webhooks` (write) |
| `user.email:read` | `users` (read) |
| `block:manage` | n/a — Airtable Apps, no NocoDB equivalent |

### Enterprise-only scopes (gap)

| Airtable scope | Description |
|---|---|
| `enterprise.account:read` | Read org/billing/subscription meta |
| `enterprise.user:read` / `enterprise.user:write` | Manage users at org level (invite, remove, change role) |
| `enterprise.groups:read` / `enterprise.groups:manage` | Groups (teams) — create, add/remove members |
| `enterprise.auditLogs:read` | Read audit log stream |
| `enterprise.changeEvents:read` | Read record-level change events across the org |
| `enterprise.scim.usersAndGroups:manage` | SCIM provisioning (users + groups) |
| `workspace.shares:manage` | Manage shared view / shared base links org-wide |

## What we'll add to NocoDB

Five new permission categories scoped at the **workspace** resource type (not base-level — these operations cross bases):

| Category | Maps to Airtable | Backend endpoints (existing) |
|---|---|---|
| `org_users` | `enterprise.user:*` | `OrgUsersController`, `WorkspaceUsersController` |
| `teams` | `enterprise.groups:*` | `TeamsV3Controller`, group management |
| `audit_logs` | `enterprise.auditLogs:read` | `AuditController` (list/export) |
| `change_events` | `enterprise.changeEvents:read` | `RecordAuditController` (new or existing) |
| `scim` | `enterprise.scim.usersAndGroups:manage` | `ScimController` |

Stretch (optional):

| Category | Maps to | Notes |
|---|---|---|
| `org_account` | `enterprise.account:read` | Billing / subscription read-only |
| `shares` | `workspace.shares:manage` | Shared view/base link admin |

All reuse the existing `ApiTokenPermissionLevel` (`none` / `read` / `write`).

## API v3 endpoint availability (codebase audit)

Audit of the actual controllers shows mixed coverage. Some target endpoints exist on v3 today, others are v2-only, and SCIM uses its own auth layer.

| Plan category | v3 endpoint | Status | Notes |
|---|---|---|---|
| `org_users` (workspace) | `/api/v3/meta/workspaces/:workspaceId/members` | ✅ Exists | `workspace-members-v3.controller.ts` — POST/PATCH/DELETE |
| `org_users` (base) | `/api/v3/meta/bases/:baseId/members` | ✅ Exists | `base-members-v3.controller.ts` |
| `org_users` (org-level) | `/api/v3/meta/orgs/:orgId/users` | ❌ Missing | Only v2: `/api/v2/orgs/:orgId/users` in `ee-cloud/controllers/org-users.controller.ts` |
| `teams` | `/api/v3/meta/{workspaces,orgs}/:id/teams/*` | ✅ Exists | `teams-v3.controller.ts` — CRUD + tree + move + members |
| `audit_logs` | `/api/v3/.../audits` | ❌ Missing | Only v2 surface: `/api/v2/meta/audits`, `/api/v2/meta/workspace/:wsId/audits`, `/api/v2/meta/bases/:baseId/audits`, `/api/v2/orgs/:orgId/audits` |
| `change_events` | `/api/v3/records/audit` | ❌ Missing | Record-level audit also only on v2 |
| `scim` | `/api/v3/meta/orgs/:orgId/scim/v2/*` | ⚠️ Exists but separate auth | Uses `ScimAuthGuard`, not API token auth — IdP provisioning pattern; see below |

### Implications

- **`teams`** — unblocked, can ship as soon as the scope mapping lands.
- **Workspace / base `org_users`** — unblocked for workspace and base members. Org-level member management (`/api/v2/orgs/:orgId/users`) needs a v3 equivalent or falls back to v2.
- **`audit_logs` + `change_events`** — blocked on v3 endpoints. Either:
  - a) build v3 audit controllers first (new work, likely on a v3 roadmap already), or
  - b) let the API token middleware also enforce scopes on the v2 audit routes (feasible but stretches scope enforcement across two API versions — not clean).
- **`scim`** — probably **drop from the plan**. SCIM's `ScimAuthGuard` is specifically designed for IdP-driven provisioning with its own token type; overlapping it with PAT scopes muddies the auth model. Parity with Airtable's `enterprise.scim.usersAndGroups:manage` would require bypassing that guard for PATs, which likely isn't the right call. Keep SCIM's existing auth; users who need both can hold separate tokens.

### Revised near-term scope (what we can actually ship)

Phase 1 (unblocked):
- `teams` (workspace + org)
- `org_users` (workspace + base members; defer org-level users until v3 exists)

Phase 2 (blocked on v3 endpoints):
- `audit_logs`
- `change_events`

Out (reconsidered):
- `scim` — keep on its own auth
- `org_account`, `shares` — already marked stretch, no change

## Changes required

### SDK (`packages/nocodb-sdk/src/lib/apiToken.ts`)

1. Extend `ApiTokenPermissionCategory` enum with the new keys (`org_users`, `teams`, `audit_logs`, `change_events`, `scim`, + stretch).
2. Add a `WORKSPACE_SCOPED_PERMISSION_CATEGORIES` constant mirroring `BASE_SCOPED_PERMISSION_CATEGORIES`.
3. Add a new group to `API_TOKEN_PERMISSION_GROUPS` — e.g. `Enterprise: [org_users, teams, audit_logs, change_events, scim]`.
4. Gate the enterprise group behind a plan-feature flag in the UI preset map.
5. Rebuild SDK: `cd packages/nocodb-sdk && pnpm run build:ee`.

### Backend

1. **Enforcement**: the middleware that reads `ApiTokenScope` + checks category against the incoming route already exists for base-level. Extend the route→category mapping table to cover the new workspace-level endpoints:
   - `/api/v3/orgs/:orgId/users/*` → `org_users`
   - `/api/v3/workspaces/:workspaceId/users/*` → `org_users`
   - `/api/v3/teams/*` → `teams`
   - `/api/v3/audit/*` → `audit_logs`
   - `/api/v3/records/audit/*` → `change_events`
   - `/api/scim/*` → `scim`
2. **Plan gating**: add a new `PlanFeatureTypes.FEATURE_API_TOKEN_ENTERPRISE_SCOPES` (or reuse an existing enterprise-tier feature). Gate both UI and backend:
   - UI: hide the Enterprise group section behind `blockApiTokenEnterpriseScopes`.
   - Backend: on token create/update, reject scopes with enterprise categories when the workspace plan doesn't include the feature (`checkForFeature` in `paymentHelpers`).
3. **No new migration** — `ApiTokenPermissions` is JSON, schema-free.

### Frontend

1. Render the new Enterprise group in the token-create / token-edit wizard (`packages/nc-gui/ee/components/account/TokenCreateWizard.vue` — already referenced in CLAUDE.md).
2. Show `PaymentUpgradeBadge` next to the Enterprise section when the feature is locked (on-prem unlicensed / cloud on a lower tier).
3. Existing per-category toggles (none/read/write) work as-is.

### Tests

1. Unit: extend `ApiToken.test.ts` to cover create/update with enterprise categories — accepted on enterprise plan, rejected otherwise.
2. Integration: token created with `audit_logs: read` can hit `/api/v3/audit`, gets 403 on other endpoints.
3. Plan gating: token with enterprise scopes created under enterprise plan → downgrade workspace → subsequent requests return 402 (or auto-revoke the scopes — decide via user).

## Open questions

1. **Downgrade behaviour**: when a workspace drops from Enterprise, what happens to existing tokens with enterprise scopes? Options: (a) tokens continue working but the scopes silently no-op; (b) scopes return 402; (c) auto-strip on downgrade. Pick one before building.
2. **`change_events` vs existing audit**: NocoDB already has record-level audits under `/api/v3/audit`. Is a separate `change_events` category needed, or is it the same surface? Collapse if same.
3. **SCIM endpoint auth**: SCIM typically uses its own bearer token (IdP). Does it make sense to expose via API token scopes at all, or should SCIM stay on its own provisioning-token auth? Check current `ScimController` auth.
4. **`org_account` scope**: do we expose billing / subscription details via API at all today? If not, defer.

## Out of scope

- `block:manage` (Airtable Apps) — no equivalent on NocoDB.
- OAuth-based tokens — this is about personal access tokens (PAT-style) only.
- Scope expiry / rotation policy changes.

## Rough sizing

- SDK changes: [S]
- Backend route→category mapping + plan gate: [M]
- Frontend UI updates: [S]
- Tests: [M]
- **Total: ~1–2 weeks for one dev**, gated on the four open questions being answered first.
