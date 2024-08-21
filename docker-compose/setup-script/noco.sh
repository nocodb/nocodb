#!/bin/bash
# set -x

# ******************************************************************************
# *****************    GLOBAL VARIABLES START  *********************************

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
ORANGE='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

NOCO_HOME="./nocodb"
# Get the current working directory
CURRENT_PATH=$(pwd)

# *****************    GLOBAL VARIABLES END  ***********************************
# ******************************************************************************

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

add_to_hosts() {
    local IP="127.0.0.1"
    local HOSTS_FILE="/etc/hosts"
    local TEMP_HOSTS_FILE="/tmp/hosts.tmp"

    ## Only add to hosts if the domain name is minio

    if [ "$MINIO_DOMAIN_NAME" != "minio" ]; then
        return 0
    fi

    # Check if the hostname already exists in the file
    if sudo grep -q "$MINIO_DOMAIN_NAME" "$HOSTS_FILE"; then
        echo "$MINIO_DOMAIN_NAME already exists in $HOSTS_FILE"
    else
        # Create a temporary copy of the hosts file
        sudo cp "$HOSTS_FILE" "$TEMP_HOSTS_FILE"

        # Add the hostname to the temporary file
        echo "$IP $MINIO_DOMAIN_NAME" | sudo tee -a "$TEMP_HOSTS_FILE" > /dev/null

        # Replace the original hosts file with the modified one
        if sudo mv "$TEMP_HOSTS_FILE" "$HOSTS_FILE"; then
            echo "Added $MINIO_DOMAIN_NAME to $HOSTS_FILE"
        else
            echo "Failed to update $HOSTS_FILE. Please check your permissions."
            return 1
        fi
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

check_if_docker_is_running() {
    if ! $DOCKER_COMMAND ps >/dev/null 2>&1; then
        echo    "+-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-+"
        echo -e "| ${BOLD}${YELLOW}Warning !          ${NC}                                                       |"
        echo    "| Docker is not running. Most of the commands will not work without Docker. |"
        echo    "| Use the following command to start Docker:                                |"
        echo -e "| ${BLUE}     sudo systemctl start docker        ${NC}                                  |"
        echo    "+-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-+"
    fi
}

# *****************    HELPER FUNCTIONS END  ***********************************
# ******************************************************************************

# *****************************************************************************
# *************************** Management  *************************************

# Function to display the menu
show_menu() {
    clear
    check_if_docker_is_running
    echo ""
    echo "$MSG"
    echo -e "\t\t${BOLD}Service Management Menu${NC}"
    echo -e " ${GREEN}1. Start Service"
    echo -e " ${ORANGE}2. Stop Service"
    echo -e " ${CYAN}3. Logs"
    echo -e " ${MAGENTA}4. Restart"
    echo -e " ${BLUE}5. Upgrade"
    echo -e " 6. Scale"
    echo -e " 7. Monitoring"
    echo -e " ${RED}0. Exit${NC}"
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

show_logs_sub_menu() {
    clear
    echo "Select a replica for $1:"
    for i in $(seq 1 $2); do
        echo "$i. \"$1\" replica $i"
    done
    echo "A. All"
    echo "0. Back to Logs Menu"
    echo "Enter replica number: "
    read -r replica_choice

    if [[ "$replica_choice" =~ ^[0-9]+$ ]] && [ "$replica_choice" -gt 0 ] && [ "$replica_choice" -le "$2" ]; then
        container_id=$($DOCKER_COMMAND compose ps | grep "$1-$replica_choice" | cut -d " " -f 1)
        $DOCKER_COMMAND logs -f "$container_id"
    elif [ "$replica_choice" == "A" ] || [ "$replica_choice" == "a" ]; then
        $DOCKER_COMMAND compose logs -f "$1"
    elif [ "$replica_choice" == "0" ]; then
        show_logs
    else
        show_logs_sub_menu "$1" "$2"
    fi
}


# Function to show logs
show_logs() {
    clear
    echo "Select a container for logs:"

    # Fetch the list of services
    services=()
    while IFS= read -r service; do
        services+=("$service")
    done < <($DOCKER_COMMAND compose ps --services)

    service_replicas=()
    count=0

    # For each service, count the number of running instances
    for service in "${services[@]}"; do
        # Count the number of lines that have the service name, which corresponds to the number of replicas
        replicas=$($DOCKER_COMMAND compose ps "$service" | grep -c "$service")
        service_replicas["$count"]=$replicas
        count=$((count + 1))
    done

    count=1

    for service in "${services[@]}"; do
        echo "$count. $service (${service_replicas[(($count - 1))]} replicas)"
        count=$((count + 1))
    done

    echo "A. All"
    echo "0. Back to main menu"
    echo "Enter your choice: "
    read -r log_choice
    echo

    if [[ "$log_choice" =~ ^[0-9]+$ ]] && [ "$log_choice" -gt 0 ] && [ "$log_choice" -lt "$count" ]; then
        service_index=$((log_choice-1))
        service="${services[$service_index]}"
        num_replicas="${service_replicas[$service_index]}"

        if [ "$num_replicas" -gt 1 ]; then
            trap 'show_logs_sub_menu "$service" "$num_replicas"' INT
            show_logs_sub_menu "$service" "$num_replicas"
            trap - INT
        else
            trap 'show_logs' INT
            $DOCKER_COMMAND compose logs -f "$service"
        fi
    elif [ "$log_choice" == "A" ] || [ "$log_choice" == "a" ]; then
        trap 'show_logs' INT
        $DOCKER_COMMAND compose logs -f
    elif [ "$log_choice" == "0" ]; then
        return
    else
        show_logs
    fi

    trap - INT
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
    num_cores=$(nproc || sysctl -n hw.ncpu || echo 1)
    current_scale=$($DOCKER_COMMAND compose ps -q nocodb | wc -l)
    echo -e "\nCurrent number of instances: $current_scale"
    echo "How many instances of NocoDB do you want to run (Maximum: ${num_cores}) ? (default: 1): "
    scale_num=$(read_number_range 1 "$num_cores")

    if [ "$scale_num" -eq "$current_scale" ]; then
        echo "Number of instances is already set to $scale_num. Returning to main menu."
        return
    fi

    $DOCKER_COMMAND compose up -d --scale nocodb="$scale_num"
}

# Function for basic monitoring
monitoring_service() {
    echo -e '\nLoading stats...'
    trap ' ' INT
    $DOCKER_COMMAND stats
}

management_menu() {
  # Main program loop
  while true; do
      trap - INT
      show_menu
      echo "Enter your choice: "

      read -r choice
      case $choice in
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
}

# ******************************************************************************
# *************************** Management END  **********************************


# ******************************************************************************
# *****************  Existing Install Test  ************************************

IS_DOCKER_REQUIRE_SUDO=$(check_for_docker_sudo)
DOCKER_COMMAND=$([ "$IS_DOCKER_REQUIRE_SUDO" = "y" ] && echo "sudo docker" || echo "docker")

NOCO_FOUND=false

# Check if $NOCO_HOME exists as directory
if [ -d "$NOCO_HOME" ]; then
  NOCO_FOUND=true
elif $DOCKER_COMMAND ps --format '{{.Names}}' | grep -q "nocodb"; then
    NOCO_ID=$(docker ps | grep "nocodb/nocodb" | cut -d ' ' -f 1)
    CUSTOM_HOME=$(docker inspect --format='{{index .Mounts 0}}' "$NOCO_ID" | cut -d ' ' -f 3)
    PARENT_DIR=$(dirname "$CUSTOM_HOME")

    ln -s "$PARENT_DIR" "$NOCO_HOME"
    basename "$PARENT_DIR" > "$NOCO_HOME/.COMPOSE_PROJECT_NAME"

    NOCO_FOUND=true
else
    mkdir -p "$NOCO_HOME"
fi

cd "$NOCO_HOME" || exit 1

# Check if nocodb is already installed
if [ "$NOCO_FOUND" = true ]; then
    echo "NocoDB is already installed. And running."
    echo "Do you want to reinstall NocoDB? [Y/N] (default: N): "
    read -r REINSTALL

    if [ -f "$NOCO_HOME/.COMPOSE_PROJECT_NAME" ]; then
        COMPOSE_PROJECT_NAME=$(cat "$NOCO_HOME/.COMPOSE_PROJECT_NAME")
        export COMPOSE_PROJECT_NAME
    fi

    if [ "$REINSTALL" != "Y" ] && [ "$REINSTALL" != "y" ]; then
        management_menu
        exit 0
    else
        echo "Reinstalling NocoDB..."
        $DOCKER_COMMAND compose down

        unset COMPOSE_PROJECT_NAME
        cd /tmp || exit 1
        rm -rf "$NOCO_HOME"

        cd "$CURRENT_PATH" || exit 1
        mkdir -p "$NOCO_HOME"
        cd "$NOCO_HOME" || exit 1
    fi
fi


# ******************************************************************************
# ******************** SYSTEM REQUIREMENTS CHECK START  *************************

# Check if the following requirements are met:
# a. docker, jq installed
# b. port mapping check : 80,443 are free or being used by nginx container

REQUIRED_PORTS=(80 443)

echo "** Performing nocodb system check and setup. This step may require sudo permissions"

# pre-install wget if not found
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


# f. Port mapping check
echo " | Checking port accessibility..."
for port in "${REQUIRED_PORTS[@]}"; do
  if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null; then
    echo " | WARNING: Port $port is in use. Please make sure it is free." >&2
  else
    echo " | Port $port is free."
  fi
done

echo "** System check completed successfully. **"


# Define an array to store the messages to be printed at the end
message_arr=()

# extract public ip address
PUBLIC_IP=$(dig +short myip.opendns.com @1.1.1.1)

# Check if the public IP address is not empty, if empty then use the localhost
if [ -z "$PUBLIC_IP" ]; then
    PUBLIC_IP="localhost"
fi

message_arr+=("Setup folder: $NOCO_HOME")

# ******************** SYSTEM REQUIREMENTS CHECK END  **************************
# ******************************************************************************



# ******************** INPUTS FROM USER START  ********************************
# ******************************************************************************

echo "Enter the IP address or domain name for the NocoDB instance (default: $PUBLIC_IP): "
read -r DOMAIN_NAME

echo "Show Advanced Options [Y/N] (default: N): "
read -r ADVANCED_OPTIONS

if [ "$ADVANCED_OPTIONS" == "Y" ]; then
    ADVANCED_OPTIONS="y"
fi

if [ -n "$DOMAIN_NAME" ]; then
  if [ "$ADVANCED_OPTIONS" == "y" ]; then
    echo "Do you want to configure SSL [Y/N] (default: N): "
    read -r SSL_ENABLED
    message_arr+=("SSL: ${SSL_ENABLED}")
  fi
else
    DOMAIN_NAME="$PUBLIC_IP"
fi

message_arr+=("Domain: $PUBLIC_IP")

if [ "$ADVANCED_OPTIONS" == "y" ]; then
    echo "Choose Community or Enterprise Edition [CE/EE] (default: CE): "
    read -r EDITION
fi

if [ -n "$EDITION" ] && { [ "$EDITION" = "EE" ] || [ "$EDITION" = "ee" ]; }; then
    echo "Enter the NocoDB license key: "
    read -r LICENSE_KEY
    if [ -z "$LICENSE_KEY" ]; then
        echo "License key is required for Enterprise Edition installation"
        exit 1
    fi
fi

# Configure Redis for caching
if [ "$ADVANCED_OPTIONS" == "y" ]; then
  echo "Do you want to enabled Redis for caching [Y/N] (default: Y): "
  read -r REDIS_ENABLED
fi

if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
    message_arr+=("Redis: Enabled")
else
    message_arr+=("Redis: Disabled")
fi

# Configure Minio for file storage
if [ "$ADVANCED_OPTIONS" == "y" ]; then
  echo "Do you want to enable Minio for file storage [Y/N] (default: Y): "
  read -r MINIO_ENABLED
  if [ -z "$MINIO_ENABLED" ] || { [ "$MINIO_ENABLED" != "N" ] && [ "$MINIO_ENABLED" != "n" ]; }; then
    message_arr+=("Minio: Enabled")
    MINIO_ENABLED="y"
  else
    message_arr+=("Minio: Disabled")
  fi
fi
# Minio Domain Name and SSL Configuration

MINIO_DOMAIN_NAME="minio"
MINIO_SSL_ENABLED="n"

if [ "$ADVANCED_OPTIONS" == "y" ]; then
  echo "Enter the MinIO domain name (default: $MINIO_DOMAIN_NAME): "
  read -r USER_MINIO_DOMAIN_NAME

  if [ -n "$USER_MINIO_DOMAIN_NAME" ]; then
    MINIO_DOMAIN_NAME="$USER_MINIO_DOMAIN_NAME"
  fi

  # Ask to configure SSL only if MINIO_DOMAIN_NAME is set
  if [ -n "$USER_MINIO_DOMAIN_NAME" ]; then
    echo "Do you want to configure SSL for MinIO [Y/N] (default: N): "
    read -r USER_MINIO_SSL_ENABLED

    if [ -n "$USER_MINIO_SSL_ENABLED" ]; then
      MINIO_SSL_ENABLED=$(echo "$USER_MINIO_SSL_ENABLED" | tr '[:upper:]' '[:lower:]')
    fi
  fi
fi

# Configure Watchtower for automatic updates
if [ "$ADVANCED_OPTIONS" == "y" ]; then
  echo "Do you want to enabled Watchtower for automatic updates [Y/N] (default: Y): "
  read -r WATCHTOWER_ENABLED
fi

if [ -z "$WATCHTOWER_ENABLED" ] || { [ "$WATCHTOWER_ENABLED" != "N" ] && [ "$WATCHTOWER_ENABLED" != "n" ]; }; then
    message_arr+=("Watchtower: Enabled")
else
    message_arr+=("Watchtower: Disabled")
fi

# Configure the number of instances to run
if [ "$ADVANCED_OPTIONS" = "y" ] ; then
    NUM_CORES=$(nproc || sysctl -n hw.ncpu || echo 1)
    echo  "How many instances of NocoDB do you want to run (Maximum: ${NUM_CORES}) ? (default: 1): "
    NUM_INSTANCES=$(read_number_range 1 "$NUM_CORES")
fi

if [ -z "$NUM_INSTANCES" ]; then
    NUM_INSTANCES=1
fi

message_arr+=("Number of instances: $NUM_INSTANCES")

# ******************************************************************************
# *********************** INPUTS FROM USER END  ********************************


# ******************************************************************************
# *************************** SETUP START  *************************************

# Generate a strong random password for PostgreSQL
STRONG_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()-_+=' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 24)
MINIO_ACCESS_KEY=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 24)
MINIO_ACCESS_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 24)
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
MINIO_DEPENDS_ON=""

