---
title: 'Metadata'
description: 'NocoDB Project Metadata'
position: 600
category: 'Product'
menuTitle: 'Metadata'
---

Project Metadata includes Database Metadata, UI Access Control and Miscellaneous.

To access it, click the down arrow button next to Project Name on the top left side, then select `Team & Settings`.

<img width="390" alt="image" src="https://user-images.githubusercontent.com/35857179/189115289-07657c15-deab-435f-b0f9-2948007f8c65.png">

and clicking `Project Metadata`.

<img width="244" alt="image" src="https://user-images.githubusercontent.com/35857179/189116366-c58de4c1-c62d-4ac9-8362-aa08ff92005f.png">

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

<img width="1418" alt="image" src="https://user-images.githubusercontent.com/35809690/191258001-a4385df0-e796-4fa1-8ea4-a25361cd2d91.png">

## UI Access Control

Go to `Project Metadata`, under ``UI Access Control``, you can control the access to each table by roles. 

<img width="1417" alt="image" src="https://user-images.githubusercontent.com/35809690/191258150-3abe8de9-bab9-46fe-9095-01b8815b57f2.png">

## ERD

Go to `Project Metadata`, under ``ERD View``, you can see the ERD of your database.

<img width="1419" alt="image" src="https://user-images.githubusercontent.com/35809690/191258324-18bd4ed0-521b-4480-a3f6-fe4660b8ddd5.png">


## Miscellaneous

Currently only `Show M2M Tables` can be configurated under Miscellaneous.

<img width="1409" alt="image" src="https://user-images.githubusercontent.com/35809690/191258441-72a12941-2d2b-4a0d-84b8-f7f8783aa4e8.png">