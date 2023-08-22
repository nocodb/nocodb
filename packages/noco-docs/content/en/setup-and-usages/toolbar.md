---
title: "Toolbar"
description: "Toolbar Operations (fields, filter, sort, group by, row height)"
position: 520
category: "Product"
menuTitle: "Toolbar"
---

## Fields
Click `Fields` to control the visibility, order of a field.

### Hide/Unhide fields
To hide / unhide columns, open `Fields` menu, click on associated toggle button to hide / unhide.

<alert type="success">
Tip: Configuration here is view specific. You can create different grid views with different fields shown in each view.
</alert>  
  
![fields hide unhide](https://github.com/nocodb/nocodb/assets/86527202/b9a323e9-39b8-418d-9b7c-3da0f2d17d89)

### Reorder fields
Column positions can be re-ordered. Open `Fields` menu, and re-order fields as needed by dragging and dropping the `drag icon`.
  
![fields drag drop](https://github.com/nocodb/nocodb/assets/86527202/0b30d4b2-3390-470f-bf01-72b5b922726b)

### Show System fields
By default, all system fields will be hid. However, you can tick `Show system fields` to make them visible.
  
![fields show system fields](https://github.com/nocodb/nocodb/assets/86527202/6ad574c2-93d0-49ac-be28-01b336df8de4)


## Filter
Filters allow you to restrict / organize your data on the view as per your needs. NocoDB allows nested filters. You can choose multiple columns and conditions to apply filter. Between filters, you can opt for either `and` or `or` mode operation. Lookup, Formula, Nested Data are also supported in Filtering.

### Add / Edit filter
Click on `Filter` button in the toolbar, select either `Add filter` or `Add filter group`
  
![filter add](https://github.com/nocodb/nocodb/assets/86527202/f312d8e5-98f1-4e34-ad82-460bb5eacef3)

Configure filter : `Column` `Operation` and `Value` (if applicable)
  
![filter level-1](https://github.com/nocodb/nocodb/assets/86527202/62ac5ea5-64c7-4ab4-93bc-c2897e1a9122)

Multiple filter conditions can be combined by using either `and` or `or` mode of operation
  
![filter nested](https://github.com/nocodb/nocodb/assets/86527202/1e9af5bf-c19f-49ed-8fc4-a62093f6ee01)

### Delete filter

To delete a filter, click on the bin icon to the right of the associated filter

![filter delete](https://github.com/nocodb/nocodb/assets/86527202/c8f5abac-a550-4152-ab51-5f0765cd188b)


### Grouped filters
You can also group several filters together using Filter Group.
  
![filter grouped](https://github.com/nocodb/nocodb/assets/86527202/582c29de-28cd-4414-b7db-4b1b1eea131e)


## Sort
### Add sort
### Edit sort
### Delete sort

## Group by
Group-by allows one to visually categorise records on grid into specific `Groups` & `Sub groups`. NocoDB allows three levels of record seggregation. 
  
![group by](https://github.com/nocodb/nocodb/assets/86527202/d4bfcdee-85ed-4c98-92ac-12055f9715e4)

### Add / Edit group-by
- Click on `Group By` in the toolbar
- Choose field for the records to be grouped by
- Optionally- you can also sort groups, in either ascending or descending way.
- Add sub-groups of upto 3 levels

### Delete group-by
- Click on `Group By` in the toolbar
- Click on the bin icon to the right of the group you wish to delete

Note: To disable `Group by` & return back to standard spreadsheet grid view - you need to remove all the groups configured.

## Row Height
