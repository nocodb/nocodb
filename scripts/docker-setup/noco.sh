#!/bin/bash
# set -x

# ******************************************************************************
# *****************    HELPER FUNCTIONS START  *********************************

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

# function to print a message in a box
print_box_message() {
    message=("$@")  # Store all arguments in the array "message"
    edge="======================================"
    padding="  "

    echo "$edge"
    for element in "${message[@]}"; do
        echo "${padding}${element}"
    done
    echo "$edge"
}

# *****************    HELPER FUNCTIONS END  ***********************************
# ******************************************************************************



# ******************************************************************************
# ******************** SYSTEM REQUIREMENTS CHECK START  *************************

# Check if the following requirements are met:
# a. docker, docker-compose, jq installed
# b. port mapping check : 80,443 are free or being used by nginx container

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


# Define an array to store the messages to be printed at the end
message_arr=()

# generate a folder for the docker-compose file which is not existing and do the setup within the folder
# Define the folder name
FOLDER_NAME="nocodb_$(date +"%Y%m%d_%H%M%S")"

# prompt for custom folder name and if left empty skip
#echo "Enter a custom folder name or press Enter to use the default folder name ($FOLDER_NAME): "
#read CUSTOM_FOLDER_NAME

message_arr+=("Setup folder: $FOLDER_NAME")

if [ -n "$CUSTOM_FOLDER_NAME" ]; then
    FOLDER_NAME="$CUSTOM_FOLDER_NAME"
fi


# Create the folder
mkdir -p "$FOLDER_NAME"

# Navigate into the folder
cd "$FOLDER_NAME" || exit

# ******************** SYSTEM REQUIREMENTS CHECK END  **************************
# ******************************************************************************



# ******************** INPUTS FROM USER START  ********************************
# ******************************************************************************

echo "Choose Community or Enterprise Edition [CE/EE] (default: CE): "
read EDITION

echo "Do you want to configure SSL [Y/N] (default: N): "
read SSL_ENABLED


if [ -n "$SSL_ENABLED" ] && { [ "$SSL_ENABLED" = "Y" ] || [ "$SSL_ENABLED" = "y" ]; }; then
    SSL_ENABLED='y'
    echo "Enter the domain name for the SSL certificate: "
    read DOMAIN_NAME
    if [ -z "$DOMAIN_NAME" ]; then
        echo "Domain name is required for SSL configuration"
        exit 1
    fi
    message_arr+=("Domain: $DOMAIN_NAME")
else
#  prompt for ip address and if left empty use localhost
    echo "Enter the IP address or domain name for the NocoDB instance (default: localhost): "
    read DOMAIN_NAME
    if [ -z "$DOMAIN_NAME" ]; then
        DOMAIN_NAME="localhost"
    fi
fi

if [ -n "$EDITION" ] && { [ "$EDITION" = "EE" ] || [ "$EDITION" = "ee" ]; }; then
    echo "Enter the NocoDB license key: "
    read LICENSE_KEY
    if [ -z "$LICENSE_KEY" ]; then
        echo "License key is required for Enterprise Edition installation"
        exit 1
    fi
    message_arr+=("License key: $LICENSE_KEY")
fi

echo "Do you want to enabled Watchtower for automatic updates [Y/N] (default: Y): "
read WATCHTOWER_ENABLED

if [ -z "$WATCHTOWER_ENABLED" ] || { [ "$WATCHTOWER_ENABLED" != "N" ] && [ "$WATCHTOWER_ENABLED" != "n" ]; }; then
    message_arr+=("Watchtower: Enabled")
else
    message_arr+=("Watchtower: Disabled")
fi


# ******************************************************************************
# *********************** INPUTS FROM USER END  ********************************


# ******************************************************************************
# *************************** SETUP START  *************************************

# Generate a strong random password for PostgreSQL
#STRONG_PASSWORD=$(cat /dev/urandom | tr -dc '[:alnum:]' | head -c 20)
#STRONG_PASSWORD=$(openssl rand -base64 32)
STRONG_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()-_+=' | head -c 32)
# Encode special characters in the password for JDBC URL usage
ENCODED_PASSWORD=$(urlencode "$STRONG_PASSWORD")

IMAGE="nocodb/nocodb:latest";

# Determine the Docker image to use based on the edition
if [ -n "$EDITION" ] && { [ "$EDITION" = "EE" ] || [ "$EDITION" = "ee" ]; }; then
  echo "Using the NocoDB Enterprise Edition image"
  IMAGE="nocodb/nocodb-ee:latest"
  DATABASE_URL="DATABASE_URL=postgres://postgres:${ENCODED_PASSWORD}@db:5432/nocodb"
else
  # use NC_DB url until the issue with DATABASE_URL is resolved(encoding)
  DATABASE_URL="NC_DB=pg://db:5432?d=nocodb&user=postgres&password=${ENCODED_PASSWORD}"
fi


message_arr+=("Docker image: $IMAGE")

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
      - ./nocodb:/usr/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
  db:
    image: postgres:latest
    env_file: docker.env
    volumes:
      - ./postgres:/var/lib/postgresql/data
    restart: unless-stopped

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx:/etc/nginx/conf.d
EOF

if [ "$SSL_ENABLED" = 'y' ]; then
    cat <<EOF >> docker-compose.yml
      - webroot:/var/www/certbot
      - ./letsencrypt:/etc/letsencrypt
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
      - ./letsencrypt:/etc/letsencrypt
      - letsencrypt-lib:/var/lib/letsencrypt
      - webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait \$\${!}; done;'"
    depends_on:
      - nginx
    restart: unless-stopped
EOF
fi

if [ -z "$WATCHTOWER_ENABLED" ] || { [ "$WATCHTOWER_ENABLED" != "N" ] && [ "$WATCHTOWER_ENABLED" != "n" ]; }; then
cat <<EOF >> docker-compose.yml
  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --schedule "0 2 * * 6" --cleanup
    restart: unless-stopped
EOF
fi

if [ "$SSL_ENABLED" = 'y' ]; then
    cat <<EOF >> docker-compose.yml
volumes:
  letsencrypt-lib:
  webroot:
EOF
fi

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


echo 'Waiting for Nginx to start...';

sleep 5

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


  message_arr+=("NocoDB is now available at https://$DOMAIN_NAME")

elif [ -n "$DOMAIN_NAME" ]; then
  message_arr+=("NocoDB is now available at http://$DOMAIN_NAME")
else
  message_arr+=("NocoDB is now available at http://localhost")
fi

print_box_message "${message_arr[@]}"

# *************************** SETUP END  *************************************
# ******************************************************************************
