# Traefik Custom SSL: External Services + Your Own TLS Certificate

All backing services external. Traefik terminates TLS using your own certificate (corporate, wildcard, or otherwise).

- **PostgreSQL**: External managed database with SSL
- **Redis**: External (ElastiCache, Memorystore, Azure Cache)
- **Proxy**: Traefik with custom SSL certificate

## Usage

```bash
cp -r examples/traefik-custom-ssl ./my-deployment
cd my-deployment

# Place your TLS certificate and key
mkdir -p certs
cp /path/to/cert.pem certs/cert.pem
cp /path/to/key.pem certs/key.pem

# Edit docker.env: set NC_REDIS_URL
# Edit nocodb/db.json: set your database host and credentials
# Edit docker-compose.yml: replace nocodb.example.com with your domain
docker compose up -d
```

## Certificate files

Place your certificate chain and private key in the `certs/` directory:

| File | Content |
|------|---------|
| `certs/cert.pem` | Full certificate chain (server cert + intermediates) |
| `certs/key.pem` | Private key |

The `certs.yml` file tells Traefik where to find them. If you need multiple certificates (e.g., for additional domains), add entries to `certs.yml`:

```yaml
tls:
  certificates:
    - certFile: /etc/traefik/certs/cert.pem
      keyFile: /etc/traefik/certs/key.pem
    - certFile: /etc/traefik/certs/other-cert.pem
      keyFile: /etc/traefik/certs/other-key.pem
```

## Scaling

With external backing services, scale NocoDB horizontally:

```yaml
deploy:
  mode: replicated
  replicas: 3
```
