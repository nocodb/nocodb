---
title: 'Sync Schema'
description: 'Schema changes made to database from outside nocodb GUI can be synced'
position: 610
category: 'Product'
menuTitle: 'Sync Schema'
---

## How to sync schema changes to NocoDB

NocoDB allows you to sync schema changes if you have made changes outside NocoDB GUI. However, it has to be noted then you will have to bring your own schema migrations for moving from environment to others.

Below are the steps to sync schema changes.

### 1. From the menu bar, click `Team & Settings`

![image](https://user-images.githubusercontent.com/35857179/161902474-fd06678c-a171-4237-b171-dc028b3753de.png)

### 2. Click `Project Metadata` under SETTINGS

![image](https://user-images.githubusercontent.com/35857179/161905030-6c5deef7-3a3d-4e71-8763-88e57586e5b4.png)

### 3. Under `Metadata` tab, click on `Metadata` sub tab

![image](https://user-images.githubusercontent.com/35857179/161956928-95d3646c-5ae4-4562-8a65-5e36a63e3c2a.png)

### 4. Changes carried outside GUI, identified by NocoDB are listed under `Sync state`

![image](https://user-images.githubusercontent.com/35857179/161957119-f66f22ad-9d37-45ed-84ca-35c99726078c.png)

### 5. Click `Sync Now` to complete Schema sync procedure

![image](https://user-images.githubusercontent.com/35857179/161957228-de6b0a50-0a0f-4d3d-8624-585a28851ad7.png)

#### Notes

1. Column rename operation will be treated like `column delete` & `column create` operation.
2. Only table schema changes identified will be listed under `Sync state`. Any changes to records are automatically synchronized.





