#!/usr/bin/env bash

###########################################################################
## this script is targeted at novice users, and is a thin wrapper around ##
## our aio container image, if you know how to use docker, you can       ##
## directly run the image                                                ##
###########################################################################

state_dir="${PWD:-.}/nocodb/"
env_store="$state_dir/upstall/upstall.env"
container_name="nocodb-aio-upstall"
container_image="nocodb/nocodb:latest"
version="0.1"

err() {
	# usage: err "message"

	printf "\033[31;1merr: %b\033[0m\n" "$1"
	command -v "notify-send" 1>/dev/null &&
		notify-send "nocodb upstall error" "$1"
}

trim() {
	# usage: trim "string"
	: "${1:?}"

	_trimstr="${1#"${1%%[![:space:]]*}"}"
	_trimstr="${_trimstr%"${_trimstr##*[![:space:]]}"}"

	echo "$_trimstr"
}

prompt_required() {
	# usage: prompt_required "prompt" [response_regex]
	prompt_text="$1"
	regex="$2"

	while true; do
		read -r -p "$prompt_text: " response

		if [ -n "$regex" ]; then
			if echo "$response" | grep -Eq "$regex"; then
				return
			else
				err "your input '$response' is invalid"
				continue
			fi
		fi

		if [ -n "$response" ]; then
			return
		fi

		err "this field is required."
	done
}

prompt_oneof() {
	# usage: prompt_oneof "prompt" default_response resp2 resp3 ...
	prompt_text="$1"
	default_response="$2"
	shift 1

	prompt_text+=" ? (default: $default_response) "
	oneof_text="["
	for one in "$@"; do
		oneof_text+="$one,"
	done
	oneof_text="${oneof_text%%,}]"
	prompt_text+="$oneof_text: "

	while true; do
		read -r -p "$prompt_text" response
		if [ -z "$response" ]; then
			response="$default_response"
			return
		fi

		for one in "$@"; do
			resp_upper="$(echo "$response" | tr '[:lower:]' '[:upper:]')"
			one_upper="$(echo "$one" | tr '[:lower:]' '[:upper:]')"
			if [ "$resp_upper" = "$one_upper" ]; then
				response="$one"
				return
			fi
		done

		err "this field should be one of $oneof_text"
	done
}

ensure_command() {
	# usage: ensure_command command
	if command -v "$1" 1>/dev/null; then
		return 0
	elif command -v yum 1>/dev/null; then
		sudo yum install -y "$1"
	elif command -v apt 1>/dev/null; then
		sudo apt install -y "$1"
	elif command -v pacman 1>/dev/null; then
		sudo pacman -S --noconfirm "$1"
	elif command -v brew 1>/dev/null; then
		brew install "$1"
	else
		err "package manager not found. please install $1 manually"
		exit 1
	fi
}

env_read() {
	# usage: env_read
	mkdir -p "$(dirname "$env_store")"
	touch "$env_store"
	# shellcheck disable=SC1090
	. "$env_store"

	if [ -z "$nc_aio_minio_enable" ]; then
		prompt_oneof "enable minio" N Y
		if [ "$response" = "Y" ]; then
			nc_aio_minio_enable=true
		else
			nc_aio_minio_enable=false
		fi
	fi

	if [ -z "$nc_aio_postgres_enable" ]; then
		prompt_oneof "enable postgres" Y N
		if [ "$response" = "Y" ]; then
			nc_aio_postgres_enable=true
		else
			nc_aio_postgres_enable=false
		fi
	fi

	if [ -z "$nc_aio_redis_enable" ]; then
		prompt_oneof "enable redis" Y N
		if [ "$response" = "Y" ]; then
			nc_aio_redis_enable=true
		else
			nc_aio_redis_enable=false
		fi
	fi

	if [ -z "$nc_aio_ssl_enable" ]; then
		prompt_oneof "enable ssl" Y N
		if [ "$response" = "Y" ]; then
			nc_aio_ssl_enable=true
		else
			nc_aio_ssl_enable=false
		fi

		if [ -z "$nc_aio_ssl_domain" ]; then
			prompt_required "your domain" ".*\..*"
			nc_aio_ssl_domain="$response"
		fi
		if [ -z "$nc_aio_ssl_email" ]; then
			prompt_required "your email" ".*@.*\..*"
			nc_aio_ssl_email="$response"
		fi
	fi

	cat <<-EOF >"$env_store"
		nc_aio_minio_enable="$nc_aio_minio_enable"
		nc_aio_postgres_enable="$nc_aio_minio_enable"
		nc_aio_redis_enable="$nc_aio_minio_enable"
		nc_aio_ssl_enable="$nc_aio_minio_enable"
		nc_aio_ssl_email="$nc_aio_minio_enable"
		nc_aio_ssl_domain="$nc_aio_minio_enable"
	EOF
}

nocodb_run() {
	# usage: nocodb_run
	container_name="$(docker ps -q -f name="$container_name")"
	if [ -n "$container_name" ]; then
		return 0
	fi

	if nc_aio_ssl_enable; then
		_port_opts="-p 80:80 -p 443:443 "
	else
		_port_opts="-p 80:8080"
	fi

	docker run \
		--name "$container_name" \
		-d \
		--env-file "$env_store" \
		-v "$state_dir":/usr/app/data \
		"$_port_opts" \
		"$container_image"
}

menu() {
	# usage: menu

	while true; do
		cat <<-EOF

			######################################
			## upstall menu (version: $version)      ##
			######################################
			## 1) start nocodb                  ##
			## 2) stop nocodb                   ##
			## 3) view logs                     ##
			## 4) delete nocodb                 ##
			## 5) update nocodb                 ##
			## 6) exit                          ##
			######################################
		EOF
		prompt_oneof "option" 1 2 3 4

		case "$response" in
		1) nocodb_run ;;
		2) docker stop "$container_name" ;;
		3) docker logs "$container_name" ;;
		4)
			docker stop "$container_name"
			rm -rf "$state_dir"
			exit 0
			;;
		5)
			docker pull "$container_name"
			docker stop "$container_name"
			nocodb_run
			;;
		6) exit 0 ;;
		*) err "option not implemented" ;;
		esac
	done

}

########
# MAIN #
########

ensure_command docker
env_read
nocodb_run
menu
