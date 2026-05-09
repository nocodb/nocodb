# NocoDB Auto-Upstall

Interactive installer for NocoDB on a Linux server. Auto-installs Docker if missing, asks 3–4 questions, generates a working docker-compose stack with optional Traefik + Let's Encrypt SSL.

## Use it

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh)
```

Or, if you've cloned the repo:

```bash
cd nocodb/docker-compose && ./setup.sh
```

## What it asks

| Prompt | Default | Notes |
|---|---|---|
| Domain | detected public IP | Blank or `localhost` → local mode (port 8080, no SSL). Valid hostname → production mode (Traefik + Let's Encrypt). IP → production-ip mode (port 80, no SSL). |
| Postgres | Bundled | "Bundled" or "Existing". If existing, asks host/port/db/user/password + SSL choice. |
| Redis | Bundled | "Bundled" or "Existing" (URL). |
| Let's Encrypt email | — | Only asked in production mode with a valid domain. |

## What it generates

```
./nocodb/
├── docker-compose.yml
├── docker.env
├── nocodb/db.json
└── update.sh
```

## Non-interactive mode

```bash
bash <(curl -sSL https://install.nocodb.com/noco.sh) \
  --domain=nocodb.example.com \
  --acme-email=ops@example.com \
  --pg=bundled --redis=bundled
```

Run `bash noco.sh --help` for the full flag list. In non-interactive mode, missing required flags produce a clear error rather than hanging on a prompt.

## What changed from earlier versions

- **Single image** — `nocodb/nocodb:latest` now contains both community and enterprise code. License is activated post-install via Admin Panel → License.
- **No more MinIO / Watchtower / SQLite / management menu** — see the design spec for rationale.
- **Postgres is required.** Existing or bundled.
