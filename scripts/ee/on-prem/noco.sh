#!/bin/bash
# set -x

# Performs Initial setup and System Requirements Check

## 1. validate system requirements
# a. docker, docker-compose, jq installed
# b. port mapping check
#   - port 80,443 are free or being used by nginx container

REQUIRED_PORTS=(80 443)

echo "** Performing nocodb system check and setup. This step may require sudo permissions"
PRE_REQ=0

# d. Check if required tools are installed
echo " | Checking if required tools (docker, docker-compose, jq, lsof) are installed..."
for tool in docker docker-compose lsof; do
  if ! command -v "$tool" &> /dev/null; then
    echo " | Error: $tool is not installed. Please install it before proceeding."
    PRE_REQ=1
  fi
done

# e. Check if NocoDB is already installed and its expected version
# echo "Checking if NocoDB is already installed and its expected version..."
# Replace the following command with the actual command to check NocoDB installation and version
# Example: nocodb_version=$(command_to_get_nocodb_version)
# echo "NocoDB version: $nocodb_install_version"

# f. Port mapping check
echo " | Checking port accessibility..."
for port in "${REQUIRED_PORTS[@]}"; do
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
    echo " | WARNING: Port $port is in use. Please make sure it is free." >&2
    PRE_REQ=1
  else
    echo " | Port $port is free."
  fi
done

echo "** System check completed successfully. **"

# Function to URL encode special characters in a string
urlencode() {
  local string="$1"
  local strlen=${#string}
  local encoded=""
  local pos c o

  for (( pos=0 ; pos<strlen ; pos++ )); do
    c=${string:$pos:1}
    case "$c" in
      [-_.~a-zA-Z0-9] ) o="$c" ;;
      * )               printf -v o '%%%02X' "'$c"
    esac
    encoded+="$o"
  done
  echo "$encoded"
}

# generate a folder for the docker-compose file which is not existing and do the setup within the folder
# Define the folder name
FOLDER_NAME="nocodb"

# Check if the folder exists
if [ -d "$FOLDER_NAME" ]; then
    # If the folder exists, append current datetime to the folder name
    FOLDER_NAME="${FOLDER_NAME}_$(date +"%Y%m%d_%H%M%S")"
fi

# prompt for custom folder name and if left empty skip
echo "Enter a custom folder name or press Enter to use the default folder name ($FOLDER_NAME): "
read CUSTOM_FOLDER_NAME

if [ -n "$CUSTOM_FOLDER_NAME" ]; then
    FOLDER_NAME="$CUSTOM_FOLDER_NAME"
fi


# Create the folder
mkdir -p "$FOLDER_NAME"

# Navigate into the folder
cd "$FOLDER_NAME" || exit


echo "Do you want to configure SSL [Y/N] (default: N): "
read SSL_ENABLED


if [ -n "$SSL_ENABLED" ] && { [ "$SSL_ENABLED" = "Y" ] || [ "$SSL_ENABLED" = "y" ]; }; then
    SSL_ENABLED='y'
    echo "Enter the domain name for the SSL certificate: "
    read DOMAIN_NAME
fi

echo "Enter the NocoDB license key if you have one, otherwise press Enter to continue without a license key: "
read LICENSE_KEY

echo "Do you want to enabled Watchtower for automatic updates [Y/N] (default: Y): "
read WATCHTOWER_ENABLED

## Extract domain name from the siteUrl property if provided, otherwise extract from payload
#if [ -n "$2" ]; then
#    DOMAIN_NAME="$2"
#else
#    # Extract payload
#    payload=$(echo "$LICENSE_KEY" | cut -d'.' -f2 | base64 --decode)
#    DOMAIN_NAME=$(echo "$payload" | grep -Eo '"siteUrl"[^,]*' | sed -n 's/.*"siteUrl":"\([^"]*\).*/\1/p' | sed 's/^https\{0,1\}\:\/\/\([^/]*\).*/\1/')
#fi

## if domain name is not provided, exit
#if [ -z "$DOMAIN_NAME" ]; then
#    echo "Please provide a valid domain name or a valid license key"
#    exit 1
#fi
echo ""
echo "Domain name: ${DOMAIN_NAME}"
echo "License key: $LICENSE_KEY"
echo "SSL enabled: $SSL_ENABLED"
echo ""

# Generate a strong random password for PostgreSQL
#STRONG_PASSWORD=$(cat /dev/urandom | tr -dc '[:alnum:]' | head -c 20)
#STRONG_PASSWORD=$(openssl rand -base64 32)
STRONG_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()-_+=' | head -c 32)
# Encode special characters in the password for JDBC URL usage

# URL encode the password
ENCODED_PASSWORD=$(urlencode "$STRONG_PASSWORD")




IMAGE="nocodb/nocodb:latest";

# Ternary expression to determine the message
if [ -n "$LICENSE_KEY" ]; then
  echo "Using the NocoDB Enterprise Edition image"
  IMAGE="nocodb/nocodb-ee:latest"
  DATABASE_URL="DATABASE_URL=postgres://postgres:${ENCODED_PASSWORD}@db:5432/nocodb"
