###########
# Litestream Builder
###########
FROM golang:alpine3.18 as lt-builder

WORKDIR /usr/src/

RUN apk add --no-cache git make musl-dev gcc

# build litestream
RUN git clone https://github.com/benbjohnson/litestream.git litestream
RUN cd litestream ; go install ./cmd/litestream

RUN cp $GOPATH/bin/litestream /usr/src/lt



###########
# Builder
###########
FROM node:18.12.1-alpine as builder
WORKDIR /usr/src/app

# install node-gyp dependencies
RUN apk add --no-cache python3 make g++

# install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy application dependency manifests to the container image.
COPY ./package.json ./package.json
COPY ./docker/main.js ./docker/main.js
#COPY ./docker/start.sh /usr/src/appEntry/start.sh
COPY ./docker/start-litestream.sh /usr/src/appEntry/start.sh
COPY src/public/ ./docker/public/

# for pnpm to generate a flat node_modules without symlinks
# so that modclean could work as expected
RUN echo "node-linker=hoisted" > .npmrc

# install production dependencies,
# reduce node_module size with modclean & removing sqlite deps,
# package built code into app.tar.gz & add execute permission to start.sh
RUN pnpm install --prod --shamefully-hoist \
    && pnpm dlx modclean --patterns="default:*" --ignore="nc-lib-gui/**,dayjs/**,express-status-monitor/**,@azure/msal-node/dist/**" --run  \
    && rm -rf ./node_modules/sqlite3/deps \
    && tar -czf ../appEntry/app.tar.gz ./* \
    && chmod +x /usr/src/appEntry/start.sh

##########
# Runner
##########
FROM alpine:3.18
WORKDIR /usr/src/app

ENV NC_DOCKER 0.6
ENV NODE_ENV production
ENV PORT 8080
ENV NC_TOOL_DIR=/usr/app/data/

RUN apk --update --no-cache add \
    nodejs \
    tar \
    dumb-init

# Copy litestream binary build
COPY --from=lt-builder /usr/src/lt /usr/src/appEntry/litestream
# Copy packaged production code & main entry file
COPY --from=builder /usr/src/appEntry/ /usr/src/appEntry/

EXPOSE 8080
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start Nocodb
CMD ["/usr/src/appEntry/start.sh"]
