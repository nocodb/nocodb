# syntax=docker/dockerfile:1

###########
# Litestream Builder
###########
FROM golang:alpine3.19 as lt-builder

WORKDIR /usr/src/

RUN apk add --no-cache git make musl-dev gcc

# build litestream
RUN git clone https://github.com/benbjohnson/litestream.git litestream
RUN cd litestream && go install ./cmd/litestream
RUN cp $GOPATH/bin/litestream /usr/src/lt

###########
# Builder
###########
FROM node:18.20.4-alpine as builder
WORKDIR /usr/src/app

# install node-gyp dependencies
RUN apk add --no-cache python3 make g++

# install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy application dependency manifests to the container image.
COPY --link ./package.json ./package.json
COPY --link ./docker/main.js ./docker/main.js
COPY --link ./docker/start-litestream.sh /usr/src/appEntry/start.sh
COPY --link src/public/ ./docker/public/

# for pnpm to generate a flat node_modules without symlinks
# so that modclean could work as expected
RUN echo "node-linker=hoisted" > .npmrc

# install production dependencies,
# reduce node_module size with modclean & removing sqlite deps,
# and add execute permission to start.sh
RUN pnpm install --prod --shamefully-hoist \
    && pnpm dlx modclean --patterns="default:*" --ignore="nc-lib-gui/**,dayjs/**,express-status-monitor/**,@azure/msal-node/dist/**" --run  \
    && rm -rf ./node_modules/sqlite3/deps \
    && chmod +x /usr/src/appEntry/start.sh

##########
# Runner
##########
FROM alpine:3.20
WORKDIR /usr/src/app

ENV LITESTREAM_S3_SKIP_VERIFY=false \
    LITESTREAM_RETENTION=1440h \
    LITESTREAM_RETENTION_CHECK_INTERVAL=72h \
    LITESTREAM_SNAPSHOT_INTERVAL=24h \
    LITESTREAM_SYNC_INTERVAL=60s \
    NC_DOCKER=0.6 \
    NC_TOOL_DIR=/usr/app/data/ \
    NODE_ENV=production \
    PORT=8080

RUN apk add --update --no-cache \
    dasel \
    dumb-init \
    nodejs

# Copy litestream binary and config file
COPY --link --from=lt-builder /usr/src/lt /usr/local/bin/litestream
COPY --link ./docker/litestream.yml /etc/litestream.yml
# Copy production code & main entry file
COPY --link --from=builder /usr/src/app/ /usr/src/app/
COPY --link --from=builder /usr/src/appEntry/ /usr/src/appEntry/

EXPOSE 8080
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start Nocodb
CMD ["/usr/src/appEntry/start.sh"]
