---
title: 'Team & Settings > Project Metadata'
description: 'NocoDB Project Metadata'
position: 600
category: 'Product'
menuTitle: 'Team & Settings > Project Metadata'
---

Project Metadata includes Database Metadata, UI Access Control and Miscellaneous.

To access it, click the down arrow button next to Project Name on the top left side, then select `Team & Settings` and clicking `Project Metadata`.

<img width="322" alt="image" src="https://user-images.githubusercontent.com/35857179/194856648-67936db0-ee4d-4060-be3d-af9f86ef8fc6.png"> | <img width="471" alt="image" src="https://user-images.githubusercontent.com/35857179/194850848-869c69a4-e9b6-4a84-8cc0-7fd4b01eb1ad.png">
|--|--|

<!-- ## Project Metadata

The metadata is stored in meta directory in project level, database level, and API level.

Under ``Project Metadata``, you can perform the following operations.

- Export all metadata from the meta tables to meta directory
 
- Import all metadata from the meta directory to meta tables
 
- Export project meta to zip file and download
 
- Import project meta zip file and restart

- Clear all metadata from meta tables

<alert>
  Import won't work with zip files exported from the older version of apps (< 0.11.6). <br> 
  Import / Export will only transfer metadata and files related to the project and not any table data in the project.
</alert>

## Migration Example

### Export Metadata

From the source project, go to `Project Metadata`. Under ``Export / Import Metadata`` tab, select ``Export zip``, click ``Submit``. This step extracts project metadata and stores it in compressed (zip) format.

![image](https://user-images.githubusercontent.com/35857179/161904400-b926494a-4533-41e4-85c3-5c6ca9ea0803.png)

### Import Metadata

From the destination project, go to `Project Metadata`. Under ``Export / Import Metadata`` tab, select ``Import zip``, select ``meta.zip`` file stored in previous step. This step imports project metadata from compressed file (zip) selected and restarts the project.

![image](https://user-images.githubusercontent.com/35857179/161904452-da0ac683-1715-438a-9c9c-91b34f8f45ba.png) -->

## Database Metadata

Go to `Project Metadata`, under ``Metadata``, you can see your metadata sync status. If it is out of sync, you can sync the schema. See <a href="./sync-schema">Sync Schema</a> for more.

<img width="1333" alt="image" src="https://user-images.githubusercontent.com/35857179/194850034-5330458e-85a9-4a3c-87a3-dd2f3edc5b46.png">

## UI Access Control

Go to `Project Metadata`, under ``UI Access Control``, you can control the access to each table by roles. 

<img width="1336" alt="image" src="https://user-images.githubusercontent.com/35857179/194850281-9030f4c5-06bc-4780-b8fd-5d0c209867e0.png">

## ERD

Go to `Project Metadata`, under ``ERD View``, you can see the ERD of your database.

<img width="1338" alt="image" src="https://user-images.githubusercontent.com/35857179/194850416-54bc49cf-c32f-45e8-aea1-62b07645c26e.png">

### Junction table names within ERD

- Enable `Show M2M Tables` within Miscellaneous tab
- Double click on `Show Columns` to see additional checkboxes get enabled.
  - Enabling which you should be able to see junction tables and their table names.

<img width="1681" alt="Show Junction table names for many to many table" src="https://user-images.githubusercontent.com/5435402/192140913-9da37700-28fe-404d-88e8-35ba0c8e2f53.png">

## Miscellaneous

- Enabling, `Show M2M Tables` will show junction tables between many to many tables.

<img width="1340" alt="image" src="https://user-images.githubusercontent.com/35857179/194850461-3e88752a-ba4f-4ead-9426-9a9e57020061.png">
