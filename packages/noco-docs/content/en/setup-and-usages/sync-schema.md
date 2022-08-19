---
title: 'Sync Schema'
description: 'Schema changes made to database from outside NocoDB GUI can be synced'
position: 610
category: 'Product'
menuTitle: 'Sync Schema'
---

## How to sync schema changes to NocoDB

NocoDB allows you to sync schema changes if you have made changes outside NocoDB GUI. However, it has to be noted then you will have to bring your own schema migrations for moving from environment to others.

Below are the steps to sync schema changes.

### 1. From the menu bar, click `Team & Settings`

<img width="367" alt="image" src="https://user-images.githubusercontent.com/35857179/170426881-ba645392-24a2-4446-b501-0595a0887724.png">

### 2. Click `Project Metadata` under SETTINGS and click `Metadata`

![image](https://user-images.githubusercontent.com/35857179/170427133-09faf93f-a41c-428b-b51c-fefe3fb45d9d.png)

### 3. Changes carried outside GUI, identified by NocoDB are listed under `Sync state`

![image](https://user-images.githubusercontent.com/35857179/161957119-f66f22ad-9d37-45ed-84ca-35c99726078c.png)

### 4. Click `Sync Now` to complete Schema sync procedure

<img width="1352" alt="image" src="https://user-images.githubusercontent.com/35857179/170428004-022dd436-0c58-41c5-b5e6-89d1d3ac87b0.png">

#### Notes

1. Column rename operation will be treated like `column delete` & `column create` operation.
2. Only table schema changes identified will be listed under `Sync state`. Any changes to records are automatically synchronized.





