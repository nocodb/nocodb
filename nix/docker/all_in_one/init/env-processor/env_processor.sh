#!/bin/sh

envs_docker_def=' HOME  HOSTNAME  OLDPWD  PATH  PORT  PWD  SHLVL TERM '
aio_env_prefix='aio_'
nocodb_env_path='/run/nocodb.env'
kernal_env_path='/run/kernalenvs'

env_passthrough() {
	for kenv in "$kernal_env_path"/*; do
		# ignore aio envs
		case "$kenv" in
		"$aio_env_prefix"*) continue ;;
		esac

		# ignore default docker envs
		case "$envs_docker_def" in
		*" $kenv "*) continue ;;
		esac

		echo "$kenv=$(cat "$kernal_env_path/$kenv")" >> "$nocodb_env_path"
	done
}

touch "$nocodb_env_path"
env_passthrough
