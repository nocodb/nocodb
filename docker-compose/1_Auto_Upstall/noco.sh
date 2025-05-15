#!/usr/bin/env bash

if [ "$1" == '--debug' ]; then
	set -x
fi

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
CONFIG_POSTGRES_SQLITE=""

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

print_note() {
	local note_text="$1"
	local note_color='\033[0;33m' # Yellow color
	local bold='\033[1m'
	local reset='\033[0m'

	echo -e "${note_color}${bold}NOTE:${reset} ${note_text}"
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

is_valid_domain() {
	local domain_regex="^([a-zA-Z0-9]([-a-zA-Z0-9]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([-a-zA-Z0-9]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}$"
	[[ "$1" =~ $domain_regex ]]
}

urlencode() {
	local string="$1"
	local strlen=${#string}
	local encoded=""
	local pos c o

	for ((pos = 0; pos < strlen; pos++)); do
		c=${string:$pos:1}
		case "$c" in
		[-_.~a-zA-Z0-9]) o="$c" ;;
		*) printf -v o '%%%02X' "'$c" ;;
		esac
		encoded+="$o"
	done
	echo "$encoded"
}

generate_password() {
	openssl rand -base64 48 | tr -dc 'a-zA-Z0-9_+*' | head -c 32
}

get_public_ip() {
	local ip

	if command -v dig >/dev/null 2>&1; then
		ip=$(dig +short myip.opendns.com @resolver1.opendns.com 2>/dev/null)
		if [ -n "$ip" ]; then
			echo "$ip"
			return
		fi
	fi

	# Method 2: Using host
	if command -v host >/dev/null 2>&1; then
		ip=$(host myip.opendns.com resolver1.opendns.com 2>/dev/null | grep "myip.opendns.com has" | awk '{print $4}')
		if [ -n "$ip" ]; then
			echo "$ip"
			return
		fi
	fi

	# Method 3: Using curl
	if command -v curl >/dev/null 2>&1; then
		ip="$(curl -s -4 https://ip.me 2>/dev/null)"
		if echo "$ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
			echo "$ip"
			return
		fi
	fi

	# Method 4: Using wget
	if command -v wget >/dev/null 2>&1; then
		ip="$(wget -qO- https://ifconfig.me 2>/dev/null)"
		if echo "$ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
			echo "$ip"
			return
		fi
	fi

	# If all methods fail, return localhost
	echo "localhost"
}

get_nproc() {
	# Try to get the number of processors using nproc
	if command -v nproc &>/dev/null; then
		nproc
	else
		# Fallback: Check if /proc/cpuinfo exists and count the number of processors
		if [[ -f /proc/cpuinfo ]]; then
			grep -c ^processor /proc/cpuinfo
		# Fallback for macOS or BSD systems using sysctl
		elif command -v sysctl &>/dev/null; then
			sysctl -n hw.ncpu
		# Default to 1 processor if everything else fails
		else
			echo 1
		fi
	fi
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

prompt_oneof() {
	local response
	local resp_upper
	local oneof_text
	local prompt_text="$1"
	local default_response="$2"
	shift 1

	prompt_text+=" (default: $default_response) "
	oneof_text+="["
	for one in "$@"; do
		oneof_text+="$one,"
	done
	oneof_text="${oneof_text%%,}]"
	prompt_text+="${oneof_text}: "

	while true; do
		read -r -p "$prompt_text" response
		if [ -z "$response" ]; then
			echo "$default_response"
			return
		fi

		for one in "$@"; do
			resp_upper="$(echo "$response" | tr '[:lower:]' '[:upper:]')"
			one_upper="$(echo "$one" |  tr '[:lower:]' '[:upper:]')"
			if [ "$resp_upper" = "$one_upper" ]; then
				echo "$one"
				return
			fi
		done
		print_error "This field should be one of ${oneof_text}."
	done
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
	local secondary_response
	local response
	case "$default_response" in
	"Y") secondary_response="N" ;;
	"N") secondary_response="Y" ;;
	esac

	response="$(prompt_oneof "$prompt_text" "$default_response" "$secondary_response")"
	if [ "$response" = "Y" ]; then
		return 0
	elif [ "$response" = "N" ]; then
		return 1
	fi
}

