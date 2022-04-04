---
title: "Table Operations"
description: "Table Operations"
position: 510
category: "Product"
menuTitle: "Table Operations"
---

Once you have created a new NocoDB project you can open it, In the browser, the URL would be like `example.com/dashboard/#/nc/project_id`.

## Table

### Table Create

Now you can start creating new tables by simply clicking one of the following options.

![table_create](https://user-images.githubusercontent.com/61551451/126771744-063f22da-6def-43fe-b9ef-1744d104db9d.png)

On click, in modal popup, enter the table name, enable/disable default columns and click `Submit` button.

![table_create_modal](https://user-images.githubusercontent.com/61551451/126772859-5a301c45-d830-4df2-a05a-43b15dd77728.png)

> You can't disable the `id` column since NocoDB need's a primary column for every table.

After the successful submission, the table will be created and open as a new tab.  
  
  
![TableCreated](https://user-images.githubusercontent.com/86527202/144402089-b5e35564-80d5-4105-9e00-7e3e1c4a5030.png)


### Table Rename

Right click on Table name on left hand project-tree menu, select `Rename`
In modal popup, enter new table name and click `Submit` button
  
<img src="https://user-images.githubusercontent.com/86527202/144403447-1b2e4368-eb2b-40c0-901a-54e8adf9a80c.png" width="60%"/>


### Table Delete

The table can be deleted using the `delete` icon present in the toolbar within the table tab.
<img src="https://user-images.githubusercontent.com/86527202/144403591-5d3d36eb-64b7-4057-9244-56a95b47b97b.png" width="60%"/>


## Column

### Column Add

Click the `+` icon on the right corner of the table.

![Pasted_Image_23_07_21__4_39_PM](https://user-images.githubusercontent.com/61551451/126773798-4470d632-69e0-4f5f-803b-e3597715fe22.png)

After the click, it will show a menu and you can enter the column name and choose the column type ([Abstract type](./abstract-types)).  
Click `Save`button to create the new column.

![image](https://user-images.githubusercontent.com/61551451/126774157-ae9af236-e1ad-4a54-adb7-1b96775cae57.png)  
  
& we have new column created as part of our table  
![Pasted_Image_23_07_21__4_43_PM](https://user-images.githubusercontent.com/61551451/126774276-e947f510-2fe1-4595-afc1-a31d2c35a69a.png)  
  
> For more about Abstract type [click here](./abstract-types).

### Column Edit
To edit column properties, click/hover on down arrow, select `Edit` from the menu.  
  
<img src="https://user-images.githubusercontent.com/86527202/144404169-80d8b514-53cf-4bb1-8323-fd3cfda8816b.png" width="50%"/>  
  
You will be able to edit column name & associated datatype using pop-up modal.  
For additional menu options, click `Show more options`  
  
<img src="https://user-images.githubusercontent.com/86527202/144404188-146ab0dc-bd2b-4902-9369-a34253e2fad6.png" width="40%"/>


### Column Delete

Column deletion can be done by using the `delete` option from the column header menu.

![Pasted_Image_23_07_21__6_49_PM](https://user-images.githubusercontent.com/61551451/126787679-562aaa22-14b3-4ff8-8057-b8219e057110.png)

## Row

For adding new values to the table we need new rows, new rows can be added in two methods.

### Row Add (Using Form)

- Click the `+` icon in the toolbar of the table tab.  
  <img src="https://user-images.githubusercontent.com/86527202/144405563-50573b1c-1bd3-43ea-8020-357fc7ef9e42.png" width="50%"/>
- Now it will open a modal Form to enter the values, provide the values and press the save button.  
  <img src="https://user-images.githubusercontent.com/61551451/126784347-b82f9dfd-4c6d-4d65-be07-80e051ff19de.png" width="75%">
- After saving it will be there on your table.  
  ![image](https://user-images.githubusercontent.com/61551451/126785340-e9b80ad0-ba06-4a22-8a01-876d829c9673.png)

### Row Add (Using Table Row at bottom of page)

- Click the bottom row of the table which contains `+` icon at the beginning.  
  <img src="https://user-images.githubusercontent.com/86527202/144405773-bb0d00ef-264d-4941-b01f-3b7f0b1fc54d.png" width="40%"/>
- Now it will add a new row in the table

### Row Edit
You can start editing by any of the following methods  
  - Double click on cell to edit  
  - Click on cell and start typing (this way it will clear the previous content)  
  - Click on cell and press enter to start editing  
- And it will automatically save on blur event or if inactive.  

### Row Delete

Right-click on anywhere in the row and then from the context menu select `Delete Row` option.  
Bulk delete is also possible by selecting multiple rows by using the checkbox in first column and then `Delete Selected Rows` options from the right click context menu.  
<img src="https://user-images.githubusercontent.com/86527202/144406191-ccff1382-e808-44e8-babe-bd937faf1b3d.png" width="40%"/>


