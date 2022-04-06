---
title: 'Metadata'
description: 'Metadata'
position: 600
category: 'Product'
menuTitle: 'Metadata'
---

Project Metadata can be found by clicking `Team & Settings` from the left navigation drawer

![image](https://user-images.githubusercontent.com/35857179/161902474-fd06678c-a171-4237-b171-dc028b3753de.png)

and clicking `Project Metadata`.

![image](https://user-images.githubusercontent.com/35857179/161905030-6c5deef7-3a3d-4e71-8763-88e57586e5b4.png)

## Project Metadata

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

![image](https://user-images.githubusercontent.com/35857179/161904452-da0ac683-1715-438a-9c9c-91b34f8f45ba.png)

## Database Metadata

Go to `Project Metadata`, under ``Metadata``, you can see your metadata sync status. If it is out of sync, you can sync the schema. See <a href="./sync-schema">Sync Schema</a> for more.

![image](https://user-images.githubusercontent.com/35857179/161904869-e6c8fe74-3156-49bc-be66-09f8d676aa83.png)


## UI Access Control

Go to `Project Metadata`, under ``UI Access Control``, you can control the access to each table by roles. 

![image](https://user-images.githubusercontent.com/35857179/161904939-6869e36d-0612-4ae5-a123-fee371472ede.png)