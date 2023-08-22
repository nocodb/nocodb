---
title: 'Dashboard'
description: 'Accessing the Dashboard!'
position: 500
category: 'Product'
menuTitle: 'Dashboard'
---

## Setup Your First Account : Super Admin

Once you have started NocoDB, you can visit the dashboard via `example.com`. You will be redirected to `example.com/#/signup`. 

Enter your work email and your password.

![signup](https://github.com/nocodb/nocodb/assets/86527202/f424f935-fef2-4080-8b67-3f6f1bd95c65)

<alert id="password-conditions">
  Your password has at least 8 letters. No other constraints on case, numbers or special characters.
</alert>

On signup, landing page has a default project & a table created for you to quickly get started

![landing page](https://github.com/nocodb/nocodb/assets/86527202/cd09dbeb-f5e1-42e6-92bb-abd4b3ab48bf)

## Initialize Your First Project

Once you have logged into NocoDB, you should see `My Projects`.

![Screenshot 2022-12-29 at 2 54 43 PM](https://user-images.githubusercontent.com/86527202/209932699-743ffea2-986f-443f-8198-f56b597de706.png)
<!-- <img width="1494" alt="image" src="https://user-images.githubusercontent.com/35857179/194793424-c4451bf5-1486-46cf-b62f-86fc6d788d77.png"> -->

To create a new project, you can click `New Project`. 
<!-- <img width="1492" alt="image" src="https://user-images.githubusercontent.com/35857179/194793457-e18e1112-2b44-4efc-8d98-5261a83a150c.png"> -->

You need to specify the project name. The data will be stored in `NC_DB`. If it is not specified, a local SQLite will be created and used.

<alert>
NC_DB is an environment variable used to store the meta data in the given database.
</alert>

![Screenshot 2022-12-29 at 2 54 57 PM](https://user-images.githubusercontent.com/86527202/209932936-8fe7334c-1a94-4073-ba19-478efb620808.png)
<!-- <img width="1496" alt="image" src="https://user-images.githubusercontent.com/35857179/194793478-a4c20517-1c38-474d-8905-d1d3da560136.png"> -->

### Connecting to External Database

Click on three-dot menu adjacent to `BASES`. Pick required database option from the menu `Connect to new datasource`. 

<alert type="success">
Tip: If you are running NocoDB on Docker and your local DB is running on your host machine, your Host Address would be host.docker.internal instead of localhost. If you use a docker-compose.yml file and your local DB is running on another container, your Host Address would be the name of the database service, for instance 'root_db' for a configuration like this: https://github.com/nocodb/nocodb/blob/aa48f50823269d5e0f3eea57f4d67cfa5d311d58/docker-compose/pg/docker-compose.yml#L15)
</alert>

![Screenshot 2022-12-29 at 2 55 39 PM](https://user-images.githubusercontent.com/86527202/209933294-9327ff16-21db-4aca-bf16-8cea8a1eb415.png)
  