# Add Redis service if enabled
if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
  DEPENDS_ON="- redis"
fi

# Add Minio service if enabled
if [ -z "$MINIO_ENABLED" ] || { [ "$MINIO_ENABLED" != "N" ] && [ "$MINIO_ENABLED" != "n" ]; }; then
  MINIO_DEPENDS_ON="- minio"
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
      ${MINIO_DEPENDS_ON}
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
      - "traefik.enable=true"
      - "traefik.http.routers.nocodb.rule=Host(\`${DOMAIN_NAME}\`)"
EOF
if [ "$SSL_ENABLED" != "Y" ] && [ "$SSL_ENABLED" != "y" ]; then
  cat <<EOF >> docker-compose.yml
      - "traefik.http.routers.nocodb.entrypoints=web"
EOF
else
  cat <<EOF >> docker-compose.yml
      - "traefik.http.routers.nocodb.entrypoints=websecure"
      - "traefik.http.routers.nocodb.tls=true"
      - "traefik.http.routers.nocodb.tls.certresolver=letsencrypt"
EOF
fi

cat <<EOF >> docker-compose.yml
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

  traefik:
    image: traefik:v3.1
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--providers.docker.exposedByDefault=false"
      - "--entrypoints.minio.address=:9000"
EOF

if [ "$SSL_ENABLED" = 'y' ] || [ "$SSL_ENABLED" = 'Y' ] || [ "$MINIO_SSL_ENABLED" = 'y' ] || [ "$MINIO_SSL_ENABLED" = 'Y' ]; then
    cat <<EOF >> docker-compose.yml
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=websecure"
      - "--certificatesresolvers.letsencrypt.acme.email=`\"contact@$DOMAIN_NAME\"`"
      - "--certificatesresolvers.letsencrypt.acme.storage=/etc/letsencrypt/acme.json"
EOF
else
    cat <<EOF >> docker-compose.yml
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
EOF
fi

cat <<EOF >> docker-compose.yml
    ports:
      - "80:80"
      - "443:443"
      - "9000:9000"
    depends_on:
      - nocodb
    restart: unless-stopped
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock"
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - nocodb-network
EOF

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
## Add Minio to the docker-compose file

if [ -z "$MINIO_ENABLED" ] || { [ "$MINIO_ENABLED" != "N" ] && [ "$MINIO_ENABLED" != "n" ]; }; then
  cat <<EOF >> docker-compose.yml
  minio:
    image: minio/minio:latest
    restart: unless-stopped
    env_file: docker.env
    entrypoint: /bin/sh
    volumes:
      - ./minio:/export
    command: -c 'mkdir -p /export/nocodb && /usr/bin/minio server /export'
    labels:
          - "traefik.enable=true"
          - "traefik.http.services.minio.loadbalancer.server.port=9000"
EOF
fi
# Minio SSL Configuration
if [ "$MINIO_SSL_ENABLED" != 'n' ] && [ "$MINIO_SSL_ENABLED" != 'N' ]; then
  cat <<EOF >> docker-compose.yml
          - "traefik.http.routers.minio.rule=Host(\`$MINIO_DOMAIN_NAME\`)"
          - "traefik.http.routers.minio.entrypoints=websecure"
          - "traefik.http.routers.minio.tls=true"
          - "traefik.http.routers.minio.tls.certresolver=letsencrypt"
EOF
else
  cat <<EOF >> docker-compose.yml
          - "traefik.http.routers.minio.rule=Host(\`$MINIO_DOMAIN_NAME\`)"
          - "traefik.http.routers.minio.entrypoints=minio"
EOF
fi

cat <<EOF >> docker-compose.yml
    networks:
      - nocodb-network
EOF

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

# Add the cache volume
if [ -z "$REDIS_ENABLED" ] || { [ "$REDIS_ENABLED" != "N" ] && [ "$REDIS_ENABLED" != "n" ]; }; then
  cat <<EOF >> docker-compose.yml
volumes:
  redis:
EOF
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

# add minio env if enabled
if [ -z "$MINIO_ENABLED" ] || { [ "$MINIO_ENABLED" != "N" ] && [ "$MINIO_ENABLED" != "n" ]; }; then
  cat <<EOF >> docker.env
MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
MINIO_ROOT_PASSWORD=${MINIO_ACCESS_SECRET}
NC_S3_BUCKET_NAME=nocodb
NC_S3_REGION=us-east-1
NC_S3_ACCESS_KEY=${MINIO_ACCESS_KEY}
NC_S3_ACCESS_SECRET=${MINIO_ACCESS_SECRET}
NC_S3_FORCE_PATH_STYLE=true
EOF
fi

if [ "$MINIO_SSL_ENABLED" != 'Y' ] && [ "$MINIO_SSL_ENABLED" != 'y' ]; then
  cat <<EOF >> docker.env
NC_S3_ENDPOINT=http://${MINIO_DOMAIN_NAME}:9000
EOF
add_to_hosts
else
  cat <<EOF >> docker.env
NC_S3_ENDPOINT=https://${MINIO_DOMAIN_NAME}
EOF
fi

cat > ./update.sh <<EOF
$DOCKER_COMMAND compose pull
$DOCKER_COMMAND compose up -d --force-recreate
$DOCKER_COMMAND image prune -a -f
EOF

message_arr+=("Update script: update.sh")

$DOCKER_COMMAND compose pull
$DOCKER_COMMAND compose up -d

echo 'Waiting for Traefik to start...';

sleep 5

if [ -n "$DOMAIN_NAME" ]; then
  message_arr+=("NocoDB is now available at http://$DOMAIN_NAME")
else
  message_arr+=("NocoDB is now available at http://localhost")
fi

print_box_message "${message_arr[@]}"

# *************************** SETUP END  *************************************
# ****************************************************************************

echo "Do you want to start the management menu [Y/N] (default: Y): "
read -r MANAGEMENT_MENU

if [ -z "$MANAGEMENT_MENU" ] || { [ "$MANAGEMENT_MENU" != "N" ] && [ "$MANAGEMENT_MENU" != "n" ]; }; then
    management_menu
fi