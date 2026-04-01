# SCIM Provisioning — Local Setup & Test (API)

Test SCIM v2.0 provisioning between Keycloak and NocoDB locally.

## Prerequisites

- Docker
- PostgreSQL accessible from Docker (or use the `nc-pg-test` container)

## 1. Start NocoDB

```bash
# Create DB (if using local pg container)
docker exec nc-pg-test psql -U postgres -c "CREATE DATABASE scim_test;"

# Start NocoDB with license
docker run -d --name nocodb-scim \
  -p 8080:8080 \
  -e "NC_LICENSE_KEY=<your-license-key>" \
  -e "NC_DB=pg://host.docker.internal:5432?d=scim_test&u=postgres&p=password" \
  --add-host=host.docker.internal:host-gateway \
  nocodb/nocodb:latest
```

Wait for startup:
```bash
until curl -s http://localhost:8080/api/v1/health | grep -q OK; do sleep 2; done
echo "NocoDB ready"
```

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

## 3. Sign In & Enable SCIM

```bash
NC_TOKEN=$(curl -s -X POST "http://localhost:8080/api/v1/auth/user/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Password123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

WS_ID=$(curl -s "http://localhost:8080/api/v1/workspaces/" \
  -H "xc-auth: $NC_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['list'][0]['id'])")

SCIM_TOKEN=$(curl -s -X POST "http://localhost:8080/api/v3/meta/workspaces/$WS_ID/scim/config" \
  -H "xc-auth: $NC_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['provisioning_token'])")

echo "SCIM_TOKEN=$SCIM_TOKEN"

curl -s -X PATCH "http://localhost:8080/api/v3/meta/workspaces/$WS_ID/scim/config" \
  -H "xc-auth: $NC_TOKEN" -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

## 4. Configure Keycloak

```bash
KC_TOKEN=$(curl -s -X POST "http://localhost:8180/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&grant_type=password&client_id=admin-cli" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Enable SCIM event listener
curl -s -X PUT "http://localhost:8180/admin/realms/master/events/config" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
  -d '{"eventsEnabled":true,"eventsListeners":["jboss-logging","scim"],"adminEventsEnabled":true,"adminEventsDetailsEnabled":true}'

# Get realm ID
REALM_ID=$(curl -s "http://localhost:8180/admin/realms/master" \
  -H "Authorization: Bearer $KC_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Create SCIM federation provider
SCIM_ENDPOINT="http://host.docker.internal:8080/api/v3/meta/workspaces/$WS_ID/scim/v2"

curl -s -X POST "http://localhost:8180/admin/realms/master/components" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
  -d "{
    \"name\": \"nocodb-scim\",
    \"providerId\": \"scim\",
    \"providerType\": \"org.keycloak.storage.UserStorageProvider\",
    \"parentId\": \"$REALM_ID\",
    \"config\": {
      \"endpoint\": [\"$SCIM_ENDPOINT\"],
      \"content-type\": [\"application/scim+json\"],
      \"auth-mode\": [\"BEARER\"],
      \"auth-pass\": [\"$SCIM_TOKEN\"],
      \"propagation-user\": [\"true\"],
      \"propagation-group\": [\"true\"],
      \"sync-import\": [\"false\"],
      \"sync-refresh\": [\"false\"],
      \"enabled\": [\"true\"],
      \"priority\": [\"0\"]
    }
  }"
```

> **Note:** Keycloak admin tokens expire quickly (~60s). If you get `401`, re-run the `KC_TOKEN=...` command.

## 5. Test Provisioning

### Create user

```bash
curl -s -X POST "http://localhost:8180/admin/realms/master/users" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","firstName":"Alice","lastName":"Smith","enabled":true,"emailVerified":true}'
```

### Create group

```bash
curl -s -X POST "http://localhost:8180/admin/realms/master/groups" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Engineering"}'
```

### Verify in NocoDB

```bash
BASE="http://localhost:8080/api/v3/meta/workspaces/$WS_ID/scim/v2"

