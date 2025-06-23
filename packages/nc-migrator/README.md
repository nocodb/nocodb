# NC Migrator

A database migration service for transferring PostgreSQL data between databases with progress tracking and job management.

## Features

- Asynchronous database migrations with progress tracking
- Job queue management with status monitoring
- Support for schema-specific migrations
- RESTful API for easy integration
- Docker support for easy deployment
- PostgreSQL client tools included

## Quick Start

### Using Docker

```bash
# Build and run the service
docker-compose up --build

# Or build and run manually
docker build -t nc-migrator .
docker run -p 4444:4444 nc-migrator
```

### Local Development

```bash
# Install dependencies
npm install

# Start the service
npm start
```

The service will be available at `http://localhost:4444`

## API Endpoints

### Start Migration
```http
POST /migrate
Content-Type: application/json

{
  "sourceUrl": "postgresql://user:pass@source-host:5432/source_db",
  "targetUrl": "postgresql://user:pass@target-host:5432/target_db",
  "schemas": ["public", "app_schema"]
}
```

**Response:**
```json
{
  "message": "Data transfer started",
  "jobId": "uuid-here",
  "statusUrl": "/migrate/uuid-here/status"
}
```

### Check Migration Status
```http
GET /migrate/{jobId}/status
```

**Response:**
```json
{
  "id": "uuid-here",
  "status": "running",
  "progress": 45,
  "message": "Starting data migration to your upgraded workspace...",
  "startTime": "2024-01-01T00:00:00.000Z",
  "schemas": ["public"],
  "steps": [
    {
      "step": "Setting up target resource",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "message": "Setting up target resource"
    }
  ]
}
```

### List All Jobs
```http
GET /migrate/jobs
```

## Environment Variables

- `PORT` - Server port (default: 4444)
- `NODE_ENV` - Environment (default: development)

## Prerequisites

The service requires PostgreSQL client tools (`pg_dump`, `pg_restore`, `createdb`) to be available. These are included in the Docker image.

For local development, install PostgreSQL client tools:

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

## Testing with Docker Compose

The docker-compose.yml includes an optional test PostgreSQL database:

```bash
# Start with test database
docker-compose --profile test up

# Test database will be available at localhost:5433
# Connection: postgresql://testuser:testpass@localhost:5433/testdb
```

## Job Status Values

- `started` - Job has been queued
- `running` - Migration is in progress
- `completed` - Migration completed successfully
- `failed` - Migration failed (check error field)

## Security Notes

- Connection URLs are sanitized in logs to hide credentials
- The service runs as a non-root user in Docker
- Temporary dump files are automatically cleaned up
- Old jobs are automatically cleaned up after 24 hours

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License 