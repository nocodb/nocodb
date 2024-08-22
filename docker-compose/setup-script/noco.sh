#!/bin/bash

set -e

# Constants
NOCO_HOME="./nocodb"
CURRENT_PATH=$(pwd)
REQUIRED_PORTS=(80 443)

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
ORANGE='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

# Global variables
CONFIG_DOMAIN_NAME=""
CONFIG_SSL_ENABLED=""
CONFIG_EDITION=""
CONFIG_LICENSE_KEY=""
CONFIG_REDIS_ENABLED=""
CONFIG_MINIO_ENABLED=""
CONFIG_MINIO_DOMAIN_NAME=""
CONFIG_MINIO_SSL_ENABLED=""
CONFIG_WATCHTOWER_ENABLED=""
CONFIG_NUM_INSTANCES=""
CONFIG_POSTGRES_PASSWORD=""
CONFIG_REDIS_PASSWORD=""
CONFIG_MINIO_ACCESS_KEY=""
CONFIG_MINIO_ACCESS_SECRET=""
CONFIG_DOCKER_COMMAND=""

declare -a message_arr

# Utility functions
print_color() { printf "${1}%s${NC}\n" "$2"; }
print_info() { print_color "$BLUE" "INFO: $1"; }
print_success() { print_color "$GREEN" "SUCCESS: $1"; }
print_warning() { print_color "$YELLOW" "WARNING: $1"; }
print_error() { print_color "$RED" "ERROR: $1"; }

