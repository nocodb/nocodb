#!/bin/sh

working_dir="/usr/app/data"
nocodb_run_dir="/var/lib/nocodb"
minio_dir="/var/lib/minio/aiominionocodb"
postgres_data_dir="/var/lib/postgres/data"
migrations_dir="/var/lib/migrations"

migrate_state_set() {
	mkdir -p ${migrations_dir}
	echo "$1" > "${migrations_dir}/state"
}

migrate_from_legacy_image() {
	# this also supports rollback to legacy image
	# we can maybe change this after release
	mkdir -p "$(dirname ${nocodb_run_dir})"
	if [ -f "${working_dir}/noco.db" ]; then
		touch ${migrations_dir}/from_legacy_image_with_sqlite
	fi
	if [ -f ${working_dir}/noco.db ] || [ -d ${working_dir}/nc ]; then
		[ -e ${nocodb_run_dir} ] ||
			ln -s ${working_dir} ${nocodb_run_dir}
	fi
}

migrate_from_upstall() {
	# this also supports rollback to upstall
	# we can maybe change this after release
	mkdir -p "$(dirname ${minio_dir})"
	if [ -d ${working_dir}/minio/nocodb ] && [ ! -e ${minio_dir} ]; then
		ln -s ${working_dir}/minio/nocodb ${minio_dir}
		touch ${migrations_dir}/from_upstall_with_minio
	fi

	mkdir -p "$(dirname ${postgres_data_dir})"
	if [ -d ${working_dir}/postgres ] && [ ! -e ${postgres_data_dir} ]; then
		ln -s ${working_dir}/postgres ${postgres_data_dir}
		touch ${migrations_dir}/from_upstall_with_postgres
	fi

	mkdir -p "$(dirname ${nocodb_run_dir})"
	if [ -f ${working_dir}/nocodb/noco.db ] &&
		[ ! -f ${migrations_dir}/from_upstall_with_postgres ]; then
		touch ${migrations_dir}/from_upstall_with_sqlite
	fi

	if [ -f ${working_dir}/nocodb/noco.db ] || [ -d ${working_dir}/nocodb/nc ]; then
		[ -e ${nocodb_run_dir} ] ||
			ln -s ${working_dir}/nocodb ${nocodb_run_dir}
	fi
}

ln -s ${working_dir} /var
migrate_state_set 0

migrate_from_legacy_image
migrate_from_upstall
