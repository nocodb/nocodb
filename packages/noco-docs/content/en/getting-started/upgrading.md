---
title: 'Upgrading'
description: 'Upgrading NocoDB : Docker, Node and Homebrew!'
position: 20
category: 'Getting started'
menuTitle: 'Upgrading'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---

## Docker

### Find, Stop & Delete NocoDB Docker Container 

```bash
# find NocoDB container ID
docker ps
# stop NocoDB container
docker stop <YOUR_CONTAINER_ID>
# delete NocoDB container
docker rm <YOUR_CONTAINER_ID>
```

### Find & Remove NocoDB Docker Image

```bash
# find NocoDB image
docker images
# delete NocoDB image
docker rmi <YOUR_IMAGE_ID>
```

### Pull the latest NocoDB image with same environment variables

```bash
docker run -d -p 8080:8080 \
    -e NC_DB="<YOUR_NC_DB_URL>" \
    -e NC_AUTH_JWT_SECRET="<YOUR_NC_AUTH_JWT_SECRET_IF_GIVEN>" \
    nocodb/nocodb:latest
```

Updating nocodb docker container is similar to updating [any other docker containers](https://www.whitesourcesoftware.com/free-developer-tools/blog/update-docker-images/).
 
### Example: Docker Upgrade
![Screen Shot 2021-09-16 at 09 23 07](https://user-images.githubusercontent.com/5435402/133578984-53c6b96b-3e8b-4a96-b6c2-36f3c09ffdde.png)

## Node 

Updating docker container is similar to updating a npm package.

From your root folder 

#### Uninstall NocoDB package

```bash
npm uninstall nocodb
```
#### Install NocoDB package

```bash
npm install --save nocodb
```

## Homebrew

Run following commands to upgrade Homebrew Nocodb version.

```bash
# Update the local homebrew formulas
brew update
# Upgrade nocodb package
brew upgrade nocodb
```
