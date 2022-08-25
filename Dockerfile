############################################################
# Litestream Builder
############################################################
FROM golang:alpine3.14 as lt-builder

WORKDIR /usr/src/

RUN apk add --no-cache git make musl-dev gcc

# build litestream
RUN git clone https://github.com/benbjohnson/litestream.git litestream
RUN cd litestream ; go install ./cmd/litestream
RUN cp $GOPATH/bin/litestream /usr/src/lt

############################################################
# Builder - NocoDB Backend (nocodb)
############################################################
FROM node:12 as nocodb-builder
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm ci on every code change.

# Create directories
RUN mkdir -p ./packages/nocodb
RUN mkdir -p ./packages/nocodb-sdk

# Copy nocodb sdk as backend uses it locally
# TODO: just copy the built one maybe? 
COPY ./packages/nocodb-sdk ./packages/nocodb-sdk
COPY ./packages/nocodb-sdk /usr/src/nocodb-sdk
COPY ./packages/nocodb/package*.json ./packages/nocodb/
# main.js is generated after
# npm run build
# npm run docker:build
COPY ./packages/nocodb/docker/main.js ./packages/nocodb/docker/main.js
COPY ./packages/nocodb/docker/start-litestream.sh /usr/src/appEntry/start.sh

# install production dependencies,
# reduce node_module size with modclean & removing sqlite deps,
# package built code into app.tar.gz & add execute permission to start.sh

RUN cd /usr/src/app/packages/nocodb && npm i --quiet \
    && npx modclean --patterns="default:*" --ignore="nc-lib-gui/**,nc-lib-gui-v2/**,dayjs/**,express-status-monitor/**" --run  \
    && rm -rf ./node_modules/sqlite3/deps \
    && tar -czf /usr/src/appEntry/app.tar.gz ./* \
    && chmod +x /usr/src/appEntry/start.sh

############################################################
# Builder - NocoDB Frontend (nc-gui-v2)
############################################################
FROM node:17-alpine as nc-gui-builder

WORKDIR /usr/src/app

RUN mkdir -p /usr/src/app
# Create directories
RUN mkdir -p ./packages/nc-gui-v2
RUN mkdir -p ./packages/nocodb-sdk
# Copy nocodb sdk as frontend uses it locally
# TODO: just copy the built one maybe? 
COPY ./packages/nc-gui-v2/ ./packages/nc-gui-v2
COPY ./packages/nocodb-sdk/ ./packages/nocodb-sdk

RUN cd ./packages/nc-gui-v2/ && npm i && npm cache clean --force && export NODE_OPTIONS=--max_old_space_size=8192 && npm run build

############################################################
# Runner NocoDB
############################################################
FROM node:17-alpine
WORKDIR /usr/src/app

# ENV PORT 8080
# ENV NODE_ENV=production
ENV NC_DOCKER=0.6
ENV NC_TOOL_DIR=/usr/app/data/
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

RUN apk --update --no-cache add \
    nodejs \
    tar \
    dumb-init

# Copy built frontend 
COPY --from=nc-gui-builder /usr/src/app/packages/nc-gui-v2/.output/ .output/

# Copy litestream binary build
COPY --from=lt-builder /usr/src/lt /usr/src/appEntry/litestream

# Copy packaged production code & main entry file
COPY --from=nocodb-builder /usr/src/appEntry/ /usr/src/appEntry/
COPY --from=nocodb-builder /usr/src/nocodb-sdk /usr/src/nocodb-sdk

############################################################
# Start NocoDB
############################################################
# for frontend
EXPOSE 3000
# for backend 
EXPOSE 8080

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/usr/src/appEntry/start.sh"]

