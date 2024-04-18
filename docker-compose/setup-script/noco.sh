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

# check command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# install package based on platform
install_package() {
  if command_exists yum; then
    sudo yum install -y "$1"
  elif command_exists apt; then
    sudo apt install -y "$1"
  elif command_exists brew; then
    brew install "$1"
  else
    echo "Package manager not found. Please install $1 manually."
  fi
}

# Function to check if sudo is required for Docker command
check_for_docker_sudo() {
    if docker ps >/dev/null 2>&1; then
        echo "n"
    else
        echo "y"
    fi
}

# Function to read a number from the user
read_number() {
    local number
    read -rp "$1" number

    # Ensure the input is a number or empty
    while ! [[ $number =~ ^[0-9]+$ ]] && [ -n "$number" ] ; do
        read -rp "Please enter a valid number: " number
    done

    echo "$number"
}

# Function to read a number within a range from the user
read_number_range() {
    local number
    local min
    local max

    # Check if there are 3 arguments
    if [ "$#" -ne 3 ]; then
        number=$(read_number)
        min=$1
        max=$2
    else
        number=$(read_number "$1")
        min=$2
        max=$3
    fi

    # Ensure the input is in the specified range
    while [[ -n "$number" && ($number -lt $min || $number -gt $max) ]]; do
        number=$(read_number "Please enter a number between $min and $max: ")
    done

    echo "$number"
}

# *****************    HELPER FUNCTIONS END  ***********************************
# ******************************************************************************



# ******************************************************************************
# ******************** SYSTEM REQUIREMENTS CHECK START  *************************

# Check if the following requirements are met:
# a. docker, jq installed
# b. port mapping check : 80,443 are free or being used by nginx container

REQUIRED_PORTS=(80 443)

echo "** Performing nocodb system check and setup. This step may require sudo permissions"

# pre install wget if not found
if ! command_exists wget; then
  echo "wget is not installed. Setting up for installation..."
  install_package wget
fi

# d. Check if required tools are installed
echo " | Checking if required tools (docker, lsof) are installed..."
for tool in docker lsof openssl; do
  if ! command_exists "$tool"; then
    echo "$tool is not installed. Setting up for installation..."
    if [ "$tool" = "docker" ]; then
      wget -qO- https://get.docker.com/ | sh
    elif [ "$tool" = "lsof" ]; then
         install_package lsof
    fi
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
  else
    echo " | Port $port is free."
  fi
done

echo "** System check completed successfully. **"


# Define an array to store the messages to be printed at the end
message_arr=()

# extract public ip address
PUBLIC_IP=$(dig +short myip.opendns.com @resolver1.opendns.com)

# Check if the public IP address is not empty, if empty then use the localhost
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="localhost"
fi

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
    #  prompt for ip address and if left empty use extracted public ip
    echo "Enter the IP address or domain name for the NocoDB instance (default: $PUBLIC_IP): "
    read DOMAIN_NAME
    if [ -z "$DOMAIN_NAME" ]; then
        DOMAIN_NAME="$PUBLIC_IP"
    fi
fi

if [ -n "$EDITION" ] && { [ "$EDITION" = "EE" ] || [ "$EDITION" = "ee" ]; }; then
    echo "Enter the NocoDB license key: "
    read LICENSE_KEY
    if [ -z "$LICENSE_KEY" ]; then
        echo "License key is required for Enterprise Edition installation"
        exit 1
    fi
fi


echo "Do you want to enabled Redis for caching [Y/N] (default: Y): "
read REDIS_ENABLED

if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
    message_arr+=("Redis: Enabled")
else
    message_arr+=("Redis: Disabled")
fi


echo "Do you want to enabled Watchtower for automatic updates [Y/N] (default: Y): "
read WATCHTOWER_ENABLED

if [ -z "$WATCHTOWER_ENABLED" ] || { [ "$WATCHTOWER_ENABLED" != "N" ] && [ "$WATCHTOWER_ENABLED" != "n" ]; }; then
    message_arr+=("Watchtower: Enabled")
else
    message_arr+=("Watchtower: Disabled")
fi

echo "Show Advanced Options [Y/N] (default: N): "
read -r ADVANCED_OPTIONS

if [ -n "$ADVANCED_OPTIONS" ] && { [ "$ADVANCED_OPTIONS" = "Y" ] || [ "$ADVANCED_OPTIONS" = "y" ]; }; then
    NUM_CORES=$(nproc)
    echo  "How many instances of NocoDB do you want to run (Maximum: ${NUM_CORES}) ? (default: 1): "
    NUM_INSTANCES=$(read_number_range 1 "$NUM_CORES")

    message_arr+=("Number of instances: $NUM_INSTANCES")
fi

if [ -z "$NUM_INSTANCES" ]; then
    NUM_INSTANCES=1
fi

# ******************************************************************************
# *********************** INPUTS FROM USER END  ********************************


# ******************************************************************************
# *************************** SETUP START  *************************************

# Generate a strong random password for PostgreSQL
STRONG_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()-_+=' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 24)
# Encode special characters in the password for JDBC URL usage
ENCODED_PASSWORD=$(urlencode "$STRONG_PASSWORD")

IMAGE="nocodb/nocodb:latest";

# Determine the Docker image to use based on the edition
if [ -n "$EDITION" ] && { [ "$EDITION" = "EE" ] || [ "$EDITION" = "ee" ]; }; then
  IMAGE="nocodb/nocodb-ee:latest"
  DATABASE_URL="DATABASE_URL=postgres://postgres:${ENCODED_PASSWORD}@db:5432/nocodb"
else
  # use NC_DB url until the issue with DATABASE_URL is resolved(encoding)
  DATABASE_URL="NC_DB=pg://db:5432?d=nocodb&user=postgres&password=${ENCODED_PASSWORD}"
fi


message_arr+=("Docker image: $IMAGE")


DEPENDS_ON=""

# Add Redis service if enabled
if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
  DEPENDS_ON="- redis"
fi


# Write the Docker Compose file with the updated password
cat <<EOF > docker-compose.yml
services:
  nocodb:
    image: ${IMAGE}
    env_file: docker.env
    deploy:
      mode: replicated
      replicas: ${NUM_INSTANCES}
    depends_on:
      - db
      ${DEPENDS_ON}
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    networks:
      - nocodb-network
  db:
    image: postgres:16.1
    env_file: docker.env
    volumes:
      - ./postgres:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      interval: 10s
      retries: 10
      test: "pg_isready -U \"\$\$POSTGRES_USER\" -d \"\$\$POSTGRES_DB\""
      timeout: 2s
    networks:
      - nocodb-network

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx:/etc/nginx/conf.d
EOF

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
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
    networks:
      - nocodb-network
EOF

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
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
    networks:
      - nocodb-network
EOF
fi

if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
cat <<EOF >> docker-compose.yml
  redis:
    image: redis:latest
    restart: unless-stopped
    env_file: docker.env
    command:
      - /bin/sh
      - -c
      - redis-server --requirepass "\$\${REDIS_PASSWORD}"
    volumes:
      - redis:/data
    healthcheck:
      test: [ "CMD", "redis-cli", "-a", "\$\${REDIS_PASSWORD}", "--raw", "incr", "ping" ]
    networks:
      - nocodb-network
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
    networks:
      - nocodb-network
EOF
fi

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
    cat <<EOF >> docker-compose.yml
volumes:
  letsencrypt-lib:
  webroot:
EOF
fi

# add the cache volume
if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
#  check ssl enabled
  if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
    cat <<EOF >> docker-compose.yml
  redis:
EOF
  else
    cat <<EOF >> docker-compose.yml
volumes:
  redis:
EOF
  fi
fi

# Create the network
cat <<EOF >> docker-compose.yml
networks:
  nocodb-network:
    driver: bridge
EOF

# Write the docker.env file
cat <<EOF > docker.env
POSTGRES_DB=nocodb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${STRONG_PASSWORD}
$DATABASE_URL
NC_LICENSE_KEY=${LICENSE_KEY}
EOF

# add redis env if enabled
if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
  cat <<EOF >> docker.env
REDIS_PASSWORD=${REDIS_PASSWORD}
NC_REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
EOF
fi

mkdir -p ./nginx

# Create nginx config with the provided domain name
cat > ./nginx/default.conf <<EOF
server {
    listen 80;
EOF

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
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

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
cat >> ./nginx/default.conf <<EOF
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
EOF
fi
cat >> ./nginx/default.conf <<EOF
}
EOF

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then

mkdir -p ./nginx-post-config

# Create nginx config with the provided domain name
cat > ./nginx-post-config/default.conf <<EOF
upstream nocodb_backend {
    least_conn;
    server nocodb:8080;
}


server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        return 301 https://\$host\$request_uri;
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
        proxy_pass http://nocodb_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

EOF
fi

IS_DOCKER_REQUIRE_SUDO=$(check_for_docker_sudo)
DOCKER_COMMAND=$([ "$IS_DOCKER_REQUIRE_SUDO" = "y" ] && echo "sudo docker" || echo "docker")

# Generate help script
cat > nocodb_20240417_131051/help.sh <<EOF
#!/bin/bash

trap show_menu INT


$(declare -f read_number)

$(declare -f read_number_range)

# Function to display the menu
show_menu() {
#    clear
    echo ""
    echo \$MSG
    echo "Service Management Menu:"
    echo "1. Start Service"
    echo "2. Stop Service"
    echo "3. Logs"
    echo "4. Restart"
    echo "5. Upgrade"
    echo "6. Scale"
    echo "7. Monitoring"
    echo "0. Exit"
}

# Function to start the service
start_service() {
    echo -e "\nStarting nocodb..."
    $DOCKER_COMMAND compose up -d
}

# Function to stop the service
stop_service() {
    echo -e "\nStopping nocodb..."
    $DOCKER_COMMAND compose stop
}

# Function to show logs
show_logs() {
    clear
    echo "Select a container for logs:"

    # Fetch the list of services
    mapfile -t services < <($DOCKER_COMMAND compose ps --services)
    declare -A service_replicas

    # For each service, count the number of running instances
    for service in "\${services[@]}"; do
        # Count the number of lines that have the service name, which corresponds to the number of replicas
        replicas=\$($DOCKER_COMMAND compose ps \$service | grep "\$service" | wc -l)
        service_replicas["\$service"]=\$replicas
    done

    count=1

    for service in "\${services[@]}"; do
        echo "\$count. \$service (\${service_replicas[\$service]} replicas)"
        count=\$((count + 1))
    done

    echo "A. All"
    echo "0. Back to main menu"
    echo "Enter your choice: "
    read -n 1 log_choice
    echo

    if [[ "\$log_choice" =~ ^[0-9]+\$ ]] && [ "\$log_choice" -gt 0 ] && [ "\$log_choice" -lt "\$count" ]; then
        service_index=\$((log_choice-1))
        service="\${services[\$service_index]}"
        num_replicas="\${service_replicas[\$service]}"

        if [ "\$num_replicas" -gt 1 ]; then
            echo "Select a replica for \$service:"
            for i in \$(seq 1 \$num_replicas); do
                echo "\$i. \$service replica \$i"
            done
            echo "A. All"
            echo "Enter replica number: "
            read -n 1 replica_choice

            if [[ "\$replica_choice" =~ ^[0-9]+\$ ]] && [ "\$replica_choice" -gt 0 ] && [ "\$replica_choice" -le "\$num_replicas" ]; then
                container_id=\$($DOCKER_COMMAND compose ps | grep "\$service-\$replica_choice" | cut -d " " -f 1)
                $DOCKER_COMMAND logs -f "\$container_id"
            elif [ "\$replica_choice" == "A" ] || [ "\$replica_choice" == "a" ]; then
                $DOCKER_COMMAND compose logs -f \$service
            else
                echo "Invalid choice. Please select a correct option."
            fi
        else
            # If there is only one replica, get its container ID directly
            container_id=\$($DOCKER_COMMAND ps --filter "name=\$service" --format "{{.ID}}")

            if [ -n "\$container_id" ]; then
                $DOCKER_COMMAND logs -f "\$container_id"
            else
                echo "No logs available for this service."
            fi
        fi
        return
    fi

    case \$log_choice in
        A) $DOCKER_COMMAND compose logs -f ;;
        0) return ;;
        *) echo "Invalid choice. Please select a correct option." ;;
    esac
}

