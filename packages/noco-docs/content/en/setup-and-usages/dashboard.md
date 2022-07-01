---
title: 'Dashboard'
description: 'Accessing the Dashboard!'
position: 500
category: 'Product'
menuTitle: 'Dashboard'
---

## Setup Your First Super Admin

Once you have started NocoDB, you can visit the dashboard via `example.com/dashboard`.

Click `Let's Begin` button to sign up.

![image](https://user-images.githubusercontent.com/35857179/163138119-be4314f9-22eb-4df6-b0af-b6990c563795.png)

Enter your work email and your password.

<alert id="password-conditions">
  Your password has at least 8 letters with one uppercase, one number and one special letter
</alert>

![image](https://user-images.githubusercontent.com/35857179/163138460-59ddd93f-a8ef-4c02-8b7b-037a53cefd77.png)

## Initialize Your First Project

Once you have logged into NocoDB, you should see `My Projects`.

![image](https://user-images.githubusercontent.com/35857179/163135335-652470ee-f69e-4b12-8884-63e8056bfce3.png)

To create a project, you can click `New Project`.  
    
![image](https://user-images.githubusercontent.com/35857179/167252813-84876756-f6a1-488a-a185-cbb09f163c5b.png)

### Creating Empty Project

Click `Create`, you need to specify the project name and API type. 

<alert>
A local SQLite will be used.
</alert>

![image](https://user-images.githubusercontent.com/35857179/163135608-5e135a73-afcd-40bb-9d26-f2970dab7143.png)

### Connecting to External Database

Click `Create By Connecting To An External Database`, you need to specify the project name, API type, and other database parameters.

<alert type="success">
Tip 1: If you are running NocoDB on Docker and your local DB is running on your host machine, your Host Address would be host.docker.internal instead of localhost.
</alert>

![image](https://user-images.githubusercontent.com/35857179/163135736-d209061e-893d-4441-aaaa-ff22a1c82ceb.png)

Currently it supports MySQL, Postgres, MSSQL and SQLite.

![image](https://user-images.githubusercontent.com/35857179/126597320-fd6b19a9-ed3e-4f4a-80b7-880a79a54a11.png)

You can also configure associated SSL & advanced parameters.

![image](https://user-images.githubusercontent.com/35857179/163135911-04e01016-0ffd-4f38-83a8-c667bd268759.png)

<alert type="success">
Tip 2: You can click Edit Connection JSON and modify SSL settings in "ssl".
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
Tip 3: You can click Edit Connection JSON and specify the schema you want to use in "searchPath".
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

![image](https://user-images.githubusercontent.com/35857179/163136039-ad521d74-6996-4173-84ba-cfc55392c3b7.png)