# Function to check if input is IP address
is_ip() {
    local input="$1"
    [[ "$input" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

generate_contact_email() {
  local primary_domain="$1"
  local secondary_domain="$2"
  local email
  local domain_to_use

  # Try primary domain first
  if [ -n "$primary_domain" ] && ! is_ip "$primary_domain" && [ "$primary_domain" != "localhost" ]; then
    domain_to_use="$primary_domain"
  # Try secondary domain if primary is not valid
  elif [ -n "$secondary_domain" ] && ! is_ip "$secondary_domain" && [ "$secondary_domain" != "localhost" ]; then
    domain_to_use="$secondary_domain"
  # Fallback if neither domain is valid
  else
   echo "Warning: No valid domain found for SSL certificate email, using example.com. This may cause self-signed certificate errors in production."
   email="contact@example.com"
   echo "$email"
   return
  fi

  # Clean up the chosen domain
  domain_to_use="${domain_to_use#http://}"
  domain_to_use="${domain_to_use#https://}"
  domain_to_use="${domain_to_use%%/*}"
  domain_to_use="${domain_to_use%%\?*}"

  email="contact@$domain_to_use"
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

	if is_valid_domain $CONFIG_MINIO_DOMAIN_NAME; then
		return 0
	elif sudo grep -q "${CONFIG_MINIO_DOMAIN_NAME}" "$HOSTS_FILE"; then
		return 0
	else
		sudo cp "$HOSTS_FILE" "$TEMP_HOSTS_FILE"
		echo "$IP ${CONFIG_MINIO_DOMAIN_NAME}" | sudo tee -a "$TEMP_HOSTS_FILE" >/dev/null
		if sudo mv "$TEMP_HOSTS_FILE" "$HOSTS_FILE"; then
			print_info "Added ${CONFIG_MINIO_DOMAIN_NAME} to $HOSTS_FILE"
			print_note "You may need to reboot your system, If the uploaded attachments are not accessible."

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
	local prompt="$1"
	local default="$2"
	local number

	while true; do
		if [ -n "$default" ]; then
			read -rp "$prompt [$default]: " number
			number=${number:-$default}
		else
			read -rp "$prompt: " number
		fi

		if [ -z "$number" ]; then
			echo "Input cannot be empty. Please enter a number."
		elif ! [[ $number =~ ^[0-9]+$ ]]; then
			echo "Invalid input. Please enter a valid number."
		else
			echo "$number"
			return
		fi
	done
}

read_number_range() {
	local prompt="$1"
	local min="$2"
	local max="$3"
	local default="$4"
	local number

	while true; do
		if [ -n "$default" ]; then
			number=$(read_number "$prompt ($min-$max)" "$default")
		else
			number=$(read_number "$prompt ($min-$max)")
		fi

		if [ -z "$number" ]; then
			continue
		elif [ "$number" -lt "$min" ] || [ "$number" -gt "$max" ]; then
			echo "Please enter a number between $min and $max."
		else
			echo "$number"
			return
		fi
	done
}

print_empty_line() {
  local count=${1:-1}
  for ((i=0; i<count; i++)); do
    echo
  done
}

check_if_docker_is_running() {
	if ! $CONFIG_DOCKER_COMMAND ps >/dev/null 2>&1; then
		print_warning "Docker is not running. Most of the commands will not work without Docker."
		print_info "Use the following command to start Docker:"
		print_color "$BLUE" "     sudo systemctl start docker"
	fi
}

persistent_store_isdeleted() {
	_persistent_store="$1"

	if [ ! -d "$_persistent_store" ]; then
		print_warning "Persistent store was deleted without stopping the containers"

		for container in $($CONFIG_DOCKER_COMMAND ps | grep -Eo 'nocodb-[a-z]+-[0-9]+$'); do
			if ! $CONFIG_DOCKER_COMMAND stop "$container" > /dev/null 2>&1; then
				print_error "Failed to stop ${container}"
				exit 1
			fi
		done

		return 0
	fi

	return 1
}

# Main functions
check_existing_installation() {
	NOCO_FOUND=false

	# Check if $NOCO_HOME exists as directory
	if [ -d "$NOCO_HOME" ]; then
		NOCO_FOUND=true
	elif $CONFIG_DOCKER_COMMAND ps --format '{{.Names}}' | grep -q "nocodb"; then
		NOCO_ID="$($CONFIG_DOCKER_COMMAND ps | grep "nocodb/nocodb" | cut -d ' ' -f 1)"
		CUSTOM_HOME="$($CONFIG_DOCKER_COMMAND inspect --format='{{index .Mounts 0}}' "$NOCO_ID" | cut -d ' ' -f 3)"
		PARENT_DIR="$(dirname "$CUSTOM_HOME")"

		if ! persistent_store_isdeleted "$PARENT_DIR"; then
			ln -s "$PARENT_DIR" "$NOCO_HOME"
			basename "$PARENT_DIR" >"$NOCO_HOME/.COMPOSE_PROJECT_NAME"
			NOCO_FOUND=true
		fi
	fi
	mkdir -p "$NOCO_HOME"
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
			$CONFIG_DOCKER_COMMAND compose down -v

			unset COMPOSE_PROJECT_NAME
			cd /tmp || exit 1
			rm -rf "$NOCO_HOME"

			cd "$CURRENT_PATH" || exit 1
			mkdir -p "$NOCO_HOME"
			cd "$NOCO_HOME" || exit 1
		fi
	fi
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
  # For fixing test failures due to missing XTerm environment
  clear || :
  cat << EOF
╔════════════════════════════════════════╗
║      NocoDB AutoUpstall Assistant      ║
╚════════════════════════════════════════╝
EOF
  print_empty_line
  echo -e "${BOLD}Starting basic configuration...${NC}"
  print_empty_line

  # Domain Configuration
  CONFIG_DOMAIN_NAME=$(prompt "Enter the IP address or domain name for the NocoDB instance" "$(get_public_ip)")
  print_empty_line
  echo -e "${BLUE}→ Using domain:${NC} $CONFIG_DOMAIN_NAME"

  if is_valid_domain "$CONFIG_DOMAIN_NAME"; then
    print_empty_line
    echo -e "${GREEN}✓ Valid domain detected${NC}"
    print_empty_line
    CONFIG_SSL_ENABLED=$(prompt_oneof "Do you want to configure SSL for $CONFIG_DOMAIN_NAME" "Y" "N")
    print_empty_line
    if [ "$CONFIG_SSL_ENABLED" = "Y" ]; then
      echo -e "${BLUE}→ SSL will be enabled${NC}"
    else
      echo -e "${BLUE}→ SSL will not be enabled${NC}"
    fi
    print_empty_line
  else
    print_empty_line
    echo -e "${YELLOW}! Using IP address - SSL will not be enabled${NC}"
    print_empty_line
    CONFIG_SSL_ENABLED="N"
  fi

  # Storage Configuration
  echo -e "${BOLD}Configuring storage options...${NC}"
  print_empty_line
  CONFIG_MINIO_ENABLED=$(prompt_oneof "Do you want to enable Minio for file storage?" "Y" "N")

  if [ "$CONFIG_MINIO_ENABLED" = "Y" ]; then
    print_empty_line
    echo -e "${BLUE}→ Setting up MinIO storage configuration${NC}"

    while true; do
      print_empty_line
      CONFIG_MINIO_DOMAIN_NAME=$(prompt "Enter the MinIO domain name" "$(get_public_ip)")

      if [ "$CONFIG_MINIO_DOMAIN_NAME" = "$CONFIG_DOMAIN_NAME" ] && is_valid_domain "$CONFIG_DOMAIN_NAME"; then
        print_empty_line
        cat << EOF
⚠️  WARNING: Using the same domain name for both NocoDB and MinIO is not recommended
   This may cause routing conflicts and service accessibility issues
EOF
        print_empty_line
        if [ "$(prompt_oneof "Would you like to use a different domain for MinIO?" "Y" "N")" = "Y" ]; then
          continue
        else
          echo -e "${YELLOW}! Proceeding with same domain name - please ensure proper routing configuration${NC}"
          print_empty_line
        fi
      fi
      break
    done

    print_empty_line
    echo -e "${BLUE}→ Using MinIO domain:${NC} $CONFIG_MINIO_DOMAIN_NAME"
    print_empty_line

    # SSL Configuration for MinIO
    if [ "$CONFIG_SSL_ENABLED" = "Y" ]; then
      if ! is_valid_domain "$CONFIG_MINIO_DOMAIN_NAME"; then
        cat << EOF
⚠️  WARNING: Your MinIO domain name is not valid. File attachments will not work with SSL enabled.
EOF
        print_empty_line
        if [ "$(prompt_oneof "Would you like to update the MinIO domain name?" "Y" "N")" = "Y" ]; then
          CONFIG_MINIO_DOMAIN_NAME=$(prompt "Enter a valid domain name for MinIO" "$(get_public_ip)")
          echo -e "${BLUE}→ Updated MinIO domain to:${NC} $CONFIG_MINIO_DOMAIN_NAME"
          print_empty_line
        fi
      fi
    fi

    if is_valid_domain "$CONFIG_MINIO_DOMAIN_NAME"; then
      echo -e "${GREEN}✓ Valid MinIO domain detected${NC}"
      print_empty_line
      if [ "$CONFIG_SSL_ENABLED" = "Y" ]; then
        CONFIG_MINIO_SSL_ENABLED="Y"
        echo -e "${BLUE}→ SSL will be automatically enabled for MinIO${NC}"
        print_empty_line
      else
        CONFIG_MINIO_SSL_ENABLED=$(prompt_oneof "Do you want to configure SSL for $CONFIG_MINIO_DOMAIN_NAME" "Y" "N")
        if [ "$CONFIG_MINIO_SSL_ENABLED" = "Y" ]; then
          echo -e "${BLUE}→ SSL will be enabled for MinIO${NC}"
        else
          print_empty_line
          echo -e "${BLUE}→ SSL will not be enabled for MinIO${NC}"
        fi
        print_empty_line
      fi
    else
      print_empty_line
      echo -e "${YELLOW}! Using IP address for MinIO - SSL will not be enabled${NC}"
      print_empty_line
      CONFIG_MINIO_SSL_ENABLED="N"
    fi
  else
    print_empty_line
    echo -e "${BLUE}→ MinIO storage will not be configured${NC}"
    print_empty_line
  fi

  set_default_options

  # Advanced Configuration
  if [ "$(prompt_oneof "Show Advanced Options?" "N" "Y")" = "Y" ]; then
    print_empty_line
    cat << EOF
╔════════════════════════════════════════╗
║        Advanced Configuration          ║
╚════════════════════════════════════════╝
EOF
    print_empty_line
    get_advanced_options
  else
    print_empty_line
  fi

  # Configuration Summary
  print_empty_line 2
  cat << EOF
╔════════════════════════════════════════╗
║         Configuration Summary          ║
╚════════════════════════════════════════╝
EOF
  print_empty_line
  echo -e "${BOLD}NocoDB Domain:${NC} $CONFIG_DOMAIN_NAME"
  echo -e "${BOLD}NocoDB SSL:${NC} $CONFIG_SSL_ENABLED"
  if [ "$CONFIG_MINIO_ENABLED" = "Y" ]; then
    echo -e "${BOLD}MinIO Domain:${NC} $CONFIG_MINIO_DOMAIN_NAME"
    echo -e "${BOLD}MinIO SSL:${NC} $CONFIG_MINIO_SSL_ENABLED"
  fi
  print_empty_line
  echo -e "${GREEN}✓ Configuration complete!${NC}"
  print_empty_line
}

get_advanced_options() {
  CONFIG_EDITION=$(prompt_oneof "Choose Community or Enterprise Edition" "CE" "EE")

	if [ "$CONFIG_EDITION" = "EE" ]; then
		CONFIG_LICENSE_KEY=$(prompt_required "Enter the NocoDB license key")
	else
		CONFIG_POSTGRES_SQLITE=$(prompt_oneof "Select PostgreSQL or SQLite as your database" "P" "S")
	fi

	CONFIG_REDIS_ENABLED=$(prompt_oneof "Do you want to enable Redis for caching?" "Y" "N")
	CONFIG_WATCHTOWER_ENABLED=$(prompt_oneof "Do you want to enable Watchtower for automatic updates?" "Y" "N")

	NUM_CORES=$(get_nproc)
	CONFIG_NUM_INSTANCES=$(read_number_range "How many instances of NocoDB do you want to run?" 1 "$NUM_CORES" 1)
}

set_default_options() {
	CONFIG_EDITION="CE"
	CONFIG_POSTGRES_SQLITE="P"
	CONFIG_REDIS_ENABLED="Y"
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

	if [ "${CONFIG_EDITION}" = "EE" ]; then
		image="nocodb/nocodb-ee:latest"
	else
		image="nocodb/nocodb:latest"
	fi

	# for easier string interpolation
	if [ "${CONFIG_REDIS_ENABLED}" = "Y" ]; then
		gen_redis=1
	fi
	if [ "${CONFIG_MINIO_ENABLED}" = "Y" ]; then
		gen_minio=1
	fi
	if [ "${CONFIG_POSTGRES_SQLITE}" = "P" ]; then
		gen_postgres=1
	fi

	local compose_file="docker-compose.yml"

	cat >"$compose_file" <<EOF
services:
  nocodb:
    image: ${image}
    env_file: docker.env
    deploy:
      mode: replicated
      replicas: ${CONFIG_NUM_INSTANCES}
EOF

	if [ -n "$gen_postgres" ] || [ -n "$gen_redis" ] || [ "$gen_redis" ]; then
		cat >>"$compose_file" <<EOF
    depends_on:
      ${gen_postgres:+- db}
      ${gen_redis:+- redis}
      ${gen_minio:+- minio}
EOF
	fi

	cat >>"$compose_file" <<EOF
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
      - "traefik.enable=true"
      - "traefik.http.routers.nocodb.rule=Host(\`${CONFIG_DOMAIN_NAME}\`)"
EOF
	# IF SSL is Enabled add the following lines
	if [ "$CONFIG_SSL_ENABLED" = "Y" ]; then
		cat >>"$compose_file" <<EOF

      - "traefik.http.routers.nocodb.entrypoints=websecure"
      - "traefik.http.routers.nocodb.tls=true"
      - "traefik.http.routers.nocodb.tls.certresolver=letsencrypt"
EOF
		# If no ssl just configure the web entrypoint
	else
		cat >>"$compose_file" <<EOF
      - "traefik.http.routers.nocodb.entrypoints=web"
EOF
	fi
	# Continue with the compose file
	cat >>"$compose_file" <<EOF
    networks:
      - nocodb-network
EOF

  # If the edition is EE, add worker service to the compose file
	if [ "$CONFIG_EDITION" = "EE" ]; then
		cat >>"$compose_file" <<EOF
  worker:
    image: ${image}
    env_file: docker.env
    environment:
      - NC_WORKER_CONTAINER=true
    networks:
      - nocodb-network
EOF

	  if [ -n "$gen_postgres" ] || [ -n "$gen_redis" ] || [ "$gen_redis" ]; then
		  cat >>"$compose_file" <<EOF
    depends_on:
      ${gen_postgres:+- db}
      ${gen_redis:+- redis}
      ${gen_minio:+- minio}
EOF
  	fi

    cat >>"$compose_file" <<EOF
    restart: unless-stopped
    volumes:
      - ./nocodb:/usr/app/data
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
EOF
	fi

	if [ "$CONFIG_POSTGRES_SQLITE" = "P" ]; then
		cat >>"$compose_file" <<EOF
  db:
    image: postgres:16.6
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
EOF
	fi

	cat >>"$compose_file" <<EOF
  traefik:
    image: traefik:v3.1
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--providers.docker.exposedByDefault=false"
EOF
	# In Traefik we need to add the minio entrypoint if it is enabled
	if [ "$CONFIG_MINIO_ENABLED" = "Y" ]; then
		cat >>"$compose_file" <<EOF
      - "--entrypoints.minio.address=:9000"
EOF
	fi

	# If SSL is enabled we need to add the following lines to the traefik service
	if [ "$CONFIG_SSL_ENABLED" = "Y" ] || [ "$CONFIG_MINIO_SSL_ENABLED" = "Y" ]; then
		cat >>"$compose_file" <<EOF
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=$(generate_contact_email "$CONFIG_DOMAIN_NAME" "$CONFIG_MINIO_DOMAIN_NAME")"
      - "--certificatesresolvers.letsencrypt.acme.storage=/etc/letsencrypt/acme.json"
EOF
	fi
	# Continue with the compose file
	cat >>"$compose_file" <<EOF
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

	# If Redis is enabled add the following lines to the compose file
	if [ "${CONFIG_REDIS_ENABLED}" = "Y" ]; then
		cat >>"$compose_file" <<EOF
  redis:
    image: redis:latest
    restart: unless-stopped
    env_file: docker.env
    command:
      - /bin/sh
      - -c
      - redis-server --requirepass "\$\${REDIS_PASSWORD}"
    healthcheck:
      test: [ "CMD", "redis-cli", "-a", "\$\${REDIS_PASSWORD}", "--raw", "incr", "ping" ]
    volumes:
      - ./redis:/data
    networks:
      - nocodb-network
EOF
	fi

	# IF Minio is enabled add the following lines to the compose file
	if [ "${CONFIG_MINIO_ENABLED}" = "Y" ]; then
		cat >>"$compose_file" <<EOF
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
EOF
		# If minio SSL is enabled, set the entry point to websecure
		if [ "$CONFIG_MINIO_SSL_ENABLED" = "Y" ]; then
			cat >>"$compose_file" <<EOF
      - "traefik.http.routers.minio.entrypoints=websecure"
      - "traefik.http.routers.minio.tls=true"
      - "traefik.http.routers.minio.tls.certresolver=letsencrypt"
EOF
			# If minio is enabled and the domain is valid, set the entry point to web
		elif is_valid_domain "$CONFIG_MINIO_DOMAIN_NAME"; then
			cat >>"$compose_file" <<EOF
      - "traefik.http.routers.minio.entrypoints=web"
EOF

			# If minio is enabled, valid domain name is not configured, set the entry point to Port 9000
		else
			cat >>"$compose_file" <<EOF
      - "traefik.http.routers.minio.entrypoints=minio"
EOF
		fi
		cat >>"$compose_file" <<EOF
    networks:
      - nocodb-network

EOF
	fi
	if [ "${CONFIG_WATCHTOWER_ENABLED}" = "Y" ]; then
		cat >>"$compose_file" <<EOF
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

	if [ "$CONFIG_REDIS_ENABLED" = "Y" ]; then
		cat >>"$compose_file" <<EOF
volumes:
    redis:
EOF
	fi

	cat >>"$compose_file" <<EOF
networks:
  nocodb-network:
    driver: bridge
EOF
}

create_env_file() {
	local env_file="docker.env"
	local encoded_password
	encoded_password=$(urlencode "${CONFIG_POSTGRES_PASSWORD}")
	ENCODED_REDIS_PASSWORD=$(urlencode "$CONFIG_REDIS_PASSWORD")
	cat >"$env_file" <<EOF
POSTGRES_DB=nocodb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${CONFIG_POSTGRES_PASSWORD}
EOF

	if [ "${CONFIG_EDITION}" = "EE" ]; then
		echo "DATABASE_URL=postgres://postgres:${encoded_password}@db:5432/nocodb" >>"$env_file"
		echo "NC_LICENSE_KEY=${CONFIG_LICENSE_KEY}" >>"$env_file"
	elif [ "${CONFIG_POSTGRES_SQLITE}" = "P" ]; then
		echo "NC_DB=pg://db:5432?d=nocodb&user=postgres&password=${encoded_password}" >>"$env_file"
	fi

	if [ "${CONFIG_REDIS_ENABLED}" = "Y" ]; then
		cat >>"$env_file" <<EOF
REDIS_PASSWORD=${CONFIG_REDIS_PASSWORD}
NC_REDIS_URL=redis://:${ENCODED_REDIS_PASSWORD}@redis:6379/0
EOF

		# If the edition is EE, configure the redis job URL and throttler redis
		if [ "${CONFIG_EDITION}" = "EE" ]; then
			cat >>"$env_file" <<EOF
NC_REDIS_JOB_URL=redis://:${ENCODED_REDIS_PASSWORD}@redis:6379/1
NC_THROTTLER_REDIS=redis://:${ENCODED_REDIS_PASSWORD}@redis:6379/2
EOF
		fi
	fi

	if [ "${CONFIG_MINIO_ENABLED}" = "Y" ]; then
		cat >>"$env_file" <<EOF
MINIO_ROOT_USER=${CONFIG_MINIO_ACCESS_KEY}
MINIO_ROOT_PASSWORD=${CONFIG_MINIO_ACCESS_SECRET}
NC_S3_BUCKET_NAME=nocodb
NC_S3_REGION=us-east-1
NC_S3_ACCESS_KEY=${CONFIG_MINIO_ACCESS_KEY}
NC_S3_ACCESS_SECRET=${CONFIG_MINIO_ACCESS_SECRET}
NC_S3_FORCE_PATH_STYLE=true
EOF
		if [ "$CONFIG_MINIO_SSL_ENABLED" = "Y" ]; then
			echo "NC_S3_ENDPOINT=https://${CONFIG_MINIO_DOMAIN_NAME}" >>"$env_file"
		elif is_valid_domain "$CONFIG_MINIO_DOMAIN_NAME"; then
			echo "NC_S3_ENDPOINT=http://${CONFIG_MINIO_DOMAIN_NAME}" >>"$env_file"
		else
			echo "NC_S3_ENDPOINT=http://${CONFIG_MINIO_DOMAIN_NAME}:9000" >>"$env_file"
		fi
	fi
}

create_update_script() {
	cat >./update.sh <<EOF
#!/bin/bash
$CONFIG_DOCKER_COMMAND compose pull
$CONFIG_DOCKER_COMMAND compose up -d --force-recreate
$CONFIG_DOCKER_COMMAND image prune -a -f
EOF
	chmod +x ./update.sh
	message_arr+=("Update script: update.sh")
}

start_services() {
	$CONFIG_DOCKER_COMMAND compose pull
	$CONFIG_DOCKER_COMMAND compose up -d
  print_empty_line
  print_empty_line
	echo 'Waiting for Traefik to start...'
	print_empty_line

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

  print_empty_line
	print_box_message "${message_arr[@]}"
	print_empty_line
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
	$CONFIG_DOCKER_COMMAND compose up -d
}

stop_service() {
	echo -e "\nStopping nocodb..."
	$CONFIG_DOCKER_COMMAND compose stop
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
		container_id=$($CONFIG_DOCKER_COMMAND compose ps | grep "$1-$replica_choice" | cut -d " " -f 1)
		$CONFIG_DOCKER_COMMAND logs -f "$container_id"
	elif [ "$replica_choice" == "A" ] || [ "$replica_choice" == "a" ]; then
		$CONFIG_DOCKER_COMMAND compose logs -f "$1"
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
	done < <($CONFIG_DOCKER_COMMAND compose ps --services)

	service_replicas=()
	count=0

	# For each service, count the number of running instances
	for service in "${services[@]}"; do
		# Count the number of lines that have the service name, which corresponds to the number of replicas
		replicas=$($CONFIG_DOCKER_COMMAND compose ps "$service" | grep -c "$service")
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
		service_index=$((log_choice - 1))
		service="${services[$service_index]}"
		num_replicas="${service_replicas[$service_index]}"

		if [ "$num_replicas" -gt 1 ]; then
			trap 'show_logs_sub_menu "$service" "$num_replicas"' INT
			show_logs_sub_menu "$service" "$num_replicas"
			trap - INT
		else
			trap 'show_logs' INT
			$CONFIG_DOCKER_COMMAND compose logs -f "$service"
		fi
	elif [ "$log_choice" == "A" ] || [ "$log_choice" == "a" ]; then
		trap 'show_logs' INT
		$CONFIG_DOCKER_COMMAND compose logs -f
	elif [ "$log_choice" == "0" ]; then
		return
	else
		show_logs
	fi

	trap - INT
}

restart_service() {
	echo -e "\nRestarting nocodb..."
	$CONFIG_DOCKER_COMMAND compose restart
}

upgrade_service() {
	echo -e "\nUpgrading nocodb..."
	$CONFIG_DOCKER_COMMAND compose pull
	$CONFIG_DOCKER_COMMAND compose up -d --force-recreate
	$CONFIG_DOCKER_COMMAND image prune -a -f
}

scale_service() {
	num_cores=$(get_nproc)
	current_scale=$($CONFIG_DOCKER_COMMAND compose ps -q nocodb | wc -l)
	echo -e "\nCurrent number of instances: $current_scale"
	scale_num=$(read_number_range "How many instances of NocoDB do you want to run?" 1 "$num_cores" 1)

	if [ "$scale_num" -eq "$current_scale" ]; then
		echo "Number of instances is already set to $scale_num. Returning to main menu."
		return
	fi

	$CONFIG_DOCKER_COMMAND compose up -d --scale nocodb="$scale_num"
}

monitoring_service() {
	echo -e '\nLoading stats...'
	trap ' ' INT
	$CONFIG_DOCKER_COMMAND stats
}

main() {
	CONFIG_DOCKER_COMMAND=$([ "$(check_for_docker_sudo)" = "y" ] && echo "sudo docker" || echo "docker")

	check_existing_installation
	check_system_requirements
	get_user_inputs
	generate_credentials
	create_docker_compose_file
	add_to_hosts
	create_env_file
	create_update_script
	start_services
	display_completion_message

	if confirm "Do you want to start the management menu?" "Y"; then
		management_menu
	fi
}

main "$@"
