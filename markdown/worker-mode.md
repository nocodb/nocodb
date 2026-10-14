# Worker Mode

Worker Mode lets you run background job processing in a separate container from the NocoDB API and UI. This keeps long-running tasks (imports, exports, webhooks, thumbnails, workflows, etc.) from competing with request handling in the same process.

## When to use Worker Mode

You may want Worker Mode if:

- Heavy background operations (CSV imports, bulk exports, Airtable sync) are slowing down the API.
- You want to process more background jobs in parallel by running multiple worker containers.
- You want to isolate job-processing from the API process.

Worker Mode requires Redis.

## How it works

NocoDB uses a Redis-backed job queue for background operations. In the default setup, the same container handles HTTP requests and background jobs.

With Worker Mode:

- Primary container handles HTTP requests and enqueues jobs
- Worker containers process jobs from Redis
- Workers do not serve HTTP traffic

Primary and workers must share the same database and Redis instance.

### Architecture overview

Browser / API → Primary → Redis Queue → Worker(s) → PostgreSQL

All worker containers must use the same `NC_DB` as the primary container.

## Deployment modes

| Mode | NC_WORKER_CONTAINER | Description |
|------|---------------------|-------------|
| Explicit primary | false | Primary does not process jobs, only delegates |
| Worker | true | Dedicated worker container |
| Auto-detect | unset | Primary auto-switches if workers exist |

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| NC_WORKER_CONTAINER | worker mode flag | unset |
| NC_REDIS_URL | Redis connection (cache + internal use) | — |
| NC_REDIS_JOB_URL | Redis job queue | fallback to NC_REDIS_URL |
| NC_CACHE_REDIS_URL | Redis cache | fallback to NC_REDIS_URL |
| NC_WORKER_CONCURRENCY | parallel jobs per worker | 10 |

## Docker Compose example

The stack below includes PostgreSQL, Redis, primary, and worker containers.

```yaml
version: "3"

services:

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: nocodb
      POSTGRES_USER: nocodb
      POSTGRES_PASSWORD: your_db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass your_redis_password
    volumes:
      - redis_data:/data

  nocodb:
    image: nocodb/nocodb:latest
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NC_DB: "pg://postgres:5432?u=nocodb&p=your_db_password&d=nocodb"
      NC_REDIS_URL: "redis://:your_redis_password@redis:6379/0"
      NC_REDIS_JOB_URL: "redis://:your_redis_password@redis:6379/1"
      NC_WORKER_CONTAINER: "false"
    ports:
      - "8080:8080"
    volumes:
      - nocodb_data:/usr/app/data

  nocodb-worker:
    image: nocodb/nocodb:latest
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NC_DB: "pg://postgres:5432?u=nocodb&p=your_db_password&d=nocodb"
      NC_REDIS_URL: "redis://:your_redis_password@redis:6379/0"
      NC_REDIS_JOB_URL: "redis://:your_redis_password@redis:6379/1"
      NC_WORKER_CONTAINER: "true"

volumes:
  postgres_data:
  redis_data:
  nocodb_data:
```

> Both containers use `nocodb/nocodb:latest`. `NC_WORKER_CONTAINER=true` changes the container's role at startup.

## Scaling workers

To run multiple workers, either add additional worker service blocks in your compose file or use `--scale`:

```bash
docker compose up --scale nocodb-worker=3
```

All worker containers draw from the same job queue in Redis. Use `NC_WORKER_CONCURRENCY` to control how many jobs each worker handles at once (default: 10).

## Notes and limitations

- **Redis is required for Worker Mode.**
- **Workers do not serve HTTP.** Do not expose worker containers on port 8080; they have no API or UI.
- **Shared database required.** All primary and worker containers must connect to the same database.
- **Failed jobs are retried automatically** with exponential backoff.
- **SQLite is not recommended for multi-container deployments.** Use PostgreSQL (or MySQL) when running separate primary and worker containers.

## Recommended production pattern

1. Use PostgreSQL as the database.
2. Use a Redis instance protected with a password.
3. Use separate Redis logical databases for the job queue and cache (`NC_REDIS_JOB_URL` pointing to `/1`, `NC_REDIS_URL` for cache on `/0`).
4. Set `NC_WORKER_CONTAINER=false` explicitly on the primary.
5. Start with one worker container. Add more workers if job throughput becomes a bottleneck.
