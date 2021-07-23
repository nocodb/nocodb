---
title: 'Table & Columns'
description: 'Table and Columns'
position: 11
category: 'Setup and Usages'
menuTitle: 'Table and Columns'
---


## Table Creation

Once you have created a new NocoDB project you can open it, In the browser, the URL would be like `example.com/dashboard/#/nc/project_id`.  

Now you can start creating new tables, so let's begin the table creation by simply clicking one of the following options.

![table_create](https://user-images.githubusercontent.com/61551451/126771744-063f22da-6def-43fe-b9ef-1744d104db9d.png)

 On click, it will popup a table create a modal popup, in which you can enter the table name alias and table name. Enable/disable default columns and finally click the `Submit` button.
 
![table_create_modal](https://user-images.githubusercontent.com/61551451/126772859-5a301c45-d830-4df2-a05a-43b15dd77728.png)

> You can't disable the `id` column since we need a primary column for the table.

After the successful submission, the table will create and open as a new tab.

![image](https://user-images.githubusercontent.com/61551451/126773614-c945f654-cba8-4dd6-bd5e-d74890543d11.png)

## Column Creation

Adding a column is simple, you have to click the `+` icon on the right corner of the table.

![Pasted_Image_23_07_21__4_39_PM](https://user-images.githubusercontent.com/61551451/126773798-4470d632-69e0-4f5f-803b-e3597715fe22.png)

After the click, it will show a menu and you can enter the column name and choose the column type ([Abstract type](./abstract-types)) from the column type. And finally, you can click the save button to create the new column.

![image](https://user-images.githubusercontent.com/61551451/126774157-ae9af236-e1ad-4a54-adb7-1b96775cae57.png)

> For more about Abstract type [click here](./abstract-types).


Finally, we have our new column as part of our table.


![Pasted_Image_23_07_21__4_43_PM](https://user-images.githubusercontent.com/61551451/126774276-e947f510-2fe1-4595-afc1-a31d2c35a69a.png)


## Row creation

For adding new values to the table we need new rows, new rows can be added in two methods.

### Using Form

- Click the `+` icon in the toolbar of the table tab.
	![Pasted_Image_23_07_21__5_40_PM](https://user-images.githubusercontent.com/61551451/126783882-abd7e1dc-f13f-49bf-b44d-e66a06aacf5d.png)
- Now it will open a modal Form to enter the values, provide the values and press the save button.
    ![Pasted_Image_23_07_21__6_22_PM](https://user-images.githubusercontent.com/61551451/126784347-b82f9dfd-4c6d-4d65-be07-80e051ff19de.png)
- After saving it will be there on your table.
    ![image](https://user-images.githubusercontent.com/61551451/126785340-e9b80ad0-ba06-4a22-8a01-876d829c9673.png)


### Using Table Row


- Click the bottom row of the table which contains `+` icon at the beginning.
	![Pasted_Image_23_07_21__6_36_PM](https://user-images.githubusercontent.com/61551451/126786285-c5b4a614-ee3f-4ff9-8783-064f81b8b83d.png)
- Now it will add a new row in the table and you can start editing by any of the following methods
    - Double click
    - Click and start typing (this way it will clear the previous content)
    - Click and press enter to start editing
- And it will automatically save on blur event or if inactive.

  

## Table Deletion

The table can be deleted using the `delete` icon present in the toolbar within the table tab.

![Pasted_Image_23_07_21__6_45_PM](https://user-images.githubusercontent.com/61551451/126787235-6751cadf-3e8a-446d-9db8-0d6ec330b243.png)

## Column Deletion

Column deletion can be done by using the `delete` option from the column header menu.

![Pasted_Image_23_07_21__6_49_PM](https://user-images.githubusercontent.com/61551451/126787679-562aaa22-14b3-4ff8-8057-b8219e057110.png)


## Row Deletion

Right-click on anywhere in the row and then from the context menu select `Delete Row` option. Bulk delete is also possible by selecting multiple rows by using the checkbox in first column and then `Delete Selected Rows` options from the context menu.