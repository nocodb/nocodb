# SCIM Implementation Review — NocoDB Enterprise

## Summary

The SCIM 2.0 implementation covers configuration management, user provisioning, group provisioning, schema discovery, and service provider config. The architecture is clean and well-structured, but there are **several critical bugs** that will prevent it from working at runtime, plus missing pieces that need addressing before this is production-ready.

---

## Critical Bugs (Must Fix)

### 1. ScimBearerStrategy Cannot Access workspaceId — SHOWSTOPPER

**File:** `packages/nocodb/src/ee/strategies/scim-bearer.strategy.ts` (line 20)

The strategy tries to read `(this as any).workspaceId`, but the guard sets it on `request.workspaceId`. Passport's `validate()` method on `passport-http-bearer` does NOT receive the request object by default — you need `passReqToCallback: true`.

**Current code:**
```ts
async validate(token: string, done: any) {
  const workspaceId = (this as any).workspaceId; // Always undefined!
}
```

**Fix:** Pass `{ passReqToCallback: true }` to `super()` and accept `req` as the first parameter:
```ts
constructor(private scimConfigService: ScimConfigService) {
  super({ passReqToCallback: true });
}

async validate(req: any, token: string, done: any) {
  const workspaceId = req.workspaceId; // Set by ScimAuthGuard
  // ...rest of validation
}
```

**Impact:** Every SCIM User/Group/Schema endpoint will fail with "Workspace ID not found in request" because `workspaceId` is always `undefined`.

---

### 2. TenantContext Decorator Returns `undefined` for SCIM Endpoints — SHOWSTOPPER

**File:** `packages/nocodb/src/decorators/tenant-context.decorator.ts`

The `@TenantContext()` decorator reads `request.context`, which is populated by the `extract-ids` middleware (part of `GlobalGuard`). SCIM User/Group controllers use `ScimAuthGuard` instead, which does NOT run `extract-ids`. So `request.context` is never set.

The `ScimBearerStrategy.validate()` returns `{ workspaceId, context }` — but NestJS Passport puts this on `request.user`, not `request.context`.

**Fix options:**
- **Option A:** Have `ScimAuthGuard.canActivate()` also set `request.context` after successful auth:
  ```ts
  canActivate(context: ExecutionContext) {
    // ... existing code ...
    const result = await super.canActivate(context);
    if (result) {
      request.context = request.user.context; // Copy context from passport user
    }
    return result;
  }
  ```
- **Option B:** Create a `ScimContext` decorator that reads from `request.user.context` instead.

**Impact:** All SCIM service methods receive `undefined` as their `context` parameter, causing failures in any model method that uses `context` for scoping.

---

### 3. Backend ACL Definitions Missing for SCIM Config Endpoints

**File:** `packages/nocodb/src/ee/utils/acl.ts`

The `ScimConfigController` uses `@Acl('scimConfigGet')`, `@Acl('scimConfigCreate')`, `@Acl('scimConfigUpdate')`, `@Acl('scimConfigDelete')` — but none of these are defined in the ACL configuration. The SSO ACL entries exist (`ssoClientList`, `ssoClientCreate`, etc.) but there are no corresponding SCIM entries.

**Fix:** Add to the workspace owner role section in `acl.ts`:
```ts
// In the owner permissions array:
'scimConfigGet',
'scimConfigCreate',
'scimConfigUpdate',
'scimConfigDelete',

// In the descriptions:
scimConfigGet: 'view SCIM configuration',
scimConfigCreate: 'initialize SCIM configuration',
scimConfigUpdate: 'update SCIM configuration',
scimConfigDelete: 'delete SCIM configuration',
```

**Impact:** The `@Acl` decorator will reject all SCIM config requests because no role has these permissions.

---

### 4. Token Comparison Vulnerable to Timing Attacks

**File:** `packages/nocodb/src/ee/services/scim/scim-config.service.ts` (line 141)

```ts
return config.provisioning_token === token; // Timing-unsafe!
```

String `===` leaks information about the token via response timing differences. For a security-critical bearer token validation, use `crypto.timingSafeEqual`:

```ts
import { timingSafeEqual } from 'crypto';

const a = Buffer.from(config.provisioning_token);
const b = Buffer.from(token);
return a.length === b.length && timingSafeEqual(a, b);
```

---

