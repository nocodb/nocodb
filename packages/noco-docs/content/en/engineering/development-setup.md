---
title: "Development setup"
description: "How to setup your development environment"
position: 3200
category: "Engineering"
menuTitle: "Development setup"
---

### Clone the repo
```
git clone https://github.com/nocodb/nocodb
cd nocodb/packages
```

### Build SDK
```
# build nocodb-sdk
cd nocodb-sdk
npm install
npm run build
```

### Build Backend
```
# build backend - runs on port 8080
cd ../nocodb
npm install
npm run watch:run
```

### Build Frontend
```
# build frontend - runs on port 3000
cd ../nc-gui
npm install
npm run dev 
```

Any changes made to frontend and backend will be automatically reflected in the browser.

### Cypress

```shell
# install dependencies(cypress)
npm install
# run mysql database with required database using docker compose
docker-compose -f ./scripts/docker-compose-cypress.yml up
# Run backend api using following command
npm run start:api
# Run frontend web UI using following command
npm run start:web
# wait until both 3000 and 8080 ports are available
# and run cypress test using following command
npm run cypress:run
# or run following command to run it with GUI
npm run cypress:open
```