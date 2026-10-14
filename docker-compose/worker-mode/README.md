# NocoDB Worker Mode example

This Docker Compose file shows how to run NocoDB with a dedicated worker container.

- **nocodb** — primary container: serves the HTTP API and UI, enqueues background jobs.
- **nocodb-worker** — worker container: processes background jobs from the Redis queue, does not serve HTTP traffic.

## Usage

1. Replace `your_db_password` and `your_redis_password` with secure values.
2. Start the stack:

```bash
docker compose up -d
```

3. Open NocoDB at:

http://localhost:8080

To run additional workers:

```bash
docker compose up --scale nocodb-worker=3 -d
```

See [Worker Mode documentation](../../markdown/worker-mode.md) for full details.
