---
title: "Table Operations"
description: "Table Operations: Row, Column, Quick Import, Export & Import"
position: 510
category: "Product"
menuTitle: "Table Operations"
---

Once you have created a new NocoDB project you can open it, In the browser, the URL would be like `example.com/dashboard/#/nc/<project_id>`.

## Table

### Table Create

Now you can start creating new tables by simply clicking one of the following options.

- Click `Add new table` button
- Hover `Add new table` button in table menu, click three dots, use Quick Import to create
- Drag and drop CSV, JSON or Excel file to import

<img width="1508" alt="image" src="https://user-images.githubusercontent.com/35857179/189051917-d6b07f21-845c-4519-a1c5-4b26bbfcf04b.png">

A modal will be popped up. Input the corresponding info and enable or disable default columns and click `Submit` button.

<img width="1500" alt="image" src="https://user-images.githubusercontent.com/35857179/189052476-505c7e6d-ff67-4cbe-aec1-6b3eec374030.png">

Click Show more for advanced settings.

<alert>
Note: You can't disable the `id` column since NocoDB needs a primary column for every table. You can rename it after the creation.
</alert>

<img width="1500" alt="image" src="https://user-images.githubusercontent.com/35857179/189052642-ab77a791-fdd6-42f6-b2b6-fcc972859939.png">

After the successful submission, the table will be created and open as a new tab.  

<img width="1501" alt="image" src="https://user-images.githubusercontent.com/35857179/189052804-deea1ed7-6b62-4c00-8aca-fed00151d3c9.png">

### Table Rename

Right click on Table name on left hand project-tree menu, select `Rename`
  
<img width="651" alt="image" src="https://user-images.githubusercontent.com/35857179/189052896-2313dd1f-8baf-4cc3-8ef2-ff007d3ff920.png">

In modal popup, enter new table name and click `Submit` button

<img width="1507" alt="image" src="https://user-images.githubusercontent.com/35857179/189052935-c6403bd9-4b91-40ba-91d6-a34abfcfa21f.png">


### Table Delete

Right click on Table name on left hand project-tree menu, select `Delete`

<img width="617" alt="image" src="https://user-images.githubusercontent.com/35857179/189053090-806c62d5-6028-444f-93eb-6ccb9345dd52.png">

Click Yes to confirm the table deletion

<img width="1506" alt="image" src="https://user-images.githubusercontent.com/35857179/189053138-54f6a85a-e9e3-4cad-b127-df19ccdd184e.png">

## Column

### Column Add

Click the `+` icon on the right corner of the table.

<img width="352" alt="image" src="https://user-images.githubusercontent.com/35857179/189053971-a3d29b3b-1177-49fe-8178-8868528fe3e7.png">

After the click, it will show a menu and you can enter the column name and choose the column type.  (See [Column Types](./column-types) for the full list).

<img width="459" alt="image" src="https://user-images.githubusercontent.com/35857179/189073266-a0f19e2e-5dd2-4343-8c74-4ef709da272c.png">

You can also click `Show more` for additional menu options.

<img width="445" alt="image" src="https://user-images.githubusercontent.com/35857179/189075678-d18b799f-df13-4f78-a5a5-813e8d3277ae.png">

Click `Save` button to create the new column. 

<img width="909" alt="image" src="https://user-images.githubusercontent.com/35857179/189075920-30acaf44-eba7-4fa6-ab93-a576ce88ef23.png">

### Column Edit

To edit column properties, click the down arrow, select `Edit` from the menu.  
  
<img width="230" alt="image" src="https://user-images.githubusercontent.com/35857179/189077129-dfb7a815-3fc7-41ea-b72c-e57f3c30a7f4.png"> 
  
You will be able to edit column name & associated datatype using pop-up modal.  You can also click `Show more` for additional menu options.
  
<img width="497" alt="image" src="https://user-images.githubusercontent.com/35857179/189077270-7acdc818-3747-4307-93fb-e970cb7936f9.png">

### Column Delete

To delete a column, click the down arrow, select `Delete` from the menu.  

<img width="256" alt="image" src="https://user-images.githubusercontent.com/35857179/189077566-c9376e4e-9ee8-4ffa-b437-1240894a30cd.png">

Click `Yes` to confirm the column deletion. 

<img width="1507" alt="image" src="https://user-images.githubusercontent.com/35857179/189077741-b2e271af-1f0a-4de8-8e99-acb349d3c6aa.png">

## Row

For adding new values to the table we need new rows, new rows can be added in two methods.

### Row Add (Using Form)

- Click the `+` icon in the toolbar of the table tab.  
  <img width="1038" alt="image" src="https://user-images.githubusercontent.com/35857179/189079143-8f3e3dd6-9b62-4fb0-9a78-a57545026d11.png">