### 5. `scim_meta` Never Parsed from JSON on Read

**File:** `packages/nocodb/src/ee/models/WorkspaceUser.ts` (line 494-496)

The `userList()` method only calls `parseMetaProp(workspaceUser)` which parses the `meta` field — but `scim_meta` is stored as serialized JSON text and is never parsed. When `scim-users.service.ts` line 227 does:
```ts
scim_meta: {
  ...(workspaceUser.scim_meta as any), // Spreading a string!
  name: scimUser.name,
}
```
...this spreads a string (e.g. `'{"name":{"givenName":"John"}}'`), creating character-index properties (`{ '0': '{', '1': '"', ... }`) instead of the expected object.

**Fix:** Add `scim_meta` parsing in `userList()`:
```ts
workspaceUsers = workspaceUsers.map((workspaceUser) => {
  workspaceUser.meta = parseMetaProp(workspaceUser);
  workspaceUser.scim_meta = parseMetaProp(workspaceUser, 'scim_meta');
  return workspaceUser;
});
```

---

### 6. Cannot Reactivate Soft-Deleted Users

**File:** `packages/nocodb/src/ee/services/scim/scim-users.service.ts`

Two related issues:

**a) `updateUser` (line 211):** Calls `WorkspaceUser.userList()` without `include_deleted: true`, so it will never find soft-deleted users to reactivate them.

**b) `createUser` (line 145):** Calls `WorkspaceUser.get()` which returns `null` for deleted users (line 202 of the model). So the `existingWsUser.deleted` check at line 147 is unreachable — if the user was previously deactivated via SCIM DELETE, re-provisioning them will try to `insert` a duplicate.

**Fix:**
- For `updateUser`: Pass `include_deleted: true` to `userList()`
- For `createUser`: Use a query that includes deleted records, or add an `include_deleted` parameter to `WorkspaceUser.get()`

---

## Significant Issues (Should Fix)

### 7. SCIM Error Response Format Non-Compliant

SCIM 2.0 (RFC 7644 §3.12) requires error responses in this format:
```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "detail": "User not found",
  "status": "404"
}
```

Currently, `NcError.notFound()`, `NcError.badRequest()`, etc. return NocoDB's standard error format, which IdPs (Okta, Azure AD, etc.) won't understand properly. You need a SCIM exception filter or interceptor.

**Fix:** Add a NestJS exception filter for SCIM routes:
```ts
@Catch()
export class ScimExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception.status || 500;
    response.status(status).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: exception.message,
      status: String(status),
    });
  }
}
```

### 8. Content-Type Should Be `application/scim+json`

SCIM 2.0 (RFC 7644 §3.1) specifies that responses SHOULD use `Content-Type: application/scim+json`. Most IdPs accept `application/json`, but some (particularly Okta) may behave differently. Consider adding a SCIM interceptor that sets the response content type.

### 9. `scim_external_id` Uniqueness Not Enforced at DB Level for workspace_user

The migration adds a unique constraint on `scim_external_id` for the `nc_teams` table (line 22: `.unique()`), but NOT for the `nc_workspace_user` table. This means duplicate SCIM external IDs can exist for workspace users, causing ambiguous lookups.

**Fix:** Add a composite unique index `(fk_workspace_id, scim_external_id)` to `nc_workspace_user`.

### 10. In-Memory Filtering and Pagination Won't Scale

Both `ScimUsersService.listUsers()` and `ScimGroupsService.listGroups()` load ALL records into memory, then filter and paginate in JavaScript. For workspaces with thousands of users, this will be slow and memory-intensive.

**Fix (for later):** Push filtering and pagination to the database layer. Add methods like `WorkspaceUser.findByScimExternalId()` and `WorkspaceUser.scimList({ filter, offset, limit })`.

### 11. User Lookup by scimId is O(n) per Request

`getUser()`, `updateUser()`, and `deactivateUser()` all call `WorkspaceUser.userList()` to get ALL users, then do `.find()`. This is O(n) for every single SCIM GET/PATCH/DELETE.

**Fix:** Add a direct lookup method: `WorkspaceUser.getByScimExternalId(workspaceId, externalId)`.

### 12. Frontend ACL Missing for SCIM

**File:** `packages/nc-gui/ee/lib/acl.ts`

