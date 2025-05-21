{
  writeTextDir,
  mailcap,
}:
writeTextDir "etc/nginx.sed.conf" ''
  pid /run/nginx/nginx.pid;
  error_log stderr;
  daemon off;

  events {
  }

  http {
          # Load mime types and configure maximum size of the types hash tables.
          include ${mailcap}/etc/nginx/mime.types;
          types_hash_max_size 2688;
          default_type application/octet-stream;

          # optimisation
          sendfile on;
          tcp_nopush on;
          tcp_nodelay on;
          keepalive_timeout 65;

          # ssl
          ssl_protocols TLSv1.2 TLSv1.3;
          ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-CHACHA20-POLY1305;
          # Keep in sync with https://ssl-config.mozilla.org/#server=nginx&config=intermediate
          ssl_session_timeout 1d;
          ssl_session_cache shared:SSL:10m;
          # Breaks forward secrecy: https://github.com/mozilla/server-side-tls/issues/135
          ssl_session_tickets off;
          # We don't enable insecure ciphers by default, so this allows
          # clients to pick the most performant, per https://github.com/mozilla/server-side-tls/issues/260
          ssl_prefer_server_ciphers off;
          # OCSP stapling
          ssl_stapling on;
          ssl_stapling_verify on;

          # brotli
          brotli on;
          brotli_static on;
          brotli_comp_level 5;
          brotli_window 512k;
          brotli_min_length 256;
          brotli_types application/atom+xml application/geo+json application/javascript application/json application/ld+json application/manifest+json application/rdf+xml application/vnd.ms-fontobject application/wasm application/x-rss+xml application/x-web-app-manifest+json application/xhtml+xml application/xliff+xml application/xml font/collection font/otf font/ttf image/bmp image/svg+xml image/vnd.microsoft.icon text/cache-manifest text/calendar text/css text/csv text/javascript text/markdown text/plain text/vcard text/vnd.rim.location.xloc text/vtt text/x-component text/xml;

          # gzip
          gzip on;
          gzip_static on;
          gzip_vary on;
          gzip_comp_level 5;
          gzip_min_length 256;
          gzip_proxied expired no-cache no-store private auth;
          gzip_types application/atom+xml application/geo+json application/javascript application/json application/ld+json application/manifest+json application/rdf+xml application/vnd.ms-fontobject application/wasm application/x-rss+xml application/x-web-app-manifest+json application/xhtml+xml application/xliff+xml application/xml font/collection font/otf font/ttf image/bmp image/svg+xml image/vnd.microsoft.icon text/cache-manifest text/calendar text/css text/csv text/javascript text/markdown text/plain text/vcard text/vnd.rim.location.xloc text/vtt text/x-component text/xml;
          proxy_redirect          off;
          proxy_connect_timeout   60s;
          proxy_send_timeout      60s;
          proxy_read_timeout      60s;
          proxy_http_version      1.1;

          # don't let clients close the keep-alive connection to upstream. See the nginx blog for details:
          # https://www.nginx.com/blog/avoiding-top-10-nginx-configuration-mistakes/#no-keepalives
          proxy_set_header        "Connection" "";

          client_max_body_size 0;
          server_tokens off;

          server {
                  listen 0.0.0.0:80 ;
                  listen [::0]:80 ;
                  server_name __nocodb_domain__ ;

                  location / {
                          return 301 https://$host$request_uri;
                  }

                  location ^~ /.well-known/acme-challenge/ {
                          root /var/lib/acme/_acme-challenge;
                          auth_basic off;
                          auth_request off;
                  }
          }

          server {
                  listen 0.0.0.0:443 ssl ;
                  listen [::0]:443 ssl ;
                  server_name __nocodb_domain__ ;
                  http2 on;
                  proxy_buffering off;
                  proxy_request_buffering off;

                  ssl_certificate /var/lib/acme/__nocodb_domain__/fullchain.pem;
                  ssl_certificate_key /var/lib/acme/__nocodb_domain__/key.pem;
                  ssl_trusted_certificate /var/lib/acme/__nocodb_domain__/chain.pem;

                  location ^~ /.well-known/acme-challenge/ {
                          root /var/lib/acme/_acme-challenge;
                          auth_basic off;
                          auth_request off;
                  }

                  location /aiominionocodb {
                          proxy_pass http://127.0.0.1:9000;

                          # recommended proxy headers
                          proxy_set_header        Host $host;
                          proxy_set_header        X-Real-IP $remote_addr;
                          proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
                          proxy_set_header        X-Forwarded-Proto $scheme;
                          proxy_set_header        X-Forwarded-Host $host;
                          proxy_set_header        X-Forwarded-Server $host;
                  }

                  location / {
                          proxy_pass http://127.0.0.1:8080;

                          # recommended proxy headers
                          proxy_set_header        Host $host;
                          proxy_set_header        X-Real-IP $remote_addr;
                          proxy_set_header        X-Forwarded-For $proxy_add_x_forwarded_for;
                          proxy_set_header        X-Forwarded-Proto $scheme;
                          proxy_set_header        X-Forwarded-Host $host;
                          proxy_set_header        X-Forwarded-Server $host;
                  }
          }
  }
''
