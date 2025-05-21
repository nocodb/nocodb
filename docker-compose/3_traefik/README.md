# Example with traefik revers proxy

Look into the `.env` file and update the vaiables before executing `docker-compose up -d`. 

## Traefik configuration

- HTTP redirect to HTTPS
- Healthcheck
- SSL certificate via Cloudflare DNS challenge

## Watchtower

Looks for new nocodb image every day at 5:00 and recreates the container.

## NocoDB

- Accessible via `nocodb.DOMAINNAME/dashboard`
- Uses postgres db for storage
- Telemetry is disabled