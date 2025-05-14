{
  writeTextDir,
  mailcap,
  frontend,
}:

writeTextDir "etc/nginx.conf" ''
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
          ssl_early_data on;

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
                  server_name localhost ;
                  root ${frontend}/share/www ;
          }
  }
''
