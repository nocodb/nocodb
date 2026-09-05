# Docker Deployment Quickstart Guide

This guide covers common Docker deployment patterns for NocoDB, including single-container and docker-compose setups with PostgreSQL.

---

## 1. Single Container (SQLite)

The fastest way to get NocoDB running:

```bash
docker run -d \
  --name nocodb \
  -p 8080:8080 \
  -v nocodb_data:/usr/app/data \
  -e NC_AUTH_JWT_SECRET="$(openssl rand -base64 32)" \
  --restart unless-stopped \
  nocodb/nocodb:latest
```

NocoDB will be available at `http://localhost:8080`.

---

## 2. Docker Compose with PostgreSQL

For production workloads, pair NocoDB with a dedicated PostgreSQL instance.

### docker-compose.yml

```yaml
version: "3.9"

services:
  nocodb:
    image: nocodb/nocodb:latest
    container_name: nocodb
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      NC_DB: "pg://db:5432?u=nocodb&p=nocodb_secret&d=nocodb"
      NC_AUTH_JWT_SECRET: "${NC_AUTH_JWT_SECRET:-change-me-in-production}"
      NC_PUBLIC_URL: "https://nocodb.example.com"
    volumes:
      - nocodb_data:/usr/app/data
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s

  db:
    image: postgres:16-alpine
    container_name: nocodb-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: nocodb
      POSTGRES_PASSWORD: nocodb_secret
      POSTGRES_DB: nocodb
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nocodb -d nocodb"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

volumes:
  nocodb_data:
  pg_data:
```

### Launch

```bash
# Set a strong JWT secret
export NC_AUTH_JWT_SECRET="$(openssl rand -base64 32)"

# Start all services
docker compose up -d

# View logs
docker compose logs -f nocodb
```

---

## 3. Key Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NC_DB` | Database connection string (pg/mysql/sqlite) | SQLite (embedded) |
| `NC_AUTH_JWT_SECRET` | JWT signing secret (**required** in production) | auto-generated |
| `NC_PUBLIC_URL` | Canonical URL for the instance | — |
| `NC_ADMIN_EMAIL` | Auto-create admin on first boot | — |
| `NC_ADMIN_PASSWORD` | Password for the auto-created admin | — |
| `PORT` | HTTP listen port inside the container | `8080` |
| `NC_DISABLE_TELEMETRY` | Disable anonymous usage analytics | `false` |

> **Security tip:** Always set `NC_AUTH_JWT_SECRET` to a strong, random value. If left at the default, sessions will not survive container restarts.

---

## 4. Health Checks

### Docker health check (single container)

```bash
# Liveness
curl -sf http://localhost:8080/api/v1/health | jq .

# Expected output:
# { "message": "OK" }
```

### Kubernetes-style probes

```bash
# Liveness
wget -qO- http://localhost:8080/api/v1/health

# Readiness – hit any API endpoint
curl -sf http://localhost:8080/api/v1/version
```

The `docker-compose.yml` above includes health checks for both `nocodb` and `db` services. Docker will report container health via:

```bash
docker inspect --format='{{.State.Health.Status}}' nocodb
```

---

## 5. Backup & Restore

### Backup PostgreSQL

```bash
docker exec nocodb-db pg_dump -U nocodb nocodb > backup_$(date +%F).sql
```

### Restore PostgreSQL

```bash
cat backup_2025-01-01.sql | docker exec -i nocodb-db psql -U nocodb -d nocodb
```

### Backup NocoDB data volume

```bash
docker run --rm -v nocodb_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/nocodb_data_$(date +%F).tar.gz -C /data .
```

---

## 6. Upgrading

```bash
# Pull the latest image
docker compose pull nocodb

# Recreate the container (data persists in volumes)
docker compose up -d nocodb

# Verify
docker compose ps
curl -sf http://localhost:8080/api/v1/version
```

---

## 7. Reverse Proxy (nginx example)

```nginx
server {
    listen 80;
    server_name nocodb.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nocodb.example.com;

    ssl_certificate     /etc/letsencrypt/live/nocodb.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nocodb.example.com/privkey.pem;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Remember to set `NC_PUBLIC_URL=https://nocodb.example.com` so NocoDB generates correct links.

---

## Troubleshooting

- **Container exits immediately** – Check logs with `docker logs nocodb`. Common causes: invalid `NC_DB` string, missing password.
- **Cannot connect to database** – Ensure the `db` container is healthy before NocoDB starts (`depends_on` with `condition: service_healthy`).
- **Lost sessions after restart** – Set a persistent `NC_AUTH_JWT_SECRET`.

---

For the full configuration reference, see the [official NocoDB documentation](https://nocodb.com/docs).