print_box_message() {
    local message=("$@")
    local edge="======================================"
    local padding="  "

    echo "$edge"
    for element in "${message[@]}"; do
        echo "${padding}${element}"
    done
    echo "$edge"
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

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

generate_password() {
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9!@#$%^&*()-_+=' | head -c 32
}

get_public_ip() {
    dig +short myip.opendns.com @1.1.1.1 || echo "localhost"
}

prompt() {
    local prompt_text="$1"
    local default_value="$2"
    local response

    if [ -n "$default_value" ]; then
        prompt_text+=" (default: $default_value)"
    fi
    prompt_text+=": "

    read -r -p "$prompt_text" response
    if [ -z "$response" ] && [ -n "$default_value" ]; then
        echo "$default_value"
    else
        echo "$response"
    fi
}

prompt_required() {
    local prompt_text="$1"
    local response

    while true; do
        read -r -p "$prompt_text: " response
        if [ -n "$response" ]; then
            echo "$response"
            return
        fi
        print_error "This field is required."
    done
}

prompt_number() {
    local prompt_text="$1"
    local min="$2"
    local max="$3"
    local response

    while true; do
        read -r -p "$prompt_text ($min-$max): " response
        if [[ "$response" =~ ^[0-9]+$ ]] && [ "$response" -ge "$min" ] && [ "$response" -le "$max" ]; then
            echo "$response"
            return
        fi
        print_error "Please enter a number between $min and $max."
    done
}

confirm() {
    local prompt_text="$1"
    local default_response="${2:-N}"
    local response

    if [ "$default_response" = "Y" ] || [ "$default_response" = "y" ]; then
        prompt_text+=" [Y/n]: "
    else
        prompt_text+=" [y/N]: "
    fi

    read -r -p "$prompt_text" response
    response="${response:-$default_response}"

    if [ "$response" = "Y" ] || [ "$response" = "y" ]; then
        return 0
    else
        return 1
    fi
}


generate_contact_email() {
    local domain="$1"
    local email

    if [ -z "$domain" ] || [ "$domain" = "localhost" ] || [[ "$domain" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        email="contact@example.com"
    else
        domain="${domain#http://}"
        domain="${domain#https://}"
        domain="${domain%%/*}"
        domain="${domain%%\?*}"

        if [[ "$domain" =~ [^.]+\.[^.]+$ ]]; then
            main_domain="${BASH_REMATCH[0]}"
        else
            main_domain="$domain"
        fi

        email="contact@$main_domain"
    fi

    echo "$email"
}

install_package() {
    if command_exists yum; then
        sudo yum install -y "$1"
    elif command_exists apt; then
        sudo apt install -y "$1"
    elif command_exists brew; then
        brew install "$1"
    else
        print_error "Package manager not found. Please install $1 manually."
        exit 1
    fi
}

add_to_hosts() {
    local IP="127.0.0.1"
    local HOSTS_FILE="/etc/hosts"
    local TEMP_HOSTS_FILE="/tmp/hosts.tmp"

    if [ "${CONFIG_MINIO_DOMAIN_NAME}" != "minio" ]; then
        return 0
    fi

    if sudo grep -q "${CONFIG_MINIO_DOMAIN_NAME}" "$HOSTS_FILE"; then
        return 0
    else
        sudo cp "$HOSTS_FILE" "$TEMP_HOSTS_FILE"
        echo "$IP ${CONFIG_MINIO_DOMAIN_NAME}" | sudo tee -a "$TEMP_HOSTS_FILE" > /dev/null
        if sudo mv "$TEMP_HOSTS_FILE" "$HOSTS_FILE"; then
            print_info "Added ${CONFIG_MINIO_DOMAIN_NAME} to $HOSTS_FILE"
        else
            print_error "Failed to update $HOSTS_FILE. Please check your permissions."
            return 1
        fi
    fi
}

check_for_docker_sudo() {
    if docker ps >/dev/null 2>&1; then
        echo "n"
    else
        echo "y"
    fi
}

read_number() {
    local number
    read -rp "$1" number

    while ! [[ $number =~ ^[0-9]+$ ]] && [ -n "$number" ] ; do
        read -rp "Please enter a valid number: " number
    done

    echo "$number"
}

read_number_range() {
    local number
    local min
    local max

    if [ "$#" -ne 3 ]; then
        number=$(read_number)
        min=$1
        max=$2
    else
        number=$(read_number "$1")
        min=$2
        max=$3
    fi

    while [[ -n "$number" && ($number -lt $min || $number -gt $max) ]]; do
        number=$(read_number "Please enter a number between $min and $max: ")
    done

    echo "$number"
}

check_if_docker_is_running() {
    if ! ${CONFIG_DOCKER_COMMAND} ps >/dev/null 2>&1; then
        print_warning "Docker is not running. Most of the commands will not work without Docker."
        print_info "Use the following command to start Docker:"
        print_color "$BLUE" "     sudo systemctl start docker"
    fi
}

# Main functions
check_existing_installation() {
    if [ -d "$NOCO_HOME" ] || ${CONFIG_DOCKER_COMMAND} ps --format '{{.Names}}' | grep -q "nocodb"; then
        if ! confirm "NocoDB is already installed. Do you want to reinstall?"; then
            management_menu
            exit 0
        fi
        ${CONFIG_DOCKER_COMMAND} compose down
        rm -rf "$NOCO_HOME"
    fi
    mkdir -p "$NOCO_HOME"
    cd "$NOCO_HOME" || exit 1
}

check_system_requirements() {
    print_info "Performing NocoDB system check and setup"

    for tool in docker wget lsof openssl; do
        if ! command_exists "$tool"; then
            print_warning "$tool is not installed. Setting up for installation..."
            if [ "$tool" = "docker" ]; then
                wget -qO- https://get.docker.com/ | sh
            else
                install_package "$tool"
            fi
        fi
    done

    for port in "${REQUIRED_PORTS[@]}"; do
        if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null; then
            print_warning "Port $port is in use. Please make sure it is free."
        else
            print_info "Port $port is free."
        fi
    done

    print_success "System check completed successfully"
}

get_user_inputs() {
    CONFIG_DOMAIN_NAME=$(prompt "Enter the IP address or domain name for the NocoDB instance" "$(get_public_ip)")

    if confirm "Show Advanced Options?"; then
        get_advanced_options
    else
        set_default_options
    fi
}

get_advanced_options() {
    CONFIG_SSL_ENABLED=$(confirm "Do you want to configure SSL?" && echo "Y" || echo "N")
    CONFIG_EDITION=$(prompt "Choose Community or Enterprise Edition [CE/EE]" "CE")

    if [ "$CONFIG_EDITION" = "EE" ] || [ "$CONFIG_EDITION" = "ee" ]; then
        CONFIG_LICENSE_KEY=$(prompt_required "Enter the NocoDB license key")
    fi

    CONFIG_REDIS_ENABLED=$(confirm "Do you want to enable Redis for caching?" "Y" && echo "Y" || echo "N")
    CONFIG_MINIO_ENABLED=$(confirm "Do you want to enable Minio for file storage?" "Y" && echo "Y" || echo "N")

    if [ "$CONFIG_MINIO_ENABLED" = "Y" ] || [ "$CONFIG_MINIO_ENABLED" = "y" ]; then
        CONFIG_MINIO_DOMAIN_NAME=$(prompt "Enter the MinIO domain name" "localhost")
        CONFIG_MINIO_SSL_ENABLED=$(confirm "Do you want to configure SSL for MinIO?" && echo "Y" || echo "N")
    fi

    CONFIG_WATCHTOWER_ENABLED=$(confirm "Do you want to enable Watchtower for automatic updates?" "Y" && echo "Y" || echo "N")

    NUM_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 1)
    CONFIG_NUM_INSTANCES=$(prompt_number "How many instances of NocoDB do you want to run?" 1 "$NUM_CORES")
}

set_default_options() {
    CONFIG_SSL_ENABLED="N"
    CONFIG_EDITION="CE"
    CONFIG_REDIS_ENABLED="Y"
    CONFIG_MINIO_ENABLED="Y"
    CONFIG_MINIO_DOMAIN_NAME="localhost"
    CONFIG_MINIO_SSL_ENABLED="N"
    CONFIG_WATCHTOWER_ENABLED="Y"
    CONFIG_NUM_INSTANCES=1
}

generate_credentials() {
    CONFIG_POSTGRES_PASSWORD=$(generate_password)
    CONFIG_REDIS_PASSWORD=$(generate_password)
    CONFIG_MINIO_ACCESS_KEY=$(generate_password)
    CONFIG_MINIO_ACCESS_SECRET=$(generate_password)
}

create_docker_compose_file() {

  image="nocodb/nocodb:latest"

  if [ "${CONFIG_EDITION}" = "EE" ] || [ "${CONFIG_EDITION}" = "ee" ]; then
    image="nocodb/ee:latest"
  fi

    local compose_file="docker-compose.yml"

    cat > "$compose_file" <<EOF
version: '3'
services:
  nocodb:
    image: ${image}
    env_file: docker.env
    deploy:
      mode: replicated
      replicas: ${CONFIG_NUM_INSTANCES}
    depends_on:
      - db
      ${CONFIG_REDIS_ENABLED:+- redis}
      ${CONFIG_MINIO_ENABLED:+- minio}
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
      - "traefik.enable=true"
      - "traefik.http.routers.nocodb.rule=Host(\`${CONFIG_DOMAIN_NAME}\`)"
      - "traefik.http.routers.nocodb.entrypoints=${CONFIG_SSL_ENABLED:+websecure}"
      ${CONFIG_SSL_ENABLED:+- "traefik.http.routers.nocodb.tls=true"}
      ${CONFIG_SSL_ENABLED:+- "traefik.http.routers.nocodb.tls.certresolver=letsencrypt"}
    networks:
      - nocodb-network

  db:
    image: postgres:16.1
    env_file: docker.env
    volumes:
      - ./postgres:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
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
      ${CONFIG_SSL_ENABLED:+- "--entrypoints.websecure.address=:443"}
      ${CONFIG_SSL_ENABLED:+- "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"}
      ${CONFIG_SSL_ENABLED:+- "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"}
      ${CONFIG_SSL_ENABLED:+- "--certificatesresolvers.letsencrypt.acme.email=$(generate_contact_email "${CONFIG_DOMAIN_NAME}")"}
      ${CONFIG_SSL_ENABLED:+- "--certificatesresolvers.letsencrypt.acme.storage=/etc/letsencrypt/acme.json"}
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

    if [ "${CONFIG_REDIS_ENABLED}" = "Y" ]; then
        cat >> "$compose_file" <<EOF
  redis:
    image: redis:latest
    restart: unless-stopped
    env_file: docker.env
    command: redis-server --requirepass "\$\${REDIS_PASSWORD}"
    volumes:
      - redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - nocodb-network

EOF
    fi

    if [ "${CONFIG_MINIO_ENABLED}" = "Y" ]; then
        cat >> "$compose_file" <<EOF
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
      - "traefik.http.routers.minio.rule=Host(\`${CONFIG_MINIO_DOMAIN_NAME}\`)"
      - "traefik.http.routers.minio.entrypoints=${CONFIG_MINIO_SSL_ENABLED:+websecure}"
      ${CONFIG_MINIO_SSL_ENABLED:+- "traefik.http.routers.minio.tls=true"}
      ${CONFIG_MINIO_SSL_ENABLED:+- "traefik.http.routers.minio.tls.certresolver=letsencrypt"}
    networks:
      - nocodb-network

EOF
    fi

    if [ "${CONFIG_WATCHTOWER_ENABLED}" = "Y" ]; then
        cat >> "$compose_file" <<EOF
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

    cat >> "$compose_file" <<EOF
volumes:
  ${CONFIG_REDIS_ENABLED:+redis:}

networks:
  nocodb-network:
    driver: bridge
EOF
}

create_env_file() {
    local env_file="docker.env"
    local encoded_password
    encoded_password=$(urlencode "${CONFIG_POSTGRES_PASSWORD}")

    cat > "$env_file" <<EOF
POSTGRES_DB=nocodb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${CONFIG_POSTGRES_PASSWORD}
EOF

    if [ "${CONFIG_EDITION}" = "EE" ] || [ "${CONFIG_EDITION}" = "ee" ]; then
        echo "DATABASE_URL=postgres://postgres:${encoded_password}@db:5432/nocodb" >> "$env_file"
        echo "NC_LICENSE_KEY=${CONFIG_LICENSE_KEY}" >> "$env_file"
    else
        echo "NC_DB=pg://db:5432?d=nocodb&user=postgres&password=${encoded_password}" >> "$env_file"
    fi

    if [ "${CONFIG_REDIS_ENABLED}" = "Y" ]; then
        cat >> "$env_file" <<EOF
REDIS_PASSWORD=${CONFIG_REDIS_PASSWORD}
NC_REDIS_URL=redis://:${CONFIG_REDIS_PASSWORD}@redis:6379/0
EOF
    fi

    if [ "${CONFIG_MINIO_ENABLED}" = "Y" ]; then
        cat >> "$env_file" <<EOF
MINIO_ROOT_USER=${CONFIG_MINIO_ACCESS_KEY}
MINIO_ROOT_PASSWORD=${CONFIG_MINIO_ACCESS_SECRET}
NC_S3_BUCKET_NAME=nocodb
NC_S3_REGION=us-east-1
NC_S3_ACCESS_KEY=${CONFIG_MINIO_ACCESS_KEY}
NC_S3_ACCESS_SECRET=${CONFIG_MINIO_ACCESS_SECRET}
NC_S3_FORCE_PATH_STYLE=true
EOF
        if [ "${CONFIG_MINIO_SSL_ENABLED}" = "Y" ]; then
            echo "NC_S3_ENDPOINT=https://${CONFIG_MINIO_DOMAIN_NAME}" >> "$env_file"
        else
            echo "NC_S3_ENDPOINT=http://${CONFIG_MINIO_DOMAIN_NAME}:9000" >> "$env_file"
        fi
    fi
}

create_update_script() {
    cat > ./update.sh <<EOF
#!/bin/bash
${CONFIG_DOCKER_COMMAND} compose pull
${CONFIG_DOCKER_COMMAND} compose up -d --force-recreate
${CONFIG_DOCKER_COMMAND} image prune -a -f
EOF
    chmod +x ./update.sh
    message_arr+=("Update script: update.sh")
}

start_services() {
    ${CONFIG_DOCKER_COMMAND} compose pull
    ${CONFIG_DOCKER_COMMAND} compose up -d

    echo 'Waiting for Traefik to start...'
    sleep 5
}

display_completion_message() {
    if [ -n "${CONFIG_DOMAIN_NAME}" ]; then
        if [ "${CONFIG_SSL_ENABLED}" = "Y" ]; then
            message_arr+=("NocoDB is now available at https://${CONFIG_DOMAIN_NAME}")
        else
            message_arr+=("NocoDB is now available at http://${CONFIG_DOMAIN_NAME}")
        fi
    else
        message_arr+=("NocoDB is now available at http://localhost")
    fi

    print_box_message "${message_arr[@]}"
}

management_menu() {
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

start_service() {
    echo -e "\nStarting nocodb..."
    ${CONFIG_DOCKER_COMMAND} compose up -d
}

stop_service() {
    echo -e "\nStopping nocodb..."
    ${CONFIG_DOCKER_COMMAND} compose stop
}

restart_service() {
    echo -e "\nRestarting nocodb..."
    ${CONFIG_DOCKER_COMMAND} compose restart
}

upgrade_service() {
    echo -e "\nUpgrading nocodb..."
    ${CONFIG_DOCKER_COMMAND} compose pull
    ${CONFIG_DOCKER_COMMAND} compose up -d --force-recreate
    ${CONFIG_DOCKER_COMMAND} image prune -a -f
}

scale_service() {
    num_cores=$(nproc || sysctl -n hw.ncpu || echo 1)
    current_scale=$(${CONFIG_DOCKER_COMMAND} compose ps -q nocodb | wc -l)
    echo -e "\nCurrent number of instances: $current_scale"
    echo "How many instances of NocoDB do you want to run (Maximum: ${num_cores}) ? (default: 1): "
    scale_num=$(read_number_range 1 "$num_cores")

    if [ "$scale_num" -eq "$current_scale" ]; then
        echo "Number of instances is already set to $scale_num. Returning to main menu."
        return
    fi

    ${CONFIG_DOCKER_COMMAND} compose up -d --scale nocodb="$scale_num"
}

monitoring_service() {
    echo -e '\nLoading stats...'
    trap ' ' INT
    ${CONFIG_DOCKER_COMMAND} stats
}

main() {
    CONFIG_DOCKER_COMMAND=$([ "$(check_for_docker_sudo)" = "y" ] && echo "sudo docker" || echo "docker")

    check_existing_installation
    check_system_requirements
    get_user_inputs
    generate_credentials
    create_docker_compose_file
    create_env_file
    create_update_script
    start_services
    display_completion_message

    if confirm "Do you want to start the management menu?"; then
        management_menu
    fi
}

main "$@"