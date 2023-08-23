---
title: 'Views'
description: 'Understanding Views in NocoDB!'
position: 700
category: 'Product'
menuTitle: 'Views'
---

## What's a View?

In a table, you can use different views to display your data. You can show specific fields in a View. You can also apply Sorting or Filtering to the View. Each View is independent, which means the configuration applying to View 1 will not apply to View 2. 

To navigate different views, we can select the target one in the view sidebar. By default, Grid View will be created for you after creating the table. You can create multiple views of a type, as long as they have unique View names.

## View Types

### Grid View

Grid View, as a default type of view, allows you to display your data in a spreadsheet-like interface.
  
![1010-2 Grid](https://user-images.githubusercontent.com/35857179/194824161-ce5c4875-4425-40b7-b932-8176271e4f1e.png)

### Form View

Form View allows you to arrange fields in a form to input data.
  
![1010-2 Form](https://user-images.githubusercontent.com/35857179/194824127-b400f9c8-18a7-4a37-b8c3-7d279e9976af.png)

You can drag-drop columns from the form to form-field-menu-bar as requried.

### Gallery View

Gallery View allows you to display images as thumbnails with other fields just like a gallery.
  
![1010-2 Gallery](https://user-images.githubusercontent.com/35857179/194824141-04c76a4e-2cae-448f-a842-c79f5bce339d.png)
  
### Kanban View

Kanban View allows you to visualise your data using cards at various stacks.

![1010-2 Kanban](https://user-images.githubusercontent.com/35857179/194824164-97ca897a-3af4-42ab-8812-534afaf23396.png)
  
## View Permission Types

We can apply permission to each View. By default, Collaborative Views will be used. To see or change the view type, expand `view-tool-bar-menu` as shown below. 

![locked view](https://github.com/nocodb/nocodb/assets/86527202/41b28e3b-f8c3-46b7-8e9e-894706379a1c)

### Collaborative Views (default)
- Collaborators with edit permissions or higher can change the view configurations

### Locked Views
- No one can edit view configurations until it is Unlocked
- All collaborators can only READ data from such views

### Personal Views
- Only you can edit the view configuration. 
- Your personal views are hidden for other collaborators
- Are not available currently; will be enabled in future release
<!-- ![image](https://user-images.githubusercontent.com/35857179/163343845-b07f9d3f-5a83-4dfd-8d45-9cc59b3512c3.png) -->


## View Operations
  
![view operations](https://github.com/nocodb/nocodb/assets/86527202/c210de4a-7bc2-4b21-bc64-e68c52c1ba21)


### Create a View

Click '+' in View-menu sidebar

### Rename a View

Double click on `view-name`, edit, <enter>.

### Delete a View

Hover the target View and click the delete icon

<alert>
You cannot delete the very first Grid View (termed as `Default view`).
</alert>

### Duplicate a View

Hover the target View and click the copy icon

### Reorder a View

Hover the target View and re-order it as needed by drag-drop the drag icon