# Function to restart the service
restart_service() {
    echo -e "\nRestarting nocodb..."
    $DOCKER_COMMAND compose restart
}

# Function to upgrade the service
upgrade_service() {
    echo -e "\nUpgrading nocodb..."
    $DOCKER_COMMAND compose pull
    $DOCKER_COMMAND compose up -d --force-recreate
    $DOCKER_COMMAND image prune -a -f
}

# Function to scale the service
scale_service() {
    num_cores=\$(nproc)
    current_scale=\$($DOCKER_COMMAND compose ps -q nocodb | wc -l)
    echo -e "\nCurrent number of instances: \$current_scale"
    echo "How many instances of NocoDB do you want to run (Maximum: \${num_cores}) ? (default: 1): "
    scale_num=\$(read_number_range 1 \$num_cores)

    if [ \$scale_num -eq \$current_scale ]; then
        echo "Number of instances is already set to \$scale_num. Returning to main menu."
        return
    fi

    $DOCKER_COMMAND compose up -d --scale nocodb=\$scale_num
}

# Function for basic monitoring
monitoring_service() {
    echo -e '\nLoading stats...'
    $DOCKER_COMMAND stats
}

# Main program loop
while true; do
    show_menu
    echo "Enter your choice: "

    read -n 1 choice
    case \$choice in
        1) start_service && MSG="NocoDB Started" ;;
        2) stop_service && MSG="NocoDB Stopped" ;;
        3) show_logs ;;
        4) restart_service && MSG="NocoDB Restarted" ;;
        5) upgrade_service && MSG="NocoDB has been upgraded to latest version" ;;
        6) scale_service && MSG="NocoDB has been scaled" ;;
        7) monitoring_service ;;
        0) exit 0 ;;
        *) MSG="\nInvalid choice. Please select a correct option." ;;
    esac
done
EOF

message_arr+=("Help script: help.sh")

cat > ./update.sh <<EOF
$DOCKER_COMMAND compose pull
$DOCKER_COMMAND compose up -d --force-recreate
$DOCKER_COMMAND image prune -a -f
EOF

message_arr+=("Update script: update.sh")

$DOCKER_COMMAND compose pull
$DOCKER_COMMAND compose up -d

echo 'Waiting for Nginx to start...';

sleep 5

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ]; then
  echo 'Starting Letsencrypt certificate request...';

  $DOCKER_COMMAND compose exec certbot certbot certonly --webroot --webroot-path=/var/www/certbot -d "$DOMAIN_NAME" --email "contact@$DOMAIN_NAME" --agree-tos --no-eff-email && echo "Certificate request successful" || echo "Certificate request failed"
  # Initial Let's Encrypt certificate request

  # Update the nginx config to use the new certificates
  rm -rf ./nginx/default.conf
  mv ./nginx-post-config/default.conf ./nginx/
  rm -r ./nginx-post-config

  echo "Restarting nginx to apply the new certificates"
  # Reload nginx to apply the new certificates
  $DOCKER_COMMAND compose exec nginx nginx -s reload

  message_arr+=("NocoDB is now available at https://$DOMAIN_NAME")

elif [ -n "$DOMAIN_NAME" ]; then
  message_arr+=("NocoDB is now available at http://$DOMAIN_NAME")
else
  message_arr+=("NocoDB is now available at http://localhost")
fi

print_box_message "${message_arr[@]}"

# *************************** SETUP END  *************************************
# ******************************************************************************
