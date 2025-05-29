#!/bin/sh

envs_docker_def=' HOME  HOSTNAME  OLDPWD  PATH  PORT  PWD  SHLVL TERM '
nc_aio_env_prefix='nc_aio_'

nocodb_env_common_path='/run/nocodb.common.dynamic.env'
nocodb_env_main_path='/run/nocodb.main.dynamic.env'
nocodb_env_worker_path='/run/nocodb.worker.dynamic.env'
acme_env_path='/run/acme.dynamic.env'
minio_env_path='/run/minio.dynamic.env'

nc_aio_pass_dynamic="$({
	tr -dc A-Za-z </dev/urandom | head -c 16
	:
})"
kernal_env_store_dir="/run/kernelenvs"
s6_services_temp_path='/run/s6-service-temp'
migrations_dir="/var/lib/migrations"

_nc_aio_worker_enable_default=false
_nc_aio_minio_enable_default=false
_nc_aio_ssl_enable_default=false
_nc_aio_ssl_domain_default="localhost"

# additional logic used
# _nc_aio_postgres_enable_default=true
# _nc_aio_redis_enable_default=true

log() {
	echo env processor: "$@"
}

env_passthrough() {
	for file in "$kernal_env_store_dir"/*; do
		key="$(basename "$file")"

		case "$key" in
		"_") continue ;;
		# passthrough nc_aio envs
		"$nc_aio_env_prefix"pass_main_*)
			echo "${key#nc_aio_pass_main_}=$(cat "$file")" >>"$nocodb_env_main_path"
		;;
		"$nc_aio_env_prefix"pass_worker_*)
			echo "${key#nc_aio_pass_worker_}=$(cat "$file")" >>"$nocodb_env_worker_path"
		;;
		"$nc_aio_env_prefix"pass_minio_*)
			echo "${key#nc_aio_pass_minio_}=$(cat "$file")" >>"$minio_env_path"
		;;
		"$nc_aio_env_prefix"pass_acme_*)
			echo "${key#nc_aio_pass_acme_}=$(cat "$file")" >>"$acme_env_path"
		;;
		# ignore other nc_aio envs
		"$nc_aio_env_prefix"*) continue ;;
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
		"$nc_aio_env_prefix"pass_main_*) continue ;;
		"$nc_aio_env_prefix"pass_worker_*) continue ;;
		"$nc_aio_env_prefix"pass_minio_*) continue ;;
		"$nc_aio_env_prefix"pass_acme_*) continue ;;
		"$nc_aio_env_prefix"*) : ;;
		*) continue ;;
		esac
		value="$(cat "$file")"

		case "$key" in
		nc_aio_postgres_enable) nc_aio_postgres_enable="$value" ;;
		nc_aio_minio_enable) nc_aio_minio_enable="$value" ;;
		nc_aio_ssl_enable) nc_aio_ssl_enable="$value" ;;
		nc_aio_ssl_domain) nc_aio_ssl_domain="$value" ;;
		nc_aio_ssl_email) nc_aio_ssl_email="$value" ;;
		nc_aio_redis_enable) nc_aio_redis_enable="$value" ;;
		nc_aio_worker_enable) nc_aio_worker_enable="$value" ;;
		*) log ignoring unknown nc_aio env "$key=$value" ;;
		esac
	done

	if [ "${nc_aio_postgres_enable+set}" != set ]; then
		# keep backward compatiblity with legacy nocodb image
		if [ ! -f "$migrations_dir/from_legacy_image_with_sqlite" ] &&
			[ ! -f /"$kernal_env_store_dir"/DATABASE_URL ] &&
			[ ! -f /"$kernal_env_store_dir"/NC_DB_JSON ] &&
			[ ! -f /"$kernal_env_store_dir"/NC_DB ]; then
			nc_aio_postgres_enable=true
		else
			nc_aio_postgres_enable=false
		fi
	fi
	if [ "${nc_aio_redis_enable+set}" != set ]; then
		if [ ! -f /"$kernal_env_store_dir"/NC_REDIS_URL ]; then
			nc_aio_redis_enable=true
		else
			nc_aio_redis_enable=false
		fi
	fi

	if [ "${nc_aio_minio_enable+set}" != set ]; then
		nc_aio_minio_enable="$_nc_aio_minio_enable_default"
	fi
	if [ "${nc_aio_ssl_enable+set}" != set ]; then
		nc_aio_ssl_enable="$_nc_aio_ssl_enable_default"
	fi
	if [ "${nc_aio_worker_enable+set}" != set ]; then
		nc_aio_worker_enable="$_nc_aio_worker_enable_default"
	fi

	if [ "${nc_aio_ssl_domain+set}" != set ]; then
		nc_aio_ssl_domain="$_nc_aio_ssl_domain_default"
	fi
}

nocodb_dep_add() {
	# $@: deps
	
	for dep in "$@"; do
		touch "$s6_services_temp_path/nocodb-main-srv/dependencies.d/$dep"
		touch "$s6_services_temp_path/nocodb-worker-srv/dependencies.d/$dep"
	done
}

env_aio_act() {
	if "$nc_aio_postgres_enable"; then
		nocodb_dep_add postgresql postgresql-db-create

		cat <<-EOF >>"$nocodb_env_common_path"
			DATABASE_URL="postgresql:///nocodb?host=/run/postgresql&user=postgres"
		EOF

		log enabled postgresql
	fi

	if "$nc_aio_minio_enable"; then
		nocodb_dep_add minio

		cat <<-EOF >>"$nocodb_env_common_path"
			NC_S3_BUCKET_NAME="nc_aiominionocodb"
			NC_S3_REGION="us-east-1"
			NC_S3_ACCESS_KEY="$nc_aio_pass_dynamic"
			NC_S3_ACCESS_SECRET="$nc_aio_pass_dynamic"
			NC_S3_FORCE_PATH_STYLE="true"
		EOF

		if "$nc_aio_ssl_enable"; then
			cat <<-EOF >>"$nocodb_env_common_path"
				NC_S3_ENDPOINT="https://${nc_aio_ssl_domain}"
			EOF
		else
			cat <<-EOF >>"$nocodb_env_common_path"
				NC_S3_ENDPOINT="http://${nc_aio_ssl_domain}"
			EOF
		fi

		cat <<-EOF >>"$minio_env_path"
			MINIO_ROOT_USER="$nc_aio_pass_dynamic"
			MINIO_ROOT_PASSWORD="$nc_aio_pass_dynamic"
		EOF

		log enabled minio
	fi

	if "$nc_aio_ssl_enable"; then
		if [ "${nc_aio_ssl_email+set}" != set ]; then
			# shellcheck disable=SC2016
			log '$nc_aio_ssl_email must be set with $nc_aio_ssl_enable'
			exit 1
		fi

		nocodb_dep_add acme
		cat <<-EOF >>"$acme_env_path"
			nc_aio_ssl_email="$nc_aio_ssl_email"
		EOF
		cat <<-EOF >>"$nocodb_env_common_path"
			NC_PUBLIC_URL="https://$nc_aio_ssl_domain"
		EOF

		log enabled ssl
	else
		cat <<-EOF >>"$nocodb_env_common_path"
			NC_PUBLIC_URL="http://$nc_aio_ssl_domain"
		EOF
	fi
	cat <<-EOF >>"$acme_env_path"
		nc_aio_ssl_domain="$nc_aio_ssl_domain"
	EOF

	if "$nc_aio_redis_enable"; then
		nocodb_dep_add redis

		cat <<-EOF >>"$nocodb_env_common_path"
			NC_REDIS_URL="redis-socket:///run/redis/redis.sock?database=nocodb"
		EOF

		log enabled redis
	fi

	if "$nc_aio_worker_enable"; then
		if [ "${nc_aio_redis_enable+set}" != set ] && [ ! -f /"$kernal_env_store_dir"/NC_REDIS_URL ]; then
			# shellcheck disable=SC2016
			log '$nc_aio_redis_enable or NC_REDIS_URL must be set for $nc_aio_worker_enable'
			exit 1
		fi

		touch "$s6_services_temp_path/nocodb/contents.d/nocodb-worker-srv"

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
