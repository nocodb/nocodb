---
title: "Link To Another Record"
description: "Understanding Link To Another Record (LTAR) Columns!"
position: 540
category: "Product"
menuTitle: "Link To Another Record"
---

### Relationship types:

- One to one
  - A Table record in first table is related to only one record of second table.
  - Example: Country has a capital city
- One to many
  - A Table record in first table is related to more than one record of second table. But second table record maps to only one entry of first table
  - NocoDB refers to this category of relationship as **has many**
  - For every **has many** relation defined, NocoDB augments **belongs to** relationship column in the other table automatically
  - Example: Country **has many** Cities. (other way mapping > City **belongs to** Country )
- Many to many
  - A Table record in first table is related to more than one record of second table; second table record can also map to more than on record of first table.
  - NocoDB refers to this category of relationship as **many to many**
  - For every **many to many** relation defined between tables, NocoDB augments **many to many** relationship column in the other table automatically
  - Example: Film **has many** Actors. Actor **has many** Films (works on many films)

Further details of relationship types can be found [here](https://afteracademy.com/blog/what-are-the-different-types-of-relationships-in-dbms)

Relationships between table records can be established by using **LinkToAnotherRecord** column type.
Workflow details are captured below

## Adding a relationship

![1](https://user-images.githubusercontent.com/86527202/144224170-43f4194f-83d4-4291-8c91-1f66ea1caeda.png)

### 1. Create column

Click on '+' button at end of column headers

### 2. Update column name

Input name in the text box provided

### 3. Select column type

Select Column type as "LinkToAnotherRecord" from the drop-down menu

### 4. Choose relationship type

'Has Many': corresponds to the 'One-to-many' relationships
'Many To Many': corresponds to the 'Many-to-many' relationships

### 5. Select child table from drop down menu

### 6. Click on 'Save'

A new column will get created in both the parent table & child table

## Updating linked records

### 1. Open link record tab

Click on the '+' icon in corresponding row - cell
![2truncate](https://user-images.githubusercontent.com/86527202/144224728-1cba50e3-323e-4578-be48-d2a205fb472c.png)

### 2. Select from the option displayed

Use 'Filter box' to narrow down on search items
You can opt to insert a new record as well, using "+ New Record" button
![3](https://user-images.githubusercontent.com/86527202/144224530-a258775f-1eea-4c79-88ed-a377d1e35a26.png)

### 3. Column mapping showing "Has Many" relationship

Country 'has many' City

### 4. Column mapping for "Belongs to" relationship [Automatically updated]

City 'belongs to' Country
![4](https://user-images.githubusercontent.com/86527202/144224542-d28be060-a077-468a-bdc4-b2e8a783d75f.png)
