#!/bin/sh -e

working_dir="/var/lib/acme"

# setup by ../../../env-processor
. /run/acme.dynamic.env

mkdir -p "$working_dir"
cd "$working_dir"

gen_selfsigned() {
	mkdir -p _ca

	minica \
		--ca-key _ca/key.pem \
		--ca-cert _ca/cert.pem \
		--domains "$nc_aio_ssl_domain"

	cp _ca/cert.pem "$nc_aio_ssl_domain"/chain.pem
	cat "$nc_aio_ssl_domain"/cert.pem "$nc_aio_ssl_domain"/chain.pem > "$nc_aio_ssl_domain"/fullchain.pem
	cat "$nc_aio_ssl_domain"/key.pem "$nc_aio_ssl_domain"/fullchain.pem > "$nc_aio_ssl_domain"/full.pem

	touch "$nc_aio_ssl_domain"/selfsigned
}

[ -d "$nc_aio_ssl_domain" ] || gen_selfsigned
