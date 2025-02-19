#!/bin/sh

envs_docker_def=' HOME  HOSTNAME  OLDPWD  PATH  PORT  PWD  SHLVL TERM '
aio_env_prefix='aio_'
nocodb_env_path='/run/nocodb.env'
kernal_env_store_dir="/run/kernelenvs"

aio_postgres_enable=true
aio_minio_enable=true

env_passthrough() {
	for key in "$kernal_env_store_dir"/*; do
		# ignore aio envs
		case "$key" in
		"$aio_env_prefix"*) continue ;;
		esac

		# ignore default docker envs
		case "$envs_docker_def" in
		*" $key "*) continue ;;
		esac

		value="$(cat "$kernal_env_store_dir/$key")"
	done
}

env_aio_set() {
	for key in "$kernal_env_store_dir"/*; do
		case "$key" in
		"$aio_env_prefix"*) : ;;
		*) continue ;
		esac
		value="$(cat "$kernal_env_store_dir/$key")"

		case "$key" in
		aio_postgres_enable) aio_postgres_enable="$value" ;;
		aio_minio_enable) aio_minio_enable="$value" ;;
		*) echo env processor: ignoring unknown env "$key"
		esac
	done
}

env_aio_act() {
	# TODO
	"$aio_postgres_enable" &&
		:

	"$aio_minio_enable" &&
		:
}

##########
## MAIN ##
##########

touch "$nocodb_env_path"

s6-dumpenv "$kernal_env_store_dir"
env_passthrough
env_aio_set
env_aio_act
