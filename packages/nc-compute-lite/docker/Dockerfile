# nc-compute-lite: one image for both modes.
#   embedded: docker run --privileged ...              (its own Docker engine)
#   host:     docker run --network host -v /var/run/docker.sock:/var/run/docker.sock ...
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM docker:27.5.1-dind
RUN apk add --no-cache nodejs tini
WORKDIR /app
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY docker/entrypoint.sh /usr/local/bin/nc-compute-lite
EXPOSE 8430 8431
VOLUME /var/lib/docker
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/nc-compute-lite"]
