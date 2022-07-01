---
title: "Lookup"
description: "Understanding Lookup Column!"
position: 550
category: "Product"
menuTitle: "Lookup"
---

## Lookup

### Sample simple Organization structure

- 5 departments (company departments), each department has a team name & associated team code. Vertical **has many** Employees - relationship has been defined

<img src="https://user-images.githubusercontent.com/35857179/161894091-6b6092c2-7184-4fe6-aa17-64ce5a7e97d5.png" width="70%"/>

- 5 employees working at different departments

<img src="https://user-images.githubusercontent.com/35857179/161894109-9b1a45da-c721-4d42-b676-a7c801cc160d.png" width="50%"/>

Now, we can explore how to extract team-code information in Employee table using **LOOKUP** columns

### Adding a lookup column

### 1. Add new column

Click on '+' icon to the left of column headers in Employee table

<img src="https://user-images.githubusercontent.com/35857179/161895281-a43058c9-00be-4e8e-bf12-925284b7bcf8.png" width="70%"/>

### 2. Feed column name

<img src="https://user-images.githubusercontent.com/35857179/161895397-bde8bd31-6e0a-4251-8ffc-a0d0a2605899.png" width="50%"/>

### 3. Select column type as 'Lookup'

<img src="https://user-images.githubusercontent.com/35857179/161895489-046a3ee4-4a42-4a48-95f9-e6cfc92c598a.png" width="50%"/>

### 4. Choose child table

Table Verticals in our example  
<img src="https://user-images.githubusercontent.com/35857179/161895601-0e8924ed-9ff0-4215-ab61-151848d01d0d.png" width="50%"/>

### 5. Select child column

<img src="https://user-images.githubusercontent.com/35857179/161895637-e9f9f444-d733-41a4-bd18-8efed6fd16ad.png" width="50%"/>

### 6. Click on 'Save'

<img src="https://user-images.githubusercontent.com/35857179/161895740-e6df9739-178d-4e8c-ba0e-b7537b30b30d.png" width="50%"/>

### 7. Required information is populated in the newly created column

<img src="https://user-images.githubusercontent.com/35857179/161895950-e7b86c0e-74ab-4bf3-b43c-878fe1320fba.png" width="50%"/>

## Nested Lookup

On top of the previous structure, let's introduce one more table - `Project` which contains `ProjectName` and each employee can be assigned with multiple projects. If we want to include the lookup column `TeamCode` from Employee in Project, we can create a nested lookup.

<img src="https://user-images.githubusercontent.com/35857179/161897419-aa00f5eb-3553-46ce-80a1-6c8565366c27.png" width="50%"/>

We can apply the same steps to create the lookup column `TeamCode` in table `Project`. This time we choose the lookup column created previously in table `Employee` as a child table.

<img src="https://user-images.githubusercontent.com/35857179/161893922-e1c8b7e5-655b-4096-827c-75105231d9e0.png" width="50%"/>

Click save. Then `TeamCode` is populated in table `Project`.

<img src="https://user-images.githubusercontent.com/35857179/161898396-c5c96485-3ec2-4452-88a0-6ed7665d6f34.png" width="50%"/>
