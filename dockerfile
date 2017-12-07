FROM alpine:3.7

RUN apk --update --no-cache add \
	nodejs \
	nodejs-npm

RUN mkdir -p /usr/src/{app,bin,lib}
WORKDIR /usr/src/app

# only install production deps to keep image small
COPY package.json /usr/src/app
RUN npm install --production

RUN apk del nodejs-npm

COPY index.js /usr/src/app
COPY bin/ /usr/src/app/bin
COPY lib/ /usr/src/app/lib
COPY docker-entrypoint.sh /docker-entrypoint.sh

# env 
ENV DATABASE_HOST 127.0.0.1
ENV DATABASE_USER root
ENV DATABASE_PASSWORD password
ENV DATABASE_NAME sakila

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
