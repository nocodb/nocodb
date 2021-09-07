---
title: 'Upgrading'
description: 'Upgrading NocoDB : Docker, npm, Heroku!'
position: 2
category: 'Getting started'
menuTitle: 'Upgrading'
link: https://codesandbox.io/embed/vigorous-firefly-80kq5?hidenavigation=1&theme=dark
---

## Docker
Updating nocodb docker container is similar to updating [any other docker container](https://www.whitesourcesoftware.com/free-developer-tools/blog/update-docker-images/).

Usually this involves the following
- Find the nocodb image
- Stop the nocodb docker container
- Remove the nocodb docker container
- Pull & Run the latest nocodb docker container

_*Please ensure you run latest docker container with same environment variables as before.*_





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
docker pull nocodb/nocodb:latest
docker tag nocodb/nocodb:latest registry.heroku.com/<Heroku App Name>/web
docker push registry.heroku.com/<Heroku App Name>/web
heroku container:release -a <Heroku App Name> web
```


