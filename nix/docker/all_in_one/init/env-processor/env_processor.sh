#!/bin/sh

envs_docker_def=' HOME  HOSTNAME  OLDPWD  PATH  PORT  PWD  SHLVL TERM '
aio_env_prefix='aio_'

nocodb_env_common_path='/run/nocodb.common.dynamic.env'
nocodb_env_main_path='/run/nocodb.main.dynamic.env'
nocodb_env_worker_path='/run/nocodb.worker.dynamic.env'
acme_env_path='/run/acme.dynamic.env'
minio_env_path='/run/minio.dynamic.env'

aio_pass_dynamic="$({
	tr -dc A-Za-z </dev/urandom | head -c 16
	:
})"
kernal_env_store_dir="/run/kernelenvs"
s6_services_temp_path='/run/s6-service-temp'
migrations_dir="/var/lib/migrations"

_aio_postgres_enable_default=true
_aio_valkey_enable_default=true
_aio_worker_enable_default=false
_aio_minio_enable_default=false
_aio_ssl_enable_default=false
_aio_ssl_domain_default="localhost"

log() {
	echo env processor: "$@"
}

env_passthrough() {
	for file in "$kernal_env_store_dir"/*; do
		key="$(basename "$file")"

		case "$key" in
		"_") continue ;;
		# passthrough aio envs
		"$aio_env_prefix"_pass_main_*)
			echo "${key#aio_pass_main_}=$(cat "$file")" >>"$nocodb_env_main_path"
		;;
		"$aio_env_prefix"_pass_worker_*)
			echo "${key#aio_pass_worker_}=$(cat "$file")" >>"$nocodb_env_worker_path"
		;;
		# ignore other aio envs
		"$aio_env_prefix"*) continue ;;
		esac

		# ignore default docker envs
		case "$envs_docker_def" in
		*" $key "*) continue ;;
		esac

		echo "$key=$(cat "$file")" >>"$nocodb_env_common_path"
	done
}

env_aio_set() {
	for file in "$kernal_env_store_dir"/*; do
		key="$(basename "$file")"

		case "$key" in
		"$aio_env_prefix"*) : ;;
		*) continue ;;
		esac
		value="$(cat "$file")"

		case "$key" in
		aio_postgres_enable) aio_postgres_enable="$value" ;;
		aio_minio_enable) aio_minio_enable="$value" ;;
		aio_ssl_enable) aio_ssl_enable="$value" ;;
		aio_ssl_domain) aio_ssl_domain="$value" ;;
		aio_ssl_email) aio_ssl_email="$value" ;;
		aio_valkey_enable) aio_valkey_enable="$value" ;;
		aio_worker_enable) aio_worker_enable="$value" ;;
		*) log ignoring unknown aio env "$key=$value" ;;
		esac
	done

	if [ "${aio_postgres_enable+set}" != set ]; then
		# keep backward compatiblity with legacy nocodb image
		if [ ! -f "$migrations_dir/from_legacy_image_with_sqlite" ] &&
			[ ! -f /"$kernal_env_store_dir"/DATABASE_URL ] &&
			[ ! -f /"$kernal_env_store_dir"/NC_DB_JSON ] &&
			[ ! -f /"$kernal_env_store_dir"/NC_DB ]; then
			aio_postgres_enable="$_aio_postgres_enable_default"
		else
			aio_postgres_enable=false
		fi
	fi
	if [ "${aio_valkey_enable+set}" != set ]; then
		if [ ! -f /"$kernal_env_store_dir"/NC_REDIS_URL ]; then
			aio_valkey_enable="$_aio_valkey_enable_default"
		else
			aio_valkey_enable=false
		fi
	fi

	if [ "${aio_minio_enable+set}" != set ]; then
		aio_minio_enable="$_aio_minio_enable_default"
	fi
	if [ "${aio_ssl_enable+set}" != set ]; then
		aio_ssl_enable="$_aio_ssl_enable_default"
	fi
	if [ "${aio_worker_enable+set}" != set ]; then
		aio_worker_enable="$_aio_ssl_enable_default"
	fi

	if [ "${aio_ssl_domain+set}" != set ]; then
		aio_ssl_domain="$_aio_ssl_domain_default"
	fi
}

nocodb_dep_add() {
	# $1: dep

	touch "$s6_services_temp_path/nocodb-main-srv/dependencies.d/$1"
	touch "$s6_services_temp_path/nocodb-worker-srv/dependencies.d/$1"
}

env_aio_act() {
	if "$aio_postgres_enable"; then
		nocodb_dep_add postgresql

		cat <<-EOF >>"$nocodb_env_common_path"
			DATABASE_URL="postgresql:///nocodb?host=/run/postgresql&user=postgres"
		EOF

		log enabled postgresql
	fi

	if "$aio_minio_enable"; then
		nocodb_dep_add minio

		cat <<-EOF >>"$nocodb_env_common_path"
			NC_S3_BUCKET_NAME="aiominionocodb"
			NC_S3_REGION="us-east-1"
			NC_S3_ACCESS_KEY="$aio_pass_dynamic"
			NC_S3_ACCESS_SECRET="$aio_pass_dynamic"
			NC_S3_FORCE_PATH_STYLE="true"
		EOF

		if "$aio_ssl_enable"; then
			cat <<-EOF >>"$nocodb_env_common_path"
				NC_S3_ENDPOINT="https://${aio_ssl_domain}"
			EOF
		else
			cat <<-EOF >>"$nocodb_env_common_path"
				NC_S3_ENDPOINT="http://${aio_ssl_domain}"
			EOF
		fi

		cat <<-EOF >>"$minio_env_path"
			MINIO_ROOT_USER="$aio_pass_dynamic"
			MINIO_ROOT_PASSWORD="$aio_pass_dynamic"
		EOF

		log enabled minio
	fi

	if "$aio_ssl_enable"; then
		if [ "${aio_ssl_email+set}" != set ]; then
			# shellcheck disable=SC2016
			log '$aio_ssl_email must be set with $aio_ssl_enable'
			exit 1
		fi

		nocodb_dep_add acme
		cat <<-EOF >>"$acme_env_path"
			aio_ssl_email="$aio_ssl_email"
		EOF

		log enabled ssl
	fi
	cat <<-EOF >>"$acme_env_path"
		aio_ssl_domain="$aio_ssl_domain"
	EOF

	if "$aio_valkey_enable"; then
		nocodb_dep_add valkey

		cat <<-EOF >>"$nocodb_env_common_path"
			NC_REDIS_URL="redis-socket:///run/valkey/valkey.sock?database=nocodb"
		EOF

		log enabled valkey
	fi

	if "$aio_worker_enable"; then
		touch "$s6_services_temp_path/nocodb/contents.d/nocodb-worker-srv"
		nocodb_dep_add valkey

		cat <<-EOF >>"$nocodb_env_main_path"
			NC_WORKER_CONTAINER=false
		EOF

		log enabled worker
	fi
}

##########
## MAIN ##
##########

touch "$nocodb_env_common_path"
touch "$nocodb_env_main_path"
touch "$nocodb_env_worker_path"

s6-dumpenv "$kernal_env_store_dir"
env_aio_set
env_aio_act
env_passthrough
