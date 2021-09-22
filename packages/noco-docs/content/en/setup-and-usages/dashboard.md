---
title: 'Dashboard'
description: 'Dashboard'
position: 10
category: 'Usage'
menuTitle: 'Dashboard'
---

## Setup your first super admin

Once you have started NocoDB, you can visit the dashboard via ``example.com/dashboard``. 

Click ``Let's Begin`` button to sign up. 

![image](https://user-images.githubusercontent.com/35857179/126597128-f88df6e5-7625-4208-9817-68e9303410ff.png)

Enter your work email and your password.

<alert>
  Your password has at least 8 letters with one uppercase, one number and one special letter
</alert>

![image](https://user-images.githubusercontent.com/35857179/126597144-0343b5ca-c7ca-47a4-926d-4e8df2f8c161.png)

If you start your application without specifying ``NC_DB``. A local SQLite will be created in root folder. Your data will be stored there. 

If you are using Docker, it is recommended to mount ``/usr/app/data/`` for persistent volume (since ``v0.10.6``), otherwise your data will be lost after recreating the container.

Example:

```
docker run -d -p 8080:8080 --name foo -v /local/path:/usr/app/data/ nocodb/nocodb:latest
```

## Initialize your first project 

Once you have logged into NocoDB, you should see ``My Projects``.

![image](https://user-images.githubusercontent.com/35857179/126597182-b74cadb4-e165-417e-9e95-9a3cb7dce8e5.png)

To create a project, you can click ``New Project``. 

![image](https://user-images.githubusercontent.com/35857179/126597208-0b6e8162-5088-4825-bcb2-f2b0574a74c2.png)

If you click ``Create``, you need to specify the project name and API type. A local SQLite will be used.

![image](https://user-images.githubusercontent.com/35857179/126597259-b9552c71-d13b-463c-abc2-0f3be31627b2.png)

If you click ``Create By Connecting To An external Datbase``, you need to specify the project name, API type, and several database parameters.

![image](https://user-images.githubusercontent.com/35857179/126597279-c1722d8b-c885-4e9e-9e94-44711102af20.png)

Currently it supports MySQL, Postgres, MSSQL and SQLite.

![image](https://user-images.githubusercontent.com/35857179/126597320-fd6b19a9-ed3e-4f4a-80b7-880a79a54a11.png)

You can also specify SSL & advanced parameters.

![image](https://user-images.githubusercontent.com/35857179/126597342-0c61ab15-a112-4269-8f30-78455fa09081.png)

Click ``Test Database Connection`` to see if the connection can be established or not.