- Then you can enter the values and click `Save row`.  
  <img width="1498" alt="image" src="https://user-images.githubusercontent.com/35857179/189079268-5b1da462-624b-4cac-9820-e2ed3ed421af.png">
- After saving it will be there on your table.  
  <img width="1501" alt="image" src="https://user-images.githubusercontent.com/35857179/189079668-5f7b0b53-8d62-41b5-acc0-2fa38cd8a144.png">

### Row Add (Using Table Row at bottom of page)

- Click the bottom row of the table `+ Add new row`.
  <img width="545" alt="image" src="https://user-images.githubusercontent.com/35857179/189079815-9a7ea5e3-4eb7-452e-99a8-78c271f2ad1f.png">
- A new empty row will be created
  <img width="567" alt="image" src="https://user-images.githubusercontent.com/35857179/189080009-3aeb70b4-92b0-4702-acb9-e5e52e31855e.png">

### Row Edit
You can start editing by any of the following methods  
  - Double click on cell to edit  
  - Click on cell and start typing (this way it will clear the previous content)  
  - Click on cell and press enter to start editing  
- And it will automatically save on blur event or if inactive.  

### Row Delete

Right-click on anywhere in the row and then from the context menu select `Delete Row` option.  
Bulk delete is also possible by selecting multiple rows by using the checkbox in first column and then `Delete Selected Rows` options from the right click context menu.

<img width="568" alt="image" src="https://user-images.githubusercontent.com/35857179/189081764-9f13c286-e02a-40d0-93ea-4b1362d96827.png">

## Quick Import

You can use Quick Import when you have data from external sources such as Airtable, CSV file or Microsoft Excel to an existing project by either 

- Hover `Add new table` button in table menu, click three dots, use Quick Import to create
- Drag and drop CSV, JSON or Excel file to import

<img width="1508" alt="image" src="https://user-images.githubusercontent.com/35857179/189051917-d6b07f21-845c-4519-a1c5-4b26bbfcf04b.png">

### Import Airtable into an existing project

- See <a href="./import-airtable-to-sql-database-within-a-minute-for-free">here</a>

### Import CSV data into an existing project

- Hover `Add new table` button in table menu, click three dots, and click `CSV file`
- Drag & drop or select file to upload or specify CSV file URL
  <img width="1508" alt="image" src="https://user-images.githubusercontent.com/35857179/189083344-79ac27a6-d32e-46e9-9d73-95f4ce8f37de.png">
- Click `Import`
  <img width="1502" alt="image" src="https://user-images.githubusercontent.com/35857179/189083577-3c7fef66-0bf2-4d61-be22-dee365b93a8c.png">
- You can revise the table name by double clicking it, column name and column type. By default, the first column will be chosen as <a href="./primary-value" target="_blank">Primary Value</a> and cannot be deleted.
  <img width="1506" alt="image" src="https://user-images.githubusercontent.com/35857179/189083667-cf9ce8a9-0126-478e-872d-b554ea9e0e87.png">
- Click `Import` to start importing process. The table will be created and the data will be imported.
  <img width="1500" alt="image" src="https://user-images.githubusercontent.com/35857179/189085568-daac2690-2883-4ddd-8a51-ea27bda8630e.png">

### Import Excel data into an existing project

- Hover `Add new table` button in table menu, click three dots, and click `Microsoft Excel`
- Drag & drop or select file to upload or specify Excel file URL
  <img width="1495" alt="image" src="https://user-images.githubusercontent.com/35857179/189088426-f0f585ae-a6ac-455c-a4ed-0a9b95b0f381.png">
- You can revise the table name, column name and column type. By default, the first column will be chosen as <a href="./primary-value" target="_blank">Primary Value</a> and cannot be deleted.
  <alert>
  Note: If your Excel file contains multiple sheets, each sheet will be stored in a separate table.
  </alert>

  <img width="1484" alt="image" src="https://user-images.githubusercontent.com/35857179/189093528-f3c9cc04-de4c-4a87-aae5-9429d1bd50df.png">
- Click `Import` to start importing process. The table(s) will be created and the data will be imported to the corresponding table(s).
  <img width="1501" alt="image" src="https://user-images.githubusercontent.com/35857179/189093670-abd3e192-8ed2-481f-9add-ad0f30f3d862.png">

## Export Data

You can export your data from a table as a CSV file by clicking the down arrow next to Table name and hover on `Download`. Currently only CSV and XLSX formats are supported for export.

<img width="887" alt="image" src="https://user-images.githubusercontent.com/35857179/189094800-a77dedf7-1bad-4a68-abf4-626688e62524.png">

## Import Data

You can import your data in CSV format to a table by clicking the down arrow next to Table name and hover on `Upload`. Currently only CSV format is supported for upload.

<img width="1095" alt="image" src="https://user-images.githubusercontent.com/35857179/189094939-33a4c87c-66d8-4951-98b4-886ead470ce0.png">
