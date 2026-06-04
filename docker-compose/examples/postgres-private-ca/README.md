# Postgres Private CA — External Database with Private CA Certificate + Traefik

For environments where the database uses a private or self-signed CA certificate (e.g., on-prem databases, private cloud).

- **PostgreSQL**: External database with custom CA certificate for SSL
- **Redis**: External
- **Proxy**: Traefik with automatic HTTPS via Let's Encrypt

## Usage

```bash
cp -r examples/postgres-private-ca ./my-deployment
cd my-deployment
# Edit docker.env — set NC_REDIS_URL
# Edit docker-compose.yml:
#   - Replace nocodb.example.com with your domain
#   - Replace admin@example.com with your email
# Edit nocodb/db.json:
#   - Set your database host, credentials, and port
#   - Replace the ca value with your CA certificate content
#     (newlines replaced with \n, all on one line)
docker compose up -d
```

## Preparing the CA certificate

The CA certificate must be embedded as a single-line string in `db.json` with `\n` for newlines. You can convert it with:

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-ca.pem
```

Then paste the output as the `ca` value in `db.json`.
