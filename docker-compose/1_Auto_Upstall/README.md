# NocoDB Auto-Upstall

Interactive installer for NocoDB on a Linux server. Auto-installs Docker if missing, asks three or four questions, and generates a working docker-compose stack with optional Traefik plus Let's Encrypt SSL.

## Run it

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh)
```

Or, if you've cloned the repo:

```bash
cd nocodb/docker-compose && ./setup.sh
```

## Quick install

No questions asked, bundled Postgres and Redis, local port 8080:

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh) --quick
```

With HTTPS on your own domain:

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh) --quick \
  --domain=nocodb.example.com --acme-email=ops@example.com
```

## What it asks

| Prompt | Default | Notes |
|---|---|---|
| Domain | detected public IP | Blank or `localhost` selects local mode (port 8080, no SSL). A valid hostname selects production mode (Traefik + Let's Encrypt). An IP selects production-ip mode (port 80, no SSL). |
| Postgres | Bundled | Choose Bundled or Existing. If existing, asks host, port, database, user, password, and SSL mode. |
| Redis | Bundled | Choose Bundled or Existing (URL). |
| Let's Encrypt email | — | Asked only in production mode. |

## What it generates

```
./nocodb/
├── docker-compose.yml      # nocodb + worker + (bundled db/redis) + (optional traefik)
├── docker.env              # NC_DB_JSON_FILE, NC_REDIS_URL, NC_SECURE_ATTACHMENTS, ...
├── nocodb/db.json          # knex-format DB connection, supports custom CA inline
├── update.sh               # docker compose pull && up -d && image prune
└── .gitignore              # excludes secrets and runtime data
```

Postgres, Redis, and NocoDB application data live in Docker-managed named volumes (`nocodb_data`, `postgres_data`, `redis_data`), not in this directory. The generated `nocodb/db.json` is bind-mounted into the container on top of the `nocodb_data` volume so config and data stay separate.

The script chmods `docker.env` and `nocodb/db.json` to `600`. It detects SELinux Enforcing on RHEL-family hosts and applies the `:Z` suffix to bind mounts. A healthcheck on `GET /api/v1/health` is wired into the nocodb service so the worker waits for it to become healthy.

## Non-interactive mode

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh) \
  --non-interactive \
  --domain=nocodb.example.com \
  --acme-email=ops@example.com \
  --pg=bundled --redis=bundled
```

Run `bash noco.sh --help` for the full flag list. Missing required flags fail fast instead of hanging on a prompt. `--non-interactive` is implied by `--domain=`.

## Pin the image tag

The generated compose uses `nocodb/nocodb:latest`. For production, pin a tag:

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh) --image-tag=0.264.6 ...
```

You can also edit `docker-compose.yml` after the install.
