# Quickstart Demo: Bundled Postgres + Redis, no proxy

The smallest production-shaped configuration. Bundled PostgreSQL, bundled Redis, NocoDB on port 8080. No reverse proxy, no SSL. Every value lives in `docker-compose.yml`, so `docker compose up -d` works out of the box.

- **PostgreSQL**: Bundled (data persisted to the `postgres_data` named volume)
- **Redis**: Bundled (data persisted to the `redis_data` named volume)
- **Proxy**: None. NocoDB on `http://localhost:8080`.

## Usage

```bash
cp -r docker-compose/examples/quickstart-demo ./my-deployment
cd my-deployment
docker compose up -d
```

> **Demo password.** This compose file uses a hardcoded password (`quickstart_demo_pw_change_me`) so the example works out of the box. Replace it everywhere it appears in `docker-compose.yml` (three places: the `db` service's `POSTGRES_PASSWORD`, and the `NC_DB` connection string in both the `nocodb` and `worker` services) before any real use.

## Activating an enterprise license

After NocoDB starts, open `http://localhost:8080`, sign up as the first user (you become super admin), then go to **Admin Panel → License** and paste your license key. Postgres is required for license activation; this example satisfies that requirement.
