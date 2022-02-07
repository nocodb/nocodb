---
title: "Lookup"
description: "Lookup"
position: 550
category: "Product"
menuTitle: "Lookup"
---

## Lookup

#### Sample simple Organization structure:

- 5 verticals, each vertical has a team name & associated team code
- 5 employees working at different verticals
- Vertical **has many** Employees : relationship has been defined

<img src="https://user-images.githubusercontent.com/86527202/144038845-402d5401-a214-4166-bc07-fcf8dcc8a961.png" width="125%"/>

Now, we can explore how to extract team-code information in Employee table using **"LOOKUP"** columns

## Adding a lookup column

### 1. Add new column

<img src="https://user-images.githubusercontent.com/86527202/144230901-11dc69e7-3e4d-481d-b682-b7d73e6352c0.png" width="60%"/>
Click on '+' icon to the left of column headers in Employee table

### 2. Feed column name

<img src="https://user-images.githubusercontent.com/86527202/144230954-40646872-4a05-45fd-9a4f-52b8b00a3a7d.png" width="60%"/>

### 3. Select column type as 'Lookup'

<img src="https://user-images.githubusercontent.com/86527202/144230982-37d08274-ce63-4a28-a30a-bd6b41c3b489.png" width="60%"/>

### 4. Choose child table

Table Verticals in our example  
<img src="https://user-images.githubusercontent.com/86527202/144231016-b277270d-62e4-4607-9aaa-b253621808a0.png" width="60%"/>

### 5. Select child column

<img src="https://user-images.githubusercontent.com/86527202/144231774-2bdd9988-d3f8-4933-96c6-5b710d645905.png" width="60%"/>

### 6. Click on 'Save'

<img src="https://user-images.githubusercontent.com/86527202/144231320-9e8b3465-a9a4-4cf7-a9fe-65d47ab8b96c.png" width="60%"/>

### 7. Required information is populated in the newly created column

<img src="https://user-images.githubusercontent.com/86527202/144231230-0e013684-b11c-4dce-bacf-9feee5546f26.png" width="60%"/>
