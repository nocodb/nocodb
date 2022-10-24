---
title: 'Dashboard'
description: 'Accessing the Dashboard!'
position: 500
category: 'Product'
menuTitle: 'Dashboard'
---

## Setup Your First Super Admin

Once you have started NocoDB, you can visit the dashboard via `example.com`. You will be redirected to `example.com/#/signup`. 

Enter your work email and your password.

<img width="1492" alt="image" src="https://user-images.githubusercontent.com/35857179/194793294-fa027496-c3c3-44eb-a613-2ba3e3bd26c1.png">

<alert id="password-conditions">
  Your password has at least 8 letters with one uppercase, one number and one special letter
</alert>

## Initialize Your First Project

Once you have logged into NocoDB, you should see `My Projects`.

<img width="1494" alt="image" src="https://user-images.githubusercontent.com/35857179/194793424-c4451bf5-1486-46cf-b62f-86fc6d788d77.png">

To create a project, you can click `New Project`. You can choose create an empty project or a project connecting to an external database.
    
<img width="1492" alt="image" src="https://user-images.githubusercontent.com/35857179/194793457-e18e1112-2b44-4efc-8d98-5261a83a150c.png">

### Creating Empty Project

Click `Create Project`, you need to specify the project name. The data will be stored in `NC_DB`. If it is not specified, a local SQLite will be created and used.

<alert>
NC_DB is an environment variable used to store the meta data in the given database.
</alert>

<img width="1496" alt="image" src="https://user-images.githubusercontent.com/35857179/194793478-a4c20517-1c38-474d-8905-d1d3da560136.png">

### Connecting to External Database

Click `Create By Connecting To An External Database`, you need to specify the project name, API type, and other database parameters.

<alert type="success">
Tip: If you are running NocoDB on Docker and your local DB is running on your host machine, your Host Address would be host.docker.internal instead of localhost.
</alert>

<img width="1500" alt="image" src="https://user-images.githubusercontent.com/35857179/194793497-3b740bf2-ffc7-48bf-836e-e4cd26631568.png">

Currently it supports MySQL, Postgres, MSSQL and SQLite.

You can also configure associated SSL & advanced parameters.

<img width="689" alt="image" src="https://user-images.githubusercontent.com/35857179/189047293-05176c44-e162-495a-a7cd-e02377c1f42c.png">

<alert type="success">
Tip: You can click Edit Connection JSON and modify SSL settings in "ssl".
</alert>

```json
{
  "client": "pg",
  "connection": {
    "host": "<YOUR_HOST>",
    "port": "5432",
    "user": "<YOUR_DB_USER>",
    "password": "<YOUR_DB_PASSWORD>",
    "database": "<YOUR_DB_NAME>",
    "ssl": {
      "require": true,
      "rejectUnauthorized": false,
      "sslMode": "no-verify"
    }
  }
}
```

<alert type="success">
Tip: You can click Edit Connection JSON and specify the schema you want to use in "searchPath".
</alert>

```json
{
  "client": "pg",
  "connection": {
    ...
  },
  "searchPath": [ "<YOUR_TARGET_SCHEMA>" ]
}
```

Click `Test Database Connection` to see if the connection can be established or not. NocoDB creates a new **empty database** with specified parameters if the database doesn't exist.

<img width="505" alt="image" src="https://user-images.githubusercontent.com/35857179/194793513-feabf14f-1f62-4896-b06d-88548251511a.png">
