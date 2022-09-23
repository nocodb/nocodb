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

<img width="1485" alt="image" src="https://user-images.githubusercontent.com/35857179/189030350-89a4d361-1f0c-495f-bb03-4958dc5eb556.png">

<alert id="password-conditions">
  Your password has at least 8 letters with one uppercase, one number and one special letter
</alert>

## Initialize Your First Project

Once you have logged into NocoDB, you should see `My Projects`.

<img width="1482" alt="image" src="https://user-images.githubusercontent.com/35857179/189045961-0801accb-e07f-42cd-b679-cab5c3cab8a6.png">

To create a project, you can click `New Project`. You can choose create an empty project or a project connecting to an external database.
    
<img width="1497" alt="image" src="https://user-images.githubusercontent.com/35857179/189046071-113c424f-c908-4bb6-99f1-a4447337f1fc.png">

### Creating Empty Project

Click `Create Project`, you need to specify the project name. The data will be stored in `NC_DB`. If it is not specified, a local SQLite will be created and used.

<alert>
NC_DB is an environment variable used to store the meta data in the given database.
</alert>

<img width="1499" alt="image" src="https://user-images.githubusercontent.com/35857179/189047000-e2f9cf80-fe85-4a79-9e34-76b8a28d66ec.png">

### Connecting to External Database

Click `Create By Connecting To An External Database`, you need to specify the project name, API type, and other database parameters.

<alert type="success">
Tip: If you are running NocoDB on Docker and your local DB is running on your host machine, your Host Address would be host.docker.internal instead of localhost.
</alert>

<img width="1500" alt="image" src="https://user-images.githubusercontent.com/35857179/189047070-7600d2f9-bec5-47ed-948e-c6da46202e9c.png">

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

<img width="632" alt="image" src="https://user-images.githubusercontent.com/35857179/189048167-0725c306-12d3-4c5c-91a9-55b0aa63732d.png">
