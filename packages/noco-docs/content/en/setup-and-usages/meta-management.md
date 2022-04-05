---
title: 'Metadata'
description: 'Metadata'
position: 600
category: 'Product'
menuTitle: 'Metadata'
---

Project Metadata can be found by clicking `Team & Settings` from the left navigation drawer and clicking `Project Metadata`.


<!-- TODO: update screenshot -->

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
  Import won't work with zip files exported from the older version of apps (< 0.11.6). <br> 
  Import / Export will only transfer metadata and files related to the project and not any table data in the project.
</alert>

## Migration Example

### Export Metadata

Source project : Under ``Export / Import Metadata`` tab, select ``Export zip``, click ``Submit``.

This step extracts project metadata and stores it in compressed (zip) format.

<!-- TODO: update screenshot -->

![meta-dev](https://user-images.githubusercontent.com/86527202/130780497-89578bd0-a417-468a-92d8-88c5c07a72b0.png "Step-Export")

### Import Metadata

Destination project : Under ``Export / Import Metadata`` tab, select ``Import zip``, select ``meta.zip`` file stored in previous step. 

This step imports project metadata from compressed file (zip) selected and restarts project.

<!-- TODO: update screenshot -->

![meta-prod](https://user-images.githubusercontent.com/86527202/130781015-3477e596-b1bc-4189-9853-bfd850157ba8.png)

## Database Metadata

Under ``Metadata``, you can see your metadata sync status. If it is out of sync, you can sync the schema. See <a href="./sync-schema">Sync Schema</a> for more.

<!-- TODO: update screenshot -->

![image](https://user-images.githubusercontent.com/35857179/127611038-a10ccee5-72ca-42cf-a55b-c8268c9fbe5c.png)

## UI Access Control

Under ``UI Access Control``, you can control the access to each table by roles. 

<!-- TODO: update screenshot -->

![image](https://user-images.githubusercontent.com/35857179/127611188-339de6ca-e648-47c0-a358-eee0d03ae9d0.png)

