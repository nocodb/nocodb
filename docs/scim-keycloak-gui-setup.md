# SCIM Provisioning — GUI Setup Guide

Set up SCIM between Keycloak and NocoDB using only the browser.

## Prerequisites

- Docker
- PostgreSQL accessible from Docker (or use the `nc-pg-test` container)

## 1. Start NocoDB

```bash
# Create DB
docker exec nc-pg-test psql -U postgres -c "CREATE DATABASE scim_test;"

# Start NocoDB with license
docker run -d --name nocodb-scim \
  -p 8080:8080 \
  -e "NC_LICENSE_KEY=<your-license-key>" \
  -e "NC_DB=pg://host.docker.internal:5432?d=scim_test&u=postgres&p=password" \
  --add-host=host.docker.internal:host-gateway \
  nocodb/nocodb:latest
```

Open **http://localhost:8080** and sign up.

## 2. Start Keycloak with SCIM Plugin

Create a directory with these files:

**Dockerfile** — builds the [keycloak-scim](https://github.com/mitodl/keycloak-scim) plugin from source with a patch that fixes user deletion ([details](#known-issue-user-delete-in-keycloak-scim-plugin)):

```dockerfile
# Build patched keycloak-scim plugin
# Fixes NPE on user delete: https://github.com/mitodl/keycloak-scim/pull/40
FROM gradle:8.5-jdk17 AS plugin-builder

WORKDIR /build
RUN git clone https://github.com/mitodl/keycloak-scim.git .

# Patch: skip getUser()/isEmailVerified() on DELETE (user already gone from DB)
RUN sed -i '85,90c\            if (event.getOperationType() == OperationType.DELETE) {\n                dispatcher.run(ScimDispatcher.SCOPE_USER, client -> client.delete(UserAdapter.class, userId));\n            }' \
    src/main/java/sh/libre/scim/event/ScimEventListenerProvider.java

RUN gradle shadowJar --no-daemon

# Build Keycloak with patched plugin
FROM quay.io/keycloak/keycloak:26.0 AS builder

COPY --from=plugin-builder /build/build/libs/*-all.jar /opt/keycloak/providers/keycloak-scim.jar

RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.0

COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
```

**docker-compose.yml**
```yaml
services:
  keycloak:
    build:
      context: .
      dockerfile: Dockerfile
    command: start-dev
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      KC_HTTP_PORT: 8180
    ports:
      - "8180:8180"
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Then start:
```bash
docker compose up -d --build
# First build takes ~2-3 min (compiles plugin from source). Subsequent starts are instant.
# Verify at http://localhost:8180 (admin/admin)
```

## 3. Enable SCIM in NocoDB

1. Open **http://localhost:8080** → sign up or sign in
2. Go to workspace **Settings** → **SCIM Provisioning** (or **SSO** tab → SCIM section)
3. Click **Enable SCIM**
4. **Copy the SCIM Endpoint URL** and **Bearer Token** — you'll need them for Keycloak

> If the token is masked, click **Regenerate** to get a new one. Save it — it's shown only once.

## 4. Configure Keycloak

### 4a. Enable SCIM Event Listener

1. In Keycloak Admin Console → left sidebar → **Realm settings**
2. Click the **Events** tab
3. In **Event listeners**, add **`scim`** (type it and press Enter)
4. Click **Save**

### 4b. Create SCIM Federation Provider

1. Left sidebar → **User federation**
2. Click **Add provider** dropdown → select **scim**
3. Fill in:
   - **Name**: `nocodb-scim`
   - **SCIM Endpoint**: paste the URL from step 3 — replace `localhost` with `host.docker.internal` (so Docker can reach the host)
     - Example: `http://host.docker.internal:8080/api/v3/meta/workspaces/<WS_ID>/scim/v2`
   - **Content-Type**: `application/scim+json`
   - **Auth mode**: `BEARER`
   - **Auth pass**: paste the Bearer Token from step 3
   - **Propagation user**: `ON`
   - **Propagation group**: `ON`
   - **Sync refresh**: `ON` (required for "Sync all users" to push existing users to NocoDB)
4. Click **Save**

> To sync pre-existing Keycloak users to NocoDB: go to **User federation** → **nocodb-scim** → click **Sync all users**.

## 5. Test: Create a User

1. In Keycloak → left sidebar → **Users** → **Add user**
2. Fill in:
   - **Username**: `alice`
   - **Email**: `alice@example.com`
   - **First name**: `Alice`
   - **Last name**: `Smith`
   - **Email verified**: `ON`
3. Click **Create**
4. In NocoDB → **Members** tab → `alice@example.com` should appear with **"Managed via SCIM"** badge

## 6. Test: Create a Group

1. In Keycloak → left sidebar → **Groups** → **Create group**
2. Enter name: `Engineering` → **Create**
3. In NocoDB → **Teams** tab → `Engineering` should appear with **"Managed via SCIM"** badge

## 7. Test: Add User to Group

1. In Keycloak → **Users** → click `alice`
2. Go to the **Groups** tab → **Join group**
3. Select `Engineering` → **Join**
4. In NocoDB → **Teams** tab → click `Engineering` → Alice should be listed as a member

## 8. Test: Remove User

1. In Keycloak → **Users** → click the `⋮` menu next to `alice` → **Delete**
2. Confirm deletion
3. In NocoDB → **Members** tab → `alice@example.com` should be deactivated

## 9. Test: Remove Group

1. In Keycloak → **Groups** → click the `⋮` menu next to `Engineering` → **Delete**
2. Confirm deletion
3. In NocoDB → **Teams** tab → `Engineering` should be gone

## 10. Set Workspace Role

> **Note:** The `keycloak-scim` plugin only maps standard SCIM core fields (userName, name, emails, active). It does **not** forward Keycloak user attributes to custom SCIM extension schemas. Role assignment must be done via a direct SCIM PATCH call — it cannot be triggered from the Keycloak UI.

Copy the **SCIM Endpoint URL** and **Bearer Token** from NocoDB (SCIM Provisioning page), then run:

```bash
SCIM_BASE="<SCIM Endpoint URL from NocoDB>"
SCIM_TOKEN="<Bearer Token from NocoDB>"

# Find the user's SCIM ID
SCIM_USER_ID=$(curl -s "$SCIM_BASE/Users?filter=userName%20eq%20%22alice%22" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['Resources'][0]['id'])")

# Change role to editor
curl -s -X PATCH "$SCIM_BASE/Users/$SCIM_USER_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" -H "Content-Type: application/scim+json" \
  -d '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],"Operations":[{"op":"replace","path":"urn:ietf:params:scim:schemas:extension:nocodb:2.0:User:workspaceRole","value":"editor"}]}'

# Verify
curl -s "$SCIM_BASE/Users/$SCIM_USER_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('urn:ietf:params:scim:schemas:extension:nocodb:2.0:User',{}).get('workspaceRole'))"
```

Supported roles: `owner`, `creator`, `editor`, `commenter`, `viewer` (default), `no-access`.

## Cleanup

```bash
docker stop nocodb-scim && docker rm nocodb-scim
docker compose down -v
docker exec nc-pg-test psql -U postgres -c "DROP DATABASE scim_test;"
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Users not syncing | Keycloak → Realm settings → Events → check `scim` is in Event Listeners |
| Connection error in Keycloak logs | Use `host.docker.internal` instead of `localhost` in the SCIM endpoint |
| SCIM section not visible | Ensure SCIM is enabled in beta features and you have an EE license |
| Lost SCIM token | NocoDB → SCIM Provisioning → **Regenerate**, then update Keycloak federation `auth-pass` |

## Known Issue: User Delete in keycloak-scim Plugin

The upstream [keycloak-scim](https://github.com/mitodl/keycloak-scim) plugin has a bug where user deletion from Keycloak fails to propagate. [PR #40](https://github.com/mitodl/keycloak-scim/pull/40) added an `isEmailVerified()` check on DELETE events, but Keycloak removes the user from its DB *before* firing the admin event — so the user lookup returns `null` and throws a `NullPointerException`.

The Dockerfile above includes a patch that fixes this. If you use the pre-built JAR from GitHub releases instead, user deletion from Keycloak will silently fail.

**References:**
- PR that introduced the bug: [mitodl/keycloak-scim#40](https://github.com/mitodl/keycloak-scim/pull/40)
- Keycloak platform behavior: [keycloak/keycloak#24433](https://github.com/keycloak/keycloak/discussions/24433)
