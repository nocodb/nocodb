---
title: 'Team & Settings > Data Sources'
description: 'NocoDB Data-Source sync, access control & re-config'
position: 600
category: 'Product'
menuTitle: 'Team & Settings > Data Sources'
---

`Data Sources` sub-menu includes 
- Database Metadata
- UI Access Control
- ERD
- Add/Remove new data source
- Edit existing data source configuration
- Edit data source visibility options  

  
Note that, currently only one external data source can be added per project.

To access it, click the down arrow button next to Project Name on the top left side, then select `Team & Settings` and clicking `Data Sources`.

<!-- ![Screenshot 2022-12-29 at 4 26 27 PM](https://user-images.githubusercontent.com/86527202/209941709-1bfdbb01-ebd0-4c85-a966-2a8b4fc6ade7.png) -->
![Screenshot 2022-12-29 at 4 29 24 PM](https://user-images.githubusercontent.com/86527202/209941906-a9c8d48d-d604-4a2f-8ffb-7a9a494bac6b.png)
![Screenshot 2022-12-29 at 4 27 14 PM](https://user-images.githubusercontent.com/86527202/209941716-70f2aaa7-b035-42b2-835e-eb2ca348be42.png)


<!-- ![Screenshot 2022-12-29 at 3 54 55 PM](https://user-images.githubusercontent.com/86527202/209938195-7384b4d8-0289-447f-bd39-1ec600cd1723.png) -->
<!-- <img width="322" alt="image" src="https://user-images.githubusercontent.com/86527202/209941709-1bfdbb01-ebd0-4c85-a966-2a8b4fc6ade7.png"> | <img alt="image" src="https://user-images.githubusercontent.com/86527202/209941716-70f2aaa7-b035-42b2-835e-eb2ca348be42.png"> -->
<!-- |--|--| -->
  
![Screenshot 2022-12-29 at 4 15 00 PM](https://user-images.githubusercontent.com/86527202/209940452-5b867b71-b9f1-4e64-af69-14715ab73be7.png)



## Sync Metadata

Go to `Data Sources`, click ``Sync Metadata``, you can see your metadata sync status. If it is out of sync, you can sync the schema. See <a href="./sync-schema">Sync Schema</a> for more.0

![Screenshot 2022-12-29 at 4 19 35 PM](https://user-images.githubusercontent.com/86527202/209940903-396650b4-e219-494a-863f-c3f1beb51c5e.png)


<!-- <img width="1333" alt="image" src="https://user-images.githubusercontent.com/35857179/194850034-5330458e-85a9-4a3c-87a3-dd2f3edc5b46.png"> -->

## UI Access Control

Go to `Data Sources`, click ``UI ACL``, you can control the access to each table by roles. 

<!-- <img width="1336" alt="image" src="https://user-images.githubusercontent.com/35857179/194850281-9030f4c5-06bc-4780-b8fd-5d0c209867e0.png"> -->
![Screenshot 2022-12-29 at 4 20 57 PM](https://user-images.githubusercontent.com/86527202/209941141-deed80a9-7682-48e1-8de9-9c965c990d2d.png)

## ERD

Go to `Data Sources`, click ``ERD``, you can see the ERD of your database.

![Screenshot 2022-12-29 at 4 21 55 PM](https://user-images.githubusercontent.com/86527202/209941168-b53d2898-8448-47fa-a8b3-6f3572f6b3a2.png)
<!-- <img width="1338" alt="image" src="https://user-images.githubusercontent.com/35857179/194850416-54bc49cf-c32f-45e8-aea1-62b07645c26e.png"> -->

### Junction table names within ERD

- Enable `Show M2M Tables` within `Project Settings` menu
- Double click on `Show Columns` to see additional checkboxes get enabled.
  - Enabling which you should be able to see junction tables and their table names.

<img width="1681" alt="Show Junction table names for many to many table" src="https://user-images.githubusercontent.com/5435402/192140913-9da37700-28fe-404d-88e8-35ba0c8e2f53.png">

## Edit external database configuration parameters

Go to `Data Sources`, click ``Edit``, you can re-configure database credentials.  
Please make sure database configuration parameters are valid. Any incorrect parameters could lead to schema loss!
  
  
![Screenshot 2022-12-29 at 4 22 08 PM](https://user-images.githubusercontent.com/86527202/209941211-de9670c9-a73c-4719-9957-eeaf05f3a7ee.png)
  

## Unlink data source

Go to `Data Sources`, click ``Delete`` against the data source that you wish to un-link.
  
![Screenshot 2022-12-29 at 4 31 16 PM](https://user-images.githubusercontent.com/86527202/209942178-5ae40f14-0e87-41f7-9630-e2bf6f59a906.png)
  
## Data source visibility

Go to `Data Sources`, toggle ``Radio-button`` against the data source that you wish to hide/un-hide.
  
![Screenshot 2022-12-29 at 4 31 16 PM 2](https://user-images.githubusercontent.com/86527202/209942198-627f7f14-761b-4709-b9ca-fde5111fa207.png)
    
<!-- ## Miscellaneous

- Enabling, `Show M2M Tables` will show junction tables between many to many tables.

<img width="1340" alt="image" src="https://user-images.githubusercontent.com/35857179/194850461-3e88752a-ba4f-4ead-9426-9a9e57020061.png">
 -->