No `scimConfigGet`, `scimConfigCreate`, etc. permissions are defined in the frontend ACL. The workspace `Sso.vue` component doesn't seem to check ACL for SCIM operations, but it should for consistency and to properly hide/show UI elements for non-owner roles.

### 13. `addTeamMembers` Doesn't Check for Existing Assignments

**File:** `packages/nocodb/src/ee/services/scim/scim-groups.service.ts` (line 411)

`PrincipalAssignment.insert()` is called without checking if the assignment already exists. If an IdP sends an "add member" operation for a user already in the group, this could create duplicates or throw a DB constraint error.

### 14. Provisioning Token Stored in Plaintext

**File:** `packages/nocodb/src/ee/models/ScimConfig.ts`

The `provisioning_token` comment says "encrypted" but there's no encryption happening — it's stored as plain text. Since this token grants full SCIM access (create/delete users), it should be hashed (like a password) or encrypted at rest.

---

## Missing Pieces

### 15. No SDK Types for SCIM

`nocodb-sdk` has no SCIM-related type definitions. Following the project convention, SCIM types (ScimConfig, ScimUser, ScimGroup interfaces) should be defined in the SDK and imported by both backend and frontend.

### 16. No SCIM Event/Audit Logging

SCIM operations (user provisioning, deprovisioning, group changes) are security-sensitive and should be logged. Consider emitting audit events for:
- User created/deactivated/reactivated via SCIM
- Group created/deleted/membership changed via SCIM
- SCIM config enabled/disabled
- Token regenerated
- Failed authentication attempts

### 17. No Rate Limiting on SCIM Endpoints

The SCIM User/Group/Schema endpoints use `ScimAuthGuard` but have no `MetaApiLimiterGuard`. IdPs like Okta can send rapid bursts during initial sync. Consider adding rate limiting specific to SCIM.

### 18. No PATCH Operations Support for Users

SCIM PATCH (RFC 7644 §3.5.2) uses an `Operations` array format:
```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [{ "op": "replace", "path": "active", "value": false }]
}
```

The Groups service handles `Operations` (line 218), but the Users service doesn't — it only handles flat attribute replacement. Azure AD specifically uses this format for user deactivation.

### 19. No Cleanup on SCIM Config Deletion

When `deleteConfig()` is called, the SCIM configuration is removed, but SCIM-managed users and groups remain with `scim_managed: true` and `scim_external_id` populated. Consider either cleaning these up or documenting this as expected behavior.

### 20. No Integration Tests

There are no test files for SCIM. This feature touches auth, user management, group management, and database migrations — all areas where integration tests are essential.

---

## Testing Strategy

### Phase 1: Unit Tests (Backend Services)

Create test files in a `tests/` directory alongside the services.

**ScimConfigService tests:**
- `initializeConfig` — creates config, generates token, sets disabled
- `initializeConfig` — throws if already configured
- `getConfig` — masks token in response
- `validateToken` — returns true for valid token
- `validateToken` — returns false when disabled
- `validateToken` — returns false for wrong token
- `regenerateToken` — old token no longer valid
- `deleteConfig` — config no longer accessible

