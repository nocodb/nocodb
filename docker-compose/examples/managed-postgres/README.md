# Managed Postgres — Managed DB with SSL + External Redis

Production-ready configuration using an external managed PostgreSQL database (e.g., AWS RDS, Azure Database, Google Cloud SQL) with SSL and external Redis (e.g., ElastiCache, Memorystore, Azure Cache).

- **PostgreSQL**: External managed database with public CA SSL
- **Redis**: External
- **Proxy**: None — NocoDB exposed on port 8080 (put behind your own LB/proxy)

## Usage

```bash
cp -r examples/managed-postgres ./my-deployment
cd my-deployment
# Edit docker.env — set NC_REDIS_URL
# Edit nocodb/db.json — set your database host, credentials, and port
docker compose up -d
```

The `ssl.rejectUnauthorized: true` setting in `db.json` works with managed databases that use publicly trusted CA certificates (RDS, Azure, Cloud SQL).

## Behind a load balancer

If you're running behind an ALB, Nginx, or other reverse proxy, forward traffic to port 8080. You can change the host-side port in `docker-compose.yml` if needed:

```yaml
ports:
  - '3000:8080'  # expose on port 3000 instead
```
