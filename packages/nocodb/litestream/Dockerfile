FROM golang:alpine3.18 as lt

WORKDIR /usr/src/

RUN apk add --no-cache git make musl-dev gcc

# build litestream
RUN git clone https://github.com/benbjohnson/litestream.git litestream
RUN cd litestream ; go install ./cmd/litestream

RUN cp $GOPATH/bin/litestream /usr/src/lt



FROM node:18.19.1-alpine as builder
WORKDIR /usr/src/app

# install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy application dependency manifests to the container image.
COPY ./package*.json ./
COPY ./docker/main.js ./docker/main.js
#COPY ./docker/start.sh /usr/src/appEntry/start.sh
COPY ./docker/start-litestream.sh /usr/src/appEntry/start.sh

# for pnpm to generate a flat node_modules without symlinks
# so that modclean could work as expected
RUN echo "node-linker=hoisted" > .npmrc

# install production dependencies,
# reduce node_module size with modclean & removing sqlite deps,
# and add execute permission to start.sh
RUN pnpm install --prod --shamefully-hoist --reporter=silent
RUN pnpm dlx modclean --patterns="default:*" --ignore="nc-lib-gui/**,dayjs/**,express-status-monitor/**" --run
RUN rm -rf ./node_modules/sqlite3/deps
RUN chmod +x /usr/src/appEntry/start.sh

FROM alpine:3.19

#WORKDIR /usr/src/
#
## Install go lang
#RUN apk add --no-cache git make musl-dev go
#
## Configure Go
#ENV GOROOT /usr/lib/go
#ENV GOPATH /go
#ENV PATH /go/bin:$PATH
#
#RUN mkdir -p ${GOPATH}/src ${GOPATH}/bin
#
## build litestream
#
#RUN git clone https://github.com/benbjohnson/litestream.git litestream
#RUN cd litestream ; go install ./cmd/litestream


# Bug fix for segfault ( Convert PT_GNU_STACK program header into PT_PAX_FLAGS )
#RUN apk --update --no-cache add paxctl \
#	&& paxctl -cm $(which node)

WORKDIR /usr/src/app

ENV LITESTREAM_S3_SKIP_VERIFY=false \
    LITESTREAM_S3_PATH=nocodb \
    LITESTREAM_RETENTION=1440h \
    LITESTREAM_RETENTION_CHECK_INTERVAL=72h \
    LITESTREAM_SNAPSHOT_INTERVAL=24h \
    LITESTREAM_SYNC_INTERVAL=60s \
    NC_DOCKER=0.6 \
    NC_TOOL_DIR=/usr/app/data/ \
    PORT=8080

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
#COPY ./build/ ./build/
#COPY ./docker/main.js ./docker/main.js
#COPY ./package.json ./

RUN apk --update --no-cache add \
    nodejs \
    tar

# Copy litestream binary and config file
COPY  --from=lt /usr/src/lt /usr/local/bin/litestream
COPY ./docker/litestream.yml /etc/litestream.yml
# Copy production code & main entry file
COPY --from=builder /usr/src/app/ /usr/src/app/
COPY --from=builder /usr/src/appEntry/ /usr/src/appEntry/


# Run the web service on container startup.
#CMD [ "node", "docker/index.js" ]
ENTRYPOINT ["sh", "/usr/src/appEntry/start.sh"]