**ScimUsersService tests:**
- `createUser` — creates User + WorkspaceUser with SCIM fields
- `createUser` — existing user gets added to workspace
- `createUser` — duplicate in workspace throws error
- `createUser` — email extraction (primary, fallback to first)
- `getUser` — returns SCIM-formatted user
- `getUser` — returns 404 for deleted user
- `listUsers` — filters to scim_managed only
- `listUsers` — applies userName eq filter
- `listUsers` — applies externalId eq filter
- `listUsers` — pagination works correctly (startIndex, count)
- `replaceUser` — full replacement updates all fields
- `patchUser` — partial update preserves other fields
- `deactivateUser` — soft deletes (deleted=true)
- Reactivation — setting active=true restores user (after bug #6 is fixed)

**ScimGroupsService tests:**
- `createGroup` — creates team with SCIM fields
- `createGroup` — converts existing non-SCIM team to SCIM-managed
- `createGroup` — duplicate SCIM team throws error
- `getGroup` — returns SCIM-formatted group with members
- `listGroups` — filters to scim_managed only
- `updateGroup` — updates displayName
- `updateGroup` — handles PATCH Operations (add/remove members)
- `deleteGroup` — soft deletes
- Member management — add, remove, sync operations

### Phase 2: Authentication & Authorization Tests

**ScimAuthGuard tests:**
- Valid bearer token passes
- Invalid token returns 401
- Missing token returns 401
- Token for disabled SCIM config returns 401
- Token from workspace A rejected on workspace B

**ScimConfigController ACL tests (after bug #3 is fixed):**
- Workspace owner can access all config endpoints
- Workspace viewer/editor/commenter cannot access config endpoints
- Non-workspace-member gets 403

### Phase 3: API Integration Tests (Curl-based)

Here's a complete manual test script. Run it against a local dev instance:

```bash
#!/bin/bash
# SCIM Integration Test Script
# Prerequisites: Running NocoDB EE instance, workspace created, owner auth token

BASE_URL="http://localhost:8080"
WORKSPACE_ID="your_workspace_id"
OWNER_TOKEN="your_xc_auth_token"

echo "=== Phase 3a: Config Management ==="

# 1. Initialize SCIM
echo "--- Initialize SCIM ---"
INIT_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/config" \
  -H "Content-Type: application/json" \
  -H "xc-auth: $OWNER_TOKEN" \
  -d '{"siteUrl":"http://localhost:8080"}')
echo "$INIT_RESPONSE" | jq .
SCIM_TOKEN=$(echo "$INIT_RESPONSE" | jq -r '.provisioning_token')

# 2. Get config (token should be masked)
echo "--- Get Config ---"
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/config" \
  -H "xc-auth: $OWNER_TOKEN" | jq .

# 3. Enable SCIM
echo "--- Enable SCIM ---"
curl -s -X PATCH \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/config" \
  -H "Content-Type: application/json" \
  -H "xc-auth: $OWNER_TOKEN" \
  -d '{"enabled":true}' | jq .

echo "=== Phase 3b: Service Provider Discovery ==="

# 4. ServiceProviderConfig
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/ServiceProviderConfig" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 5. Schemas
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Schemas" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

echo "=== Phase 3c: User Provisioning ==="

# 6. Create user
echo "--- Create User ---"
CREATE_USER=$(curl -s -X POST \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" \
  -H "Content-Type: application/scim+json" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],
    "externalId":"ext-user-001",
    "userName":"john.doe@example.com",
    "name":{"givenName":"John","familyName":"Doe","formatted":"John Doe"},
    "displayName":"John Doe",
    "emails":[{"value":"john.doe@example.com","type":"work","primary":true}],
    "active":true
  }')
echo "$CREATE_USER" | jq .
USER_ID=$(echo "$CREATE_USER" | jq -r '.id')

# 7. Get user
echo "--- Get User ---"
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users/$USER_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 8. List users
echo "--- List Users ---"
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 9. Filter users
echo "--- Filter Users ---"
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users?filter=userName%20eq%20%22john.doe%40example.com%22" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 10. Update user (PUT)
echo "--- Replace User ---"
curl -s -X PUT \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users/$USER_ID" \
  -H "Content-Type: application/scim+json" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName":"john.doe@example.com",
    "name":{"givenName":"Jonathan","familyName":"Doe"},
    "displayName":"Jonathan Doe",
    "emails":[{"value":"john.doe@example.com","type":"work","primary":true}],
    "active":true
  }' | jq .

# 11. Deactivate user (DELETE)
echo "--- Deactivate User ---"
curl -s -X DELETE \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users/$USER_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 12. Verify deactivated (should 404)
echo "--- Verify Deactivated ---"
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users/$USER_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

echo "=== Phase 3d: Group Provisioning ==="

# 13. Create group
echo "--- Create Group ---"
CREATE_GROUP=$(curl -s -X POST \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Groups" \
  -H "Content-Type: application/scim+json" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:Group"],
    "externalId":"ext-group-001",
    "displayName":"Engineering Team"
  }')
echo "$CREATE_GROUP" | jq .
GROUP_ID=$(echo "$CREATE_GROUP" | jq -r '.id')

# 14. PATCH group — add members
echo "--- Add Members to Group ---"
curl -s -X PATCH \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Groups/$GROUP_ID" \
  -H "Content-Type: application/scim+json" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -d "{
    \"schemas\":[\"urn:ietf:params:scim:api:messages:2.0:PatchOp\"],
    \"Operations\":[{\"op\":\"add\",\"path\":\"members\",\"value\":[{\"value\":\"$USER_ID\"}]}]
  }" | jq .

# 15. Get group (should include members)
echo "--- Get Group ---"
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Groups/$GROUP_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 16. Delete group
echo "--- Delete Group ---"
curl -s -X DELETE \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Groups/$GROUP_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

echo "=== Phase 3e: Error Cases ==="

# 17. Invalid token
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" \
  -H "Authorization: Bearer invalid_token" | jq .

# 18. No token
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" | jq .

# 19. Non-existent user
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users/nonexistent" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 20. Create duplicate user
curl -s -X POST \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" \
  -H "Content-Type: application/scim+json" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  -d '{
    "schemas":["urn:ietf:params:scim:schemas:core:2.0:User"],
    "externalId":"ext-user-001",
    "userName":"john.doe@example.com",
    "emails":[{"value":"john.doe@example.com","primary":true}],
    "active":true
  }' | jq .

echo "=== Phase 3f: Token Management ==="

# 21. Regenerate token
REGEN=$(curl -s -X POST \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/config/token/regenerate" \
  -H "xc-auth: $OWNER_TOKEN")
echo "$REGEN" | jq .
NEW_TOKEN=$(echo "$REGEN" | jq -r '.provisioning_token')

# 22. Old token should fail
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" \
  -H "Authorization: Bearer $SCIM_TOKEN" | jq .

# 23. New token should work
curl -s "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/v2/Users" \
  -H "Authorization: Bearer $NEW_TOKEN" | jq .

echo "=== Phase 3g: Cleanup ==="

# 24. Delete SCIM config
curl -s -X DELETE \
  "$BASE_URL/api/v3/meta/workspaces/$WORKSPACE_ID/scim/config" \
  -H "xc-auth: $OWNER_TOKEN" | jq .

echo "=== DONE ==="
```

### Phase 4: IdP Integration Tests

**Okta:**
1. Configure SCIM provisioning in Okta Admin → Applications → Add App → SCIM 2.0
2. Set Connector URL to: `{your_base_url}/api/v3/meta/workspaces/{workspace_id}/scim/v2`
3. Set Auth Mode: HTTP Header → Bearer Token
4. Test Connection
5. Assign users → verify they appear in NocoDB workspace
6. Push groups → verify teams created
7. Deactivate user in Okta → verify soft-deleted in NocoDB
8. Re-assign user → verify reactivation (requires bug #6 fix)

**Azure AD:**
1. Enterprise Applications → New → Non-gallery → Provisioning → Automatic
2. Tenant URL: `{base_url}/api/v3/meta/workspaces/{workspace_id}/scim/v2`
3. Secret Token: SCIM bearer token
4. Test Connection
5. Azure AD specifically uses PATCH with Operations for deactivation (requires fix #18)

**OneLogin:**
1. Applications → Add App → SCIM Provisioner with SAML (SCIM v2 Enterprise)
2. Configuration → SCIM Base URL, SCIM Bearer Token
3. Test via Users → provisioning tab

### Phase 5: Frontend Tests

- Workspace SSO page loads without error
- "Enable SCIM" button creates config
- Endpoint URL displays correctly
- Token shows/hides correctly
- Copy buttons work for URL and token
- Toggle enable/disable works
- Regenerate token shows new token, old one no longer valid
- Delete confirmation modal appears
- Delete removes all SCIM UI elements
- Non-owner workspace members cannot see SCIM section

---

## Priority Summary

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Bearer strategy can't access workspaceId | Critical / Showstopper | Small |
| 2 | TenantContext undefined for SCIM endpoints | Critical / Showstopper | Small |
| 3 | Backend ACL missing for SCIM config | Critical / Showstopper | Small |
| 4 | Timing-unsafe token comparison | High / Security | Small |
| 5 | scim_meta never parsed from JSON | High / Data corruption | Small |
| 6 | Cannot reactivate soft-deleted users | High / Functional | Medium |
| 7 | Non-compliant SCIM error format | Medium / Compatibility | Medium |
| 8 | Missing Content-Type header | Low / Compatibility | Small |
| 9 | No unique constraint on workspace_user scim_external_id | Medium / Data integrity | Small |
| 10 | In-memory filtering won't scale | Low / Performance | Large |
| 11 | O(n) user lookup per request | Medium / Performance | Medium |
| 12 | Frontend ACL missing | Low / UI | Small |
| 13 | addTeamMembers no duplicate check | Medium / Data integrity | Small |
| 14 | Token stored in plaintext | Medium / Security | Medium |
| 15 | No SDK types | Low / Convention | Medium |
| 16 | No audit logging | Medium / Compliance | Medium |
| 17 | No rate limiting on SCIM endpoints | Low / Security | Small |
| 18 | No PATCH Operations for users | High / Azure AD compat | Medium |
| 19 | No cleanup on config deletion | Low / UX | Small |
| 20 | No integration tests | High / Quality | Large |

Fix bugs 1-3 first — without these, SCIM won't function at all.

---

## PRD Gap Analysis

After cross-referencing the implementation against the PRD, here are the features specified in the PRD that are **not yet implemented**:

### P0 — SSO Prerequisite Not Enforced

**PRD says:** "Configuring SSO is a pre-requisite for enabling SCIM."

**Current state:** SCIM can be enabled independently of SSO. Neither the backend (`scim-config.service.ts initializeConfig`) nor the frontend (`Sso.vue`) checks whether an SSO provider is configured before allowing SCIM initialization. The SCIM section in the UI is always rendered regardless of SSO state.

**Fix needed:**
- Backend: `initializeConfig` should verify at least one SSO client exists for the workspace
- Frontend: SCIM section should be hidden or disabled until SSO is configured, with a message like "Configure SSO first to enable SCIM provisioning"

---

### P0 — SCIM Users Not Read-Only in NocoDB UI/API

**PRD says:** "Users provisioned via SCIM are managed exclusively from your IdP. Their details cannot be edited directly within NocoDB." Read-only fields: email, name, surname. Synced users should be "marked out with an icon."

**Current state:** There is **zero enforcement** of read-only status for SCIM-managed users:
- The workspace member list UI has no awareness of `scim_managed` at all (no icon, no read-only state)
- The existing workspace-users controller and service (`workspace-users.controller.ts`, `workspace-users.service.ts`) have no `scim_managed` checks — a workspace admin can freely edit email, role, or remove a SCIM user through the normal NocoDB UI
- No sync icon/badge exists in the frontend for SCIM users or groups
- The `scim_managed` flag is only used within the SCIM services themselves (to filter lists), not as a guard in the normal user management flows

**Fix needed:**
- Backend: Add `scim_managed` guard in workspace-user update/delete endpoints — reject edits to email/name for SCIM users, allow role changes
- Frontend: Show sync icon on SCIM-managed users in member list; disable name/email editing for these users; add tooltip explaining "This user is managed via SCIM"
- Same treatment for SCIM-managed groups in the teams UI

---

### P0 — Deactivation Should Set "No Access" (Not Just Soft Delete)

**PRD says:** "Deactivates user in NocoDB via SCIM API. In NocoDB, these users should be marked as No Access at Workspace level & individual permissions (if any) at base level needs to be changed to No Access."

**Current state:** `scim-users.service.ts deactivateUser()` only calls `WorkspaceUser.softDelete()` which sets `deleted=true`. It does NOT:
- Set the workspace role to "No Access"
- Revoke base-level permissions
- Remove the user from teams
- Handle orphan bases (like the existing `workspace-users.service.ts` does at line 447)

Compare with the existing `workspace-users.service.ts` delete flow (lines 355-447) which properly:
1. Removes base-level access for all workspace bases
2. Removes user from all teams
3. Soft-deletes the workspace user
4. Handles orphan bases

**Fix needed:** The SCIM `deactivateUser` should either call the existing workspace-users service delete logic or replicate the same steps (base access removal, team removal, orphan base handling).

---

### P0 — Last Owner/Base Owner Deactivation Handling

**PRD says:** "How to handle last Base owner case? How to handle deactivation request for Workspace owner? → Handle without throwing error."

**Current state:** The existing `workspace-users.service.ts` throws errors for last-owner scenarios (line 326: "At least one owner should be there"). The SCIM `deactivateUser` bypasses this entirely since it doesn't go through the normal delete flow. This means SCIM could accidentally deactivate the last workspace owner, leaving an ownerless workspace.

**Fix needed:** Add owner-count checks in SCIM deactivation. Per PRD, handle gracefully (skip deactivation or log warning) rather than throwing.

---

### P1 — Disable SCIM Should Clean Up

**PRD says:** When SCIM is disabled: "SCIM requests coming from your IdP will be rejected... Any team that was linked to a Group will be unlinked... All SCIM restrictions will stop being enforced."

**Current state:**
- `disableScim()` only sets `enabled: false` — doesn't unlink teams or clear SCIM restrictions
- `deleteConfig()` only removes the `nc_scim_config` row — doesn't touch users/groups
- SCIM-managed users/groups keep their `scim_managed=true` flag forever, even after SCIM is disabled

**Fix needed:**
- When disabling: Reset `scim_managed` to `false` on all workspace users and teams. This removes the read-only restrictions per PRD.
- When deleting: Same cleanup + remove `scim_external_id`, `scim_user_name`, `scim_meta` fields

---

### P1 — Group Deletion Should Remove Members

**PRD says (referencing Linear):** "Opting to delete the group will remove all members from the team and convert the team to private."

**Current state:** `scim-groups.service.ts deleteGroup()` only calls `Team.softDelete()`. It does NOT remove member assignments from the `PrincipalAssignment` table. The team members remain associated with a deleted team.

**Fix needed:** Before soft-deleting, iterate through `PrincipalAssignment` for the team and remove all member associations.

---

### P1 — Initial Sync Matching Logic

**PRD says:** On first SCIM sync activation:
- Existing NocoDB users matched by email → marked as externally synced
- Existing groups matched by name → taken over as externally synced
- Existing assigned users in matched groups will be wiped out → SCIM-specified users mapped to the group

**Current state:** The `createUser` partially handles this (checks if user exists by email, checks if workspace user exists). The `createGroup` partially handles this (finds team by name, converts to SCIM-managed). However, the group matching logic does NOT wipe existing non-SCIM members when taking over a group — it only adds SCIM members.

**Fix needed:** When `createGroup` converts an existing team to SCIM-managed, it should remove all existing non-SCIM member assignments before adding SCIM members.

---

### P2 — Role Provisioning via Groups

**PRD says (referencing Linear):** IdP admin can create dedicated groups like "nocodb-admin" / "nocodb-viewer" to assign roles. The `role_mapping` field exists in the schema but is never used.

**Current state:** All SCIM users are hardcoded to `WorkspaceUserRoles.VIEWER` (line 155 of scim-users.service.ts). The `role_mapping` config field is stored but never consulted during user/group creation.

**Fix needed (future):** When creating a user or processing group membership, check the SCIM config's `role_mapping` to determine appropriate workspace role based on group membership.

---

### P2 — Email Change Handling

**PRD notes:** "Change Email ID from IdP — To discuss on how to handle."

**Current state:** Not implemented. The `updateUser` method updates `scim_user_name` and `scim_meta` but does NOT update the user's actual email in the `nc_users` table. If an IdP changes a user's email, NocoDB will have stale data.

---

### P2 — CSV Download of User Data with SCIM Metadata

**PRD says (referencing Airtable):** "Supports user information (including the SCIM data) to be downloaded as CSV" — including External ID, Title, Cost Center, Department, Division, Organization, Manager name, Manager ID.

**Current state:** No CSV export endpoint exists for workspace users, let alone one that includes SCIM metadata.

---

### P3 — Nested Groups

**PRD says:** "Nested groups will not be supported in NocoDB."

**Current state:** No explicit validation that prevents nested group creation via SCIM. If an IdP sends nested group structures, it may behave unpredictably.

---

### Summary: PRD Gaps Priority

| PRD Requirement | Priority | Status |
|-----------------|----------|--------|
| SSO prerequisite for SCIM | P0 | Not enforced |
| SCIM users/groups read-only in UI + sync icon | P0 | Not implemented |
| Deactivation → No Access + base cleanup | P0 | Only soft-deletes |
| Last owner deactivation handling | P0 | Not handled |
| Disable SCIM cleanup (unlink teams, remove restrictions) | P1 | Not implemented |
| Group deletion removes members | P1 | Not implemented |
| Initial sync matching (wipe existing group members) | P1 | Partial |
| Role provisioning via groups (role_mapping) | P2 | Schema only, not functional |
| Email change from IdP | P2 | Not handled |
| CSV export with SCIM metadata | P2 | Not implemented |
| Nested group prevention | P3 | Not validated |
