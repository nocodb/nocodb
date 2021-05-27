FROM alpine:3.12

#ENV AWS_ACCESS_KEY_ID=
#ENV AWS_SECRET_ACCESS_KEY=
#ENV AWS_BUCKET=



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

ENV PORT 8080
ENV NODE_ENV=dev
#ENV TOOL_DIR=/tool
ENV NC_VERSION=0.6

# Create and change to the app directory.
WORKDIR /usr/src/appTemp

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this separately prevents re-running npm install on every code change.
#COPY ./build/ ./build/
COPY ./docker/main.js ./docker/main.js
COPY ./package.json ./
COPY ./docker/start-litestream.sh /usr/src/appEntry/start.sh
COPY ./litestream/litestream /usr/src/appEntry/litestream

# Install production dependencies.
#RUN npm i ../xc-lib-gui/ && npm install --cache=/usr/src/app/cache --production && npx modclean  --patterns="default:*" --run && rm -rf /usr/src/app/cache && rm -rf /root/.npm
RUN apk --update --no-cache add \
    	nodejs \
    	nodejs-npm \
    	tar\
   && npm install --cache=/usr/src/app/cache --production \
    && npx modclean --patterns="default:*" --ignore="xc-lib-gui/**,dayjs/**,express-status-monitor/**" --run  \
    && rm -rf ./node_modules/sqlite3/deps \
    && rm -rf ./node_modules/xc-lib-gui/lib/dist/_nuxt \
    && rm -rf /usr/src/app/cache && rm -rf /root/.npm \
   && apk del nodejs-npm \
   && tar -czf ../appEntry/app.tar.gz ./* ; rm -rf ./* && chmod +x /usr/src/appEntry/start.sh


#COPY ./node_modules/xc-lib/ ./node_modules/xc-lib/
#COPY ./node_modules/xc-lib-gui/ ./node_modules/xc-lib-gui/
WORKDIR /usr/src/app

# Run the web service on container startup.
#CMD [ "node", "docker/index.js" ]
ENTRYPOINT ["sh", "/usr/src/appEntry/start.sh"]







