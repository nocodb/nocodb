---
title: "Primary Value"
description: "Understanding Primary Value in NocoDB!"
position: 580
category: "Product"
menuTitle: "Primary Value"
---

## What is a Primary Value ?
- Primary value as the name stands is the primary or main value within a row of a table that you generally associate that row with.
- It should be usually associated with a column which is uniquely identifiable. However, this uniqueness is not enforced at the database level.

## What is the use of Primary Value ?
- Within a spreadsheet, primary value are always highlighted so that it is easier to recognise what row we are in.
- And when LinkToAnotherRecord is created between two tables - it is the primary value that appears in LinkToAnotheRecord column. 

#### Example : Primary Value highlighted in Actor table
<img width="646" alt="image" src="https://user-images.githubusercontent.com/35857179/189114321-58ebaa16-20e2-4615-abda-39417a5df5bf.png">

#### Example : Primary Value highlighted in Film table
<img width="643" alt="image" src="https://user-images.githubusercontent.com/35857179/189114462-a7fef0e2-f9ac-4943-98d5-fee9f60a4ab5.png">

#### Example : Primary Value associated when LinkToAnotherRecord is created
<img width="311" alt="image" src="https://user-images.githubusercontent.com/35857179/189114548-193acc4d-f714-4204-a560-97668db7884c.png">

## How to set Primary Value ?

Click down arrow in the target column. Click `Set as Primary Value`. 

<img width="251" alt="image" src="https://user-images.githubusercontent.com/35857179/189114857-b452aa6b-5cdb-4a74-9980-cb839d7d15fd.png">


## How is Primary Value identfied for existing database tables ?

- It is usually the first column after the primary key which is not a number. 
- If there is no column which is not a number then the column adjacent to primary key is chosen. 

## Can I change the Primary Value to another column within tables ?

- Yes, you can use the same way mentioned above to set Primary Value.
