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
  Import won't work with zip files exported from the older version of apps (< 0.11.6). <br> 
  Import / Export will only transfer metadata and files related to the project and not any table data in the project.
</alert>

## Migration example
### Export metadata
Source project : Under ``Meta Management`` tab, select ``Export zip``, click ``Submit``. This step extracts project metadata and stores it in compressed (zip) format  

![meta-dev](https://user-images.githubusercontent.com/86527202/130780497-89578bd0-a417-468a-92d8-88c5c07a72b0.png "Step-Export")

### Import metadata
Destination project : Under ``Meta Management`` tab, select ``Import zip``, select ``meta.zip`` file stored in previous step. This step imports project metadata from compressed file (zip) selected and restarts project.  

![meta-prod](https://user-images.githubusercontent.com/86527202/130781015-3477e596-b1bc-4189-9853-bfd850157ba8.png)

---


## Database Metadata

Under ``DB Metadata``, You can manage your models. For example, if you do not want to expose some APIs, you can untick those under APIs here.

![image](https://user-images.githubusercontent.com/35857179/127611038-a10ccee5-72ca-42cf-a55b-c8268c9fbe5c.png)

The relations of all tables are listed under ``Relations``.

![image](https://user-images.githubusercontent.com/35857179/127611116-0289f739-bad7-45a0-b2bd-bfd8565f50b8.png)

## UI Access Control

You can control the access to each table and relation by roles. 

![image](https://user-images.githubusercontent.com/35857179/127611188-339de6ca-e648-47c0-a358-eee0d03ae9d0.png)

![image](https://user-images.githubusercontent.com/35857179/127611237-5c43e194-a8ba-4e33-b473-5b690a38e80d.png)
