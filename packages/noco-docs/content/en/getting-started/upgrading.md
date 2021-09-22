---
title: 'Upgrading'
description: 'Upgrading NocoDB : Docker, npm, Heroku!'
position: 2
category: 'Getting started'
menuTitle: 'Upgrading'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---

## Docker
### Find, stop & delete nocodb docker container 
```
docker ps

docker stop YOUR_CONTAINER_ID"

docker rm YOUR_CONTAINER_ID"
```

### Find & remove nocodb docker image
```
docker images

docker rmi YOUR_IMAGE_ID
```

### Pull the latest nocodb image with same environment variables
```
docker run -d -p 8080:8080 \
    -e NC_DB="YOUR_NC_DB_URL" \
    -e NC_AUTH_JWT_SECRET="YOUR_NC_AUTH_JWT_SECRET_IF_GIVEN" \
    nocodb/nocodb:0.11.33
```

Updating nocodb docker container is similar to updating [any other docker container](https://www.whitesourcesoftware.com/free-developer-tools/blog/update-docker-images/).
 
### Example docker upgrade
![Screen Shot 2021-09-16 at 09 23 07](https://user-images.githubusercontent.com/5435402/133578984-53c6b96b-3e8b-4a96-b6c2-36f3c09ffdde.png)



## Node 

Updating docker container is similar to updating a npm package.

From your root folder 

#### Uninstall nocodb package
```bash
npm uninstall nocodb
```
#### Install nocodb package
```bash
npm install --save nocodb
```


## Heroku

Use Heroku CLI login

```
heroku container:login
docker pull nocodb/nocodb:0.11.33
docker tag nocodb/nocodb:0.11.33 registry.heroku.com/<Heroku App Name>/web
docker push registry.heroku.com/<Heroku App Name>/web
heroku container:release -a <Heroku App Name> web
```