# Users
curl -s "$BASE/Users" -H "Authorization: Bearer $SCIM_TOKEN" \
  | python3 -c "import sys,json; [print(f'  {r[\"userName\"]} (active={r[\"active\"]})') for r in json.load(sys.stdin).get('Resources',[])]"

# Groups
curl -s "$BASE/Groups" -H "Authorization: Bearer $SCIM_TOKEN" \
  | python3 -c "import sys,json; [print(f'  {r[\"displayName\"]} ({len(r.get(\"members\",[]))} members)') for r in json.load(sys.stdin).get('Resources',[])]"
```

### Delete user

```bash
USER_ID=$(curl -s "http://localhost:8180/admin/realms/master/users?username=alice&exact=true" \
  -H "Authorization: Bearer $KC_TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

curl -s -X DELETE "http://localhost:8180/admin/realms/master/users/$USER_ID" \
  -H "Authorization: Bearer $KC_TOKEN"
```

### Delete group

```bash
GROUP_ID=$(curl -s "http://localhost:8180/admin/realms/master/groups" \
  -H "Authorization: Bearer $KC_TOKEN" \
  | python3 -c "import sys,json; [print(g['id']) for g in json.load(sys.stdin) if g['name']=='Engineering']")

curl -s -X DELETE "http://localhost:8180/admin/realms/master/groups/$GROUP_ID" \
  -H "Authorization: Bearer $KC_TOKEN"
```

### Set workspace role

> **Note:** The `keycloak-scim` plugin only maps standard SCIM core fields (userName, name, emails, active). It does **not** forward Keycloak user attributes to custom SCIM extension schemas. Role assignment must be done via a direct SCIM PATCH call — it cannot be triggered from the Keycloak UI.

```bash
SCIM_USER_ID=$(curl -s "$BASE/Users?filter=userName%20eq%20%22alice%22" \
  -H "Authorization: Bearer $SCIM_TOKEN" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['Resources'][0]['id'])")

curl -s -X PATCH "$BASE/Users/$SCIM_USER_ID" \
  -H "Authorization: Bearer $SCIM_TOKEN" -H "Content-Type: application/scim+json" \
  -d '{"schemas":["urn:ietf:params:scim:api:messages:2.0:PatchOp"],"Operations":[{"op":"replace","path":"urn:ietf:params:scim:schemas:extension:nocodb:2.0:User:workspaceRole","value":"editor"}]}'

curl -s "$BASE/Users/$SCIM_USER_ID" \
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
| Users not syncing | Check Keycloak → Realm Settings → Events → `scim` is in Event Listeners |
| `401` on Keycloak API | KC admin tokens expire fast — re-run the `KC_TOKEN=...` command |
| Connection refused | Both containers use `host.docker.internal` — verify with `docker exec <container> curl http://host.docker.internal:8080/api/v1/health` |
| Lost SCIM token | `curl -X POST ".../scim/config/token/regenerate" -H "xc-auth: $NC_TOKEN"` then update Keycloak federation `auth-pass` |
| SCIM plugin not loaded | Check `docker compose logs keycloak` for `scim ... is implementing the internal SPI eventsListener` |

## Known Issue: User Delete in keycloak-scim Plugin

The upstream [keycloak-scim](https://github.com/mitodl/keycloak-scim) plugin has a bug where user deletion from Keycloak fails to propagate to the SCIM service provider. [PR #40](https://github.com/mitodl/keycloak-scim/pull/40) added an `isEmailVerified()` check on DELETE events, but Keycloak removes the user from its DB *before* firing the admin event — so the user lookup returns `null` and throws a `NullPointerException`.

The Dockerfile above includes a patch that fixes this by skipping the user lookup on DELETE events (the userId from the event is sufficient). If you use the pre-built JAR from GitHub releases instead, user deletion from Keycloak will silently fail.

**References:**
- PR that introduced the bug: [mitodl/keycloak-scim#40](https://github.com/mitodl/keycloak-scim/pull/40)
- Keycloak platform behavior (user is null on delete): [keycloak/keycloak#24433](https://github.com/keycloak/keycloak/discussions/24433)
