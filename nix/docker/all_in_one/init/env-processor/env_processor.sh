#!/bin/sh

envs_docker_def=' HOME  HOSTNAME  OLDPWD  PATH  PORT  PWD  SHLVL TERM '
aio_env_prefix='aio_'

nocodb_env_path='/run/nocodb.dynamic.env'
acme_env_path='/run/acme.dynamic.env'

kernal_env_store_dir="/run/kernelenvs"
s6_services_temp_path='/run/s6-service-temp'

_aio_postgres_enable_default=true
_aio_minio_enable_default=true
_aio_ssl_domain_default="local.local"
_aio_ssl_enable_default=false

log() {
	echo env processor: "$@"
}

env_passthrough() {
	for file in "$kernal_env_store_dir"/*; do
		key="$(basename "$file")"

		case "$key" in
		"_") continue ;;
		# ignore aio envs
		"$aio_env_prefix"*) continue ;;
		esac

		# ignore default docker envs
		case "$envs_docker_def" in
		*" $key "*) continue ;;
		esac

		echo "$key=$(cat "$file")" >> "$nocodb_env_path"
	done
}

env_aio_set() {
	for file in "$kernal_env_store_dir"/*; do
		key="$(basename "$file")"

		case "$key" in
		"$aio_env_prefix"*) : ;;
		*) continue ;
		esac
		value="$(cat "$file")"

		case "$key" in
		aio_postgres_enable) aio_postgres_enable="$value" ;;
		aio_minio_enable) aio_minio_enable="$value" ;;
		aio_ssl_enable) aio_ssl_enable="$value" ;;
		aio_ssl_domain) aio_ssl_domain="$value" ;;
		*) log ignoring unknown aio env "$key=$value"
		esac
	done

	[ "${aio_minio_enable+set}" != set ] &&
		aio_minio_enable="$_aio_minio_enable_default"
	[ "${aio_postgres_enable+set}" != set ] &&
		aio_postgres_enable="$_aio_postgres_enable_default"
	[ "${aio_ssl_enable+set}" != set ] &&
		aio_ssl_enable="$_aio_ssl_enable_default"
	[ "${aio_ssl_domain+set}" != set ] &&
		aio_ssl_domain="$_aio_ssl_domain_default"
}

env_aio_act() {
	# TODO
	if "$aio_postgres_enable"; then
		touch "$s6_services_temp_path"/nocodb-srv/dependencies.d/postgresql

		cat <<- EOF >> "$nocodb_env_path"
			NC_S3_ACCESS_KEY="minioadmin"
			NC_S3_ACCESS_SECRET="minioadmin"
			NC_S3_ENDPOINT="http://127.0.0.1:9000"
		EOF

		log enabled postgresql
	fi

	if "$aio_minio_enable"; then
		touch "$s6_services_temp_path"/nocodb-srv/dependencies.d/minio

		cat <<- EOF >> "$nocodb_env_path"
			DATABASE_URL="postgresql:///nocodb?host=/run/postgresql&user=postgres"
		EOF

		log enabled minio
	fi

	# if "$aio_ssl_enable"; then
		cat <<- EOF >> "$acme_env_path"
			aio_ssl_domain="$aio_ssl_domain"
		EOF

		log enabled ssl
	# fi
}

##########
## MAIN ##
##########

touch "$nocodb_env_path"

s6-dumpenv "$kernal_env_store_dir"
env_passthrough
env_aio_set
env_aio_act
