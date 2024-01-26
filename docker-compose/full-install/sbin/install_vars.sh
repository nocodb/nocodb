nocodb_install_version="1.0.0"  # Replace with actual version
REQUIRED_PORTS=(80 443)
DOCKER_IMAGES=("redis:latest" "postgres:14.7" "nocodb/nocodb:latest" "nginx" "certbot/certbot:latest" )

# Array of properties with default values
properties=( "POSTGRES_USER=postgres" "POSTGRES_PASSWORD=test123" "POSTGRES_DB=nocodb" "NC_REDIS_URL=redis://redis:6379/4" 'NC_DB=pg://postgres:5432?u=postgres&password=${POSTGRES_PASSWORD:-nocodb}&d=postgres' )
# "NC_INSTALL_ROOT=${SCRIPT_DIR}" "MINIO_ROOT_USER=minioadmin" "MINIO_ROOT_PASSWORD=minioadmin"