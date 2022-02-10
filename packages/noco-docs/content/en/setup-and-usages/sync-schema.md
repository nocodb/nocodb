---
title: 'Sync Schema'
description: 'Schema changes made to database from outside nocodb GUI can be synced'
position: 610
category: 'Product'
menuTitle: 'Sync Schema'
---

## How to sync schema changes to NocoDB.
NocoDB allows you to sync schema changes if you have made changes outside NocoDB GUI. However, it has to be noted then you will have to bring your own
schema migrations for moving from environment to other.

Below are the steps to sync schema changes.
1. Under `Settings` menubar, click `Project Metadata`
2. Under `Meta Management` tab, click on `Metadata` sub tab.
3. Changes carried outside GUI, identified by NocoDB are listed under `Sync state`
4. Click `Sync Now` to complete Schema sync procedure.  

![metasync](https://user-images.githubusercontent.com/86527202/147923717-630f0e0f-7c7a-431c-a50d-8f9376a06eb7.png)

## Note
1. Column rename operation will be treated like 'column delete' & 'column create' operation
2. Only table schema changes identified will be listed under `Sync state`; any changes to records are automatically synchronized.





