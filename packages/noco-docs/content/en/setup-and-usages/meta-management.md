---
title: 'Meta Management'
description: 'Meta Management'
position: 15
category: 'Setup and Usages'
menuTitle: 'Meta Managements'
---

To go to the Meta Management Portal, click ``Project Metadata`` under ``Settings`` on the leftmost menu.

![image](https://user-images.githubusercontent.com/35857179/126929430-1ad086a8-0611-4f39-8c7f-580637574056.png)

## Project Metadata

The metadata is stored in meta directory in project level, database level, and API level. 

Under ``Project Metadata``, you can perform the following operations.

- Export all metadata from the meta tables to meta directory
 
- Import all metadata from the meta directory to meta tables
 
- Export project meta to zip file and download
 
- Import project meta zip file and restart

- Clear all metadata from meta tables

<alert>
  Currently the project meta can be only imported to the same DB instance. 
</alert>

## Database Metadata

Under ``DB Metadata``, You can manage your models. For example, if you do not want to expose some APIs, you can untick those under APIs here.

![image](https://user-images.githubusercontent.com/35857179/126928981-6c63499e-d4de-42e6-80fa-c7688480d0a0.png)

The relations of all tables are listed under ``Relations``.

![image](https://user-images.githubusercontent.com/35857179/126929023-dbb82353-bebf-4a44-85b9-3e4095f24b67.png)

## UI Access Control

You can control the access to each table and relation by roles. 

![image](https://user-images.githubusercontent.com/35857179/126929212-384a91c0-645f-4958-b00b-1b89105026ea.png)

![image](https://user-images.githubusercontent.com/35857179/126929223-66520c0b-9303-4a61-abf8-e7911215904d.png)

