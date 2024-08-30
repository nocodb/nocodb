# Install full stack nocodb with Docker (compose)

This page provides instructions to install nocodb full stack using Docker. The installation will run multiple contianers in single node. 

## Prerequisites
Before you begin, ensure you have the following prerequisites:

- Docker (version 20.10.7 or later)
- Docker-Compose (version 2.17.3 or later)
- Ports 80 and 443 are available 

TIP: you could simply run ./pre-req-check.sh from this directory which will check.

## Install 
Run install.sh, This script performs pre-requisite check, prompts you through required application properties and finally performs `docker-compose up -d`. 
Note: For most cases where any external integration is not required. The defaults properties are just fine. 
```
./install.sh 
```
* At this point, your installation is completed and you should be able to access your nocodb instance *


### An example output will be like below. 
```
```


## Data and Conf directories
This directory acts as the NC_INSTALL_ROOT by default and it will have data, conf directories which are `.gitingore` to avoid accidentlly exposing to git. 

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


## Read below, if you wish to understand what does install.sh do
install script performs the following steps
1. pre-req-check.sh and warns if there is anything missing which could potentially cause issues at later stage. However it will let you proceed if you wish to.
2. create application properties file under conf dir which will then be used for future upgrades etc.
3. runs docker-compose up -d

##





