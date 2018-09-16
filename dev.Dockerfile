FROM frolvlad/alpine-python2

RUN apk --update --no-cache add \
	g++ \
	make \
	nodejs \
	nodejs-npm \
	paxctl \
	&& paxctl -cm $(which node)

WORKDIR /usr/src/app

COPY package.json .
RUN npm install

COPY . .

ENTRYPOINT ["./docker-entrypoint.sh"]

CMD ["sh", "-c", "node index.js -h $DATABASE_HOST -p $DATABASE_PASSWORD -d $DATABASE_NAME -u $DATABASE_USER -n 80 -r 0.0.0.0"]
