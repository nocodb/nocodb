#!/bin/sh

reindex_if_exists() {
	psql -U postgres <<-EOF
		REINDEX DATABASE postgres;
		ALTER DATABASE postgres REFRESH COLLATION VERSION;
	EOF

	for db in "$@"; do
		if ! psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then
			continue
		fi

		echo reindexing "$db"
		psql -U postgres <<-EOF
			\c $db
			REINDEX DATABASE $db;
			ALTER DATABASE $db REFRESH COLLATION VERSION;
		EOF
	done

}

reindex_if_exists nocodb template1
