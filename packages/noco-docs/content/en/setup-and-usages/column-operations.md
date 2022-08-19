---
title: "Column Operations"
description: "Column Operations: Fields, Sort & Filter"
position: 520
category: "Product"
menuTitle: "Column Operations"
---

## Fields

<img src="https://user-images.githubusercontent.com/86527202/144435795-7156799c-04de-474d-9125-1b15e07acc3d.png" width="60%"/>

### Re-order Columns  

Column positions can be re-ordered. Open `Fields` menu, and re-order fields as needed by dragging and dropping the `drag icon`.

<img src="https://user-images.githubusercontent.com/86527202/144435838-8cff72eb-eaa2-4268-9749-213283eb8336.png" width="40%"/>

#### Demo

<img src="https://github.com/dstala/nocodb-files/blob/2c4ca2ff31460ee5636262e88ba303e2d436ba54/ColumnReorder.gif?raw=true" width="100%"/>
<!-- img src="https://media0.giphy.com/media/z5mYR1XoO85Umd5abh/giphy.gif?cid=790b7611f53d7e966bf9de3ae6b1cd5a7d6380b0ab8a4337&rid=giphy.gif&ct=g" width="60%"/ -->

### Hide/ Unhide Columns  

To hide / unhide columns, open `Fields` menu, tick checkbox to keep the column visible, untick checkbox to remove it from the view.

<alert type="success">
Tip: You can create different grid views with different fields shown in each view.
</alert>

<img src="https://user-images.githubusercontent.com/86527202/144435852-47f87057-f42f-4691-abbd-9592cde50541.png" width="40%"/>

#### Demo

<img src="https://github.com/dstala/nocodb-files/blob/2c4ca2ff31460ee5636262e88ba303e2d436ba54/ColumnHide.gif?raw=true" width="100%"/>
<!-- img src="https://media2.giphy.com/media/8NXvWfHDoul72dwLhk/giphy.gif?cid=790b76116fa008b45c79bb91bfe611e324fa38cde21a255a&rid=giphy.gif&ct=g" width="60%"/ -->

## Sort 

Sorting allows you to order contents alphabetically (A → Z) / (Z → A)  (OR) in ascending / descending order. NocoDB allows nested sorting. You can choose column fields & order in which to apply nested sorting. Lookup, Formula, Nested Data are also supported in Sorting.
  
  
<img src="https://user-images.githubusercontent.com/86527202/144435903-84ed8e81-64ec-45e5-a045-9a993238c78c.png" width="75%"/>  

<img src="https://user-images.githubusercontent.com/86527202/144435925-67b995a0-da10-45c9-bf54-9edcc63c5644.png" width="75%"/>  
  
#### Demo

<img src="https://github.com/dstala/nocodb-files/blob/2c4ca2ff31460ee5636262e88ba303e2d436ba54/ColumnSort-2.gif?raw=true" width="100%"/>
<!-- img src="https://media4.giphy.com/media/ThQ8d42U2zdFyZGeZe/giphy.gif?cid=790b761183da2eb690295c5c25f83ace7acf5212c82569a1&rid=giphy.gif&ct=g" width="60%"/ -->

## Filter  

Filters allow you to restrict/organize your data on the view as per your needs. NocoDB allows nested filters. You can choose multiple columns and conditions to apply filter. Between filters, you can opt for either `and` or `or` mode operation. Lookup, Formula, Nested Data are also supported in Filtering.
  
<img src="https://user-images.githubusercontent.com/86527202/144435944-8498be32-76cb-48d1-883a-8f674f2eb68e.png" width="60%"/>

<img src="https://user-images.githubusercontent.com/86527202/144435955-361238d5-ecda-448e-a6de-a47086aeec6e.png" width="75%"/>

### Supported filters

Currently we support filter types - `is equal`, `is not equal`, `is like`, `is not like`, `is null`, `is not null` for string fields. We also support filter types - `>`, `<`, `>=`, and `<=` for numeric fields. Also we provide `is empty` and `is not empty` for checking if the column is empty or not.