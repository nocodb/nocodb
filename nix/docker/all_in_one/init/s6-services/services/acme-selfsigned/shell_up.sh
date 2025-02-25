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
		--domains "$aio_ssl_domain"

	cp _ca/cert.pem "$aio_ssl_domain"/chain.pem
	cat "$aio_ssl_domain"/cert.pem "$aio_ssl_domain"/chain.pem > "$aio_ssl_domain"/fullchain.pem
	cat "$aio_ssl_domain"/key.pem "$aio_ssl_domain"/fullchain.pem > "$aio_ssl_domain"/full.pem

	touch "$aio_ssl_domain"/selfsigned
}

[ -d "$aio_ssl_domain" ] || gen_selfsigned
