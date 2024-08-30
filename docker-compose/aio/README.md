# Install all-in-one nocodb with Docker (compose)

This page provides instructions to install nocodb all-in-one (aio) using Docker-Compse. The installation will run multiple contianers in single node which includes
- nocodb
- postgres
- nginx
- redis

## Prerequisites
Before you begin, ensure you have the following prerequisites:

- Docker (version 20.10.7 or later)
- Docker-Compose (version 2.17.3 or later)
- Ports 80 and 443 are available 

TIP: you could simply run [./pre-req-check.sh](./pre-req-check.sh) which performs pre-requisite check.

## Install 
Run [install.sh](./install.sh), This script performs pre-requisite check, prompts you through required application properties and finally performs `docker-compose up -d`. 
For most cases where no external integration required. The defaults properties are just fine. 
```
sudo ./install.sh 
```
Note: sudo is required for docker to run unless you have configured docker user to be part of sudoers. If sudo is not used then you will get error `('Connection aborted.', PermissionError(13, 'Permission denied'))`

* At this point, your installation is completed and you should be able to access your nocodb instance *

### An example output will be like below. 
```
./install.sh 
** Performing nocodb system check and setup. This step may require sudo permissions
 | Checking if required tools (docker, docker-compose, jq, lsof) are installed...
 | Checking port accessibility...
 | Port 80 is free.
 | WARNING: Port 443 is in use. Please make sure it is free.
** System check completed successfully. **
** Few pre-requisites are failing. Recommend to resolve and proceed. However you could still proceed to install **
 | Press Y to continue or N to skip (Y/N)? 
Preparing environment file before install..
 | Press Y to continue with defaults or N to customise app properties (Y/N)
Backing up previous docker-compose/aio/conf/nc_properties.env file to nocodb/docker-compose/aio/conf/nc_properties.env-1707455571.bak
Environment variables written to docker-compose/aio/conf/nc_properties.env file.
Installing docker containers
```

## Data and Conf directories
This directory acts as the NC_INSTALL_ROOT by default and it will have data, conf directories which are `.gitingore` to avoid accidentlly exposing to git repository. 
During installation the default properties are configured at [nc_properties.env](./conf/nc_properties.env) which can be updated if required and restarted 

```
.
├── conf
│   └── nc_properties.env
├── data
│   ├── nginx
│   ├── nocodb
│   ├── postgres
│   └── redis
├── docker
│   └── docker-compose.yml
```


## what does install.sh do
[Install script](./install.sh) performs the following steps
1. pre-req-check.sh and warns if there is anything missing which could potentially cause issues at later stage. However it will let you proceed if you wish to.
2. create application properties file under conf dir which will then be used for future upgrades etc.
3. runs docker-compose up -d

## Advanced Operations
Refer [advanced section](./advanced.md) for advanced operations like setting up ssl, updating configurations, restarts etc
