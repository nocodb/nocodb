#!/bin/bash




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
      * )               printf -v o '%%%02x' "'$c"
    esac
    encoded+="$o"
  done
  echo "$encoded"
}

echo "Do you want to configure SSL [Y/N] (default: N): "
read SSL_ENABLED


if [ -n "$SSL_ENABLED" ] && { [ "$SSL_ENABLED" = "Y" ] || [ "$SSL_ENABLED" = "y" ]; }; then
    SSL_ENABLED='y'
    echo "Enter the domain name for the SSL certificate: "
    read DOMAIN_NAME
fi

echo "Enter the NocoDB license key if you have one, otherwise press Enter to continue without a license key: "
read LICENSE_KEY

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
    IMAGE="nocodb/nocodb-ee:0.0.4"
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
      - nc_data:/usr/app/data

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
      - webroot:/var/www/certbot
      - letsencrypt:/etc/letsencrypt
      - letsencrypt-lib:/var/lib/letsencrypt
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
      - letsencrypt:/etc/letsencrypt
      - letsencrypt-lib:/var/lib/letsencrypt
      - webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"
#    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot certonly --webroot --webroot-path=/var/www/certbot --no-eff-email -n --email contact@${DOMAIN_NAME} --agree-tos -d ${DOMAIN_NAME}; sleep 12h & wait \$\${!}; done;'"
#    command: certonly --webroot --webroot-path=/var/www/certbot --email  contact@${DOMAIN_NAME} --agree-tos --no-eff-email --staging -d ${DOMAIN_NAME}
    depends_on:
      - nginx
    restart: unless-stopped
EOF
fi
cat <<EOF >> docker-compose.yml

  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300
    restart: unless-stopped
volumes:
  postgres_data:
  nc_data:
EOF
if [ "$SSL_ENABLED" = 'y' ]; then
    cat <<EOF >> docker-compose.yml
  letsencrypt:
  letsencrypt-lib:
  webroot:
EOF
fi

# Write the docker.env file
cat <<EOF > docker.env
POSTGRES_DB=nocodb
POSTGRES_USER=postgres
POSTGRES_PASSWORD="${STRONG_PASSWORD}"
DATABASE_URL=postgres://postgres:${ENCODED_PASSWORD}@db:5432/nocodb
NC_LICENSE_KEY=${LICENSE_KEY}
EOF

mkdir -p ./nginx

# Create nginx config with the provided domain name
cat > ./nginx/default.conf <<EOF
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
  echo 'Starting letsencrypt certificate request...';

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