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

<!-- TODO: add screenshot -->

### 2. Click `Project Metadata` under SETTINGS

<!-- TODO: add screenshot -->

### 3. Under `Metadata` tab, click on `Metadata` sub tab

<!-- TODO: add screenshot -->

### 4. Changes carried outside GUI, identified by NocoDB are listed under `Sync state`

<!-- TODO: add screenshot -->

### 5. Click `Sync Now` to complete Schema sync procedure

<!-- TODO: add screenshot -->

#### Notes

1. Column rename operation will be treated like `column delete` & `column create` operation.
2. Only table schema changes identified will be listed under `Sync state`. Any changes to records are automatically synchronized.





