# Docker Compose examples

Pre-built configurations for common deployment scenarios. Copy an example as your starting point instead of running the setup wizard (`./setup.sh`) — useful when you want fine-grained control or have specific infrastructure constraints.

> **Important:** Replace all placeholder values (`CHANGE_ME_db_password`, `your-managed-db-host`, etc.) before starting. The `quickstart-demo` ships a deterministic demo password (`quickstart_demo_pw_change_me`) so it works out of the box — replace it before any real use.

## Examples

| Example | PostgreSQL | Redis | Proxy | Best for |
|---------|-----------|-------|-------|----------|
| [quickstart-demo](quickstart-demo/) | Bundled | Bundled | None (port 8080) | Local eval / "show me NocoDB" |
| [managed-postgres](managed-postgres/) | External managed (RDS/Azure/Cloud SQL) | External | None (port 8080) | Production behind your own LB |
| [external-postgres-and-redis](external-postgres-and-redis/) | External self-managed | External | None (port 8080) | Minimal Docker footprint |
| [traefik-custom-ssl](traefik-custom-ssl/) | External managed | External | Traefik + custom TLS cert | Production with your own SSL cert |
| [postgres-private-ca](postgres-private-ca/) | External (private CA) | External | Traefik + Let's Encrypt | On-prem / private cloud DB |

## Quick start

```bash
cp -r docker-compose/examples/quickstart-demo ./my-deployment
cd my-deployment
docker compose up -d
```

For the production-shaped examples (`managed-postgres` and friends), edit `docker-compose.yml`, `docker.env`, and `nocodb/db.json` to replace placeholder values before running `docker compose up -d`.

Alternatively, run `./setup.sh` (one directory up) for an interactive wizard that generates the right configuration based on your answers.

## Activating a license

After your stack is running, open NocoDB, sign up as the first user, then activate a license at **Admin Panel → License**. PostgreSQL is required for license activation; every example here satisfies that.

## Where did the old templates go?

The legacy `2_pg/`, `3_traefik/`, `nginx/`, `nginx-proxy-manager/`, `letsencrypt/`, and `traefik/` directories were removed in favor of these examples. Mapping:

| Old path | New path |
|---|---|
| `docker-compose/2_pg/` | `examples/quickstart-demo/` |
| `docker-compose/3_traefik/` | `examples/traefik-custom-ssl/` (similar shape with custom cert) |
| `docker-compose/nginx/`, `docker-compose/nginx-proxy-manager/` | Bring your own proxy — see `examples/managed-postgres/` (port 8080) and put nginx in front |
| `docker-compose/traefik/`, `docker-compose/letsencrypt/` | `examples/traefik-custom-ssl/` or run `./setup.sh` for Traefik + Let's Encrypt |