else
  # use NC_DB url until the issue with DATABASE_URL is resolved(encoding)
  DATABASE_URL="NC_DB=pg://db:5432?d=nocodb&user=postgres&password=${ENCODED_PASSWORD}"
fi

# Write the Docker Compose file with the updated password
cat <<EOF > docker-compose.yml
version: '3'

services:
  nocodb:
    image: ${IMAGE}
    env_file: docker.env
    depends_on:
      - db
    restart: unless-stopped
    volumes:
      - ./nc_data:/usr/app/data

  db:
    image: postgres:latest
    env_file: docker.env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx:/etc/nginx/conf.d
EOF

if [ "$SSL_ENABLED" = 'y' ]; then
    cat <<EOF >> docker-compose.yml
      - ./webroot:/var/www/certbot
      - ./letsencrypt:/etc/letsencrypt
      - ./letsencrypt-lib:/var/lib/letsencrypt
EOF
fi
cat <<EOF >> docker-compose.yml
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - nocodb
    restart: unless-stopped
EOF

if [ "$SSL_ENABLED" = 'y' ]; then
    cat <<EOF >> docker-compose.yml
  certbot:
    image: certbot/certbot
    volumes:
      - ./letsencrypt:/etc/letsencrypt
      - ./letsencrypt-lib:/var/lib/letsencrypt
      - ./webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"
#    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot certonly --webroot --webroot-path=/var/www/certbot --no-eff-email -n --email contact@${DOMAIN_NAME} --agree-tos -d ${DOMAIN_NAME}; sleep 12h & wait \$\${!}; done;'"
#    command: certonly --webroot --webroot-path=/var/www/certbot --email  contact@${DOMAIN_NAME} --agree-tos --no-eff-email --staging -d ${DOMAIN_NAME}
    depends_on:
      - nginx
    restart: unless-stopped
EOF
fi

if([ -z "$WATCHTOWER_ENABLED" ] || { [ "$WATCHTOWER_ENABLED" != "N" ] && [ "$WATCHTOWER_ENABLED" != "n" ]; }); then
cat <<EOF >> docker-compose.yml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300
    restart: unless-stopped
EOF
fi

#cat <<EOF >> docker-compose.yml
#volumes:
#  postgres_data:
#  nc_data:
#EOF
#if [ "$SSL_ENABLED" = 'y' ]; then
#    cat <<EOF >> docker-compose.yml
#  letsencrypt:
#  letsencrypt-lib:
#  webroot:
#EOF
#fi

# Write the docker.env file
cat <<EOF > docker.env
POSTGRES_DB=nocodb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${STRONG_PASSWORD}
$DATABASE_URL
NC_LICENSE_KEY=${LICENSE_KEY}
EOF

mkdir -p ./nginx

# Create nginx config with the provided domain name
cat > ./nginx/default.conf <<EOF
server {
    listen 80;
EOF

if [ "$SSL_ENABLED" = 'y' ]; then
cat >> ./nginx/default.conf <<EOF
    server_name $DOMAIN_NAME;
EOF
fi

cat >> ./nginx/default.conf <<EOF
    location / {
        proxy_pass http://nocodb:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
EOF

if [ "$SSL_ENABLED" = 'y' ]; then
cat >> ./nginx/default.conf <<EOF
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
EOF
fi
cat >> ./nginx/default.conf <<EOF
}
EOF

if [ "$SSL_ENABLED" = 'y' ]; then
mkdir -p ./nginx-post-config
# Create nginx config with the provided domain name
cat > ./nginx-post-config/default.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    location / {
        proxy_pass http://nocodb:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}


server {
    listen 443 ssl;
    server_name $DOMAIN_NAME;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem;

    location / {
        proxy_pass http://nocodb:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

EOF
fi

# Start the docker-compose setup
docker-compose up -d


echo 'Waiting for NocoDB to start...';

sleep 5;

if [ "$SSL_ENABLED" = 'y' ]; then
  echo 'Starting Letsencrypt certificate request...';

  # Initial Let's Encrypt certificate request
  docker-compose exec certbot certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN_NAME --email contact@$DOMAIN_NAME --agree-tos --no-eff-email && echo "Certificate request successful" || echo "Certificate request failed"

  # Update the nginx config to use the new certificates
  rm -rf ./nginx/default.conf
  mv ./nginx-post-config/default.conf ./nginx/
  rm -r ./nginx-post-config

  echo "Restarting nginx to apply the new certificates"
  # Reload nginx to apply the new certificates
  docker-compose exec nginx nginx -s reload

  echo "NocoDB is now available at https://$DOMAIN_NAME"

elif [ -n "$DOMAIN_NAME" ]; then
  echo "NocoDB is now available at http://$DOMAIN_NAME"
else
  echo "NocoDB is now available at http://localhost"
fi