# External Postgres + External Redis: Minimal Docker footprint

Both databases run outside Docker. NocoDB and a single worker container are the only containers in this stack. Use this when you have a self-managed Postgres and Redis on dedicated hosts, or a Postgres-as-a-service that doesn't fit `managed-postgres`.

- **PostgreSQL**: External (any reachable host)
- **Redis**: External (any reachable host)
- **Proxy**: None. NocoDB on port 8080.

## Usage

```bash
cp -r docker-compose/examples/external-postgres-and-redis ./my-deployment
cd my-deployment
# Edit docker.env: set NC_REDIS_URL
# Edit nocodb/db.json: set host, credentials, and SSL choice
docker compose up -d
```

## SSL with a self-managed Postgres

If your external Postgres uses a publicly trusted CA, keep the default `ssl.rejectUnauthorized: true`. If it uses a self-signed or private CA, see the `postgres-private-ca` example instead.
