#!/bin/sh -e

working_dir="/var/lib/acme/_lego"
webroot_dir="/var/lib/acme/_acme-challenge"
nginx_pid="$(cat /run/nginx/nginx.pid)"

# setup by ../../../env-processor
. /run/acme.dynamic.env

mkdir -p "$working_dir"
mkdir -p "$webroot_dir"
cd "$working_dir"


ssl_renew() {
	lego \
		--accept-tos \
		--path . \
		-d "$aio_ssl_domain" \
		--email "$aio_ssl_email" \
		--key-type ec256 \
		--http --http.webroot "$webroot_dir" --server https://acme-v02.api.letsencrypt.org/directory \
		renew \
		--no-random-sleep \
		--days 30
}

ssl_run() {
	lego \
		--accept-tos \
		--path . \
		-d "$aio_ssl_domain" \
		--email "$aio_ssl_email" \
		--key-type ec256 \
		--http --http.webroot "$webroot_dir" --server https://acme-v02.api.letsencrypt.org/directory \
		run
}

ssl_install() {
	rm -rf out
	mkdir out

	echo installing new certs for "$aio_ssl_domain"

	cp -vp certificates/"$aio_ssl_domain".crt out/fullchain.pem    
	cp -vp certificates/"$aio_ssl_domain".key out/key.pem    
	cp -vp certificates/"$aio_ssl_domain".crt out/chain.pem    
	ln -sf fullchain.pem out/cert.pem    
	cat out/key.pem out/fullchain.pem > out/full.pem    

	rm -rf /var/lib/acme/"$aio_ssl_domain"
	cp -rv out /var/lib/acme/"$aio_ssl_domain"

	kill -HUP "$nginx_pid"
}

if [ -f /var/lib/acme/"$aio_ssl_domain"/adhoc ]; then
	echo "Certificate managed by user"
	exit 0
fi

if [ ! -f certificates/"$aio_ssl_domain".crt ]; then
	ssl_run
else
	ssl_renew
fi && ssl_install
