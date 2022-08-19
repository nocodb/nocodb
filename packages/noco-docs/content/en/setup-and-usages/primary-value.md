---
title: "Primary value"
description: "Understanding Primary Value in NocoDB!"
position: 580
category: "Product"
menuTitle: "Primary value"
---

## What is a Primary Value ?
- Primary value as the name stands is the primary or main value within a row of a table that you generally associate that row with.
- It should be usually associated with a column which is uniquely identifiable. However, this uniqueness is not enforced at the database level.

## What is the use of Primary Value ?
- Within a spreadsheet, primary value are always highlighted so that it is easier to recognise what row we are in.
- And when LinkToAnotherRecord is created between two tables - it is the primary value that appears in LinkToAnotheRecord column. 

#### Example : Primary Value highlighted in actor table
<img width="547" alt="actor" src="https://user-images.githubusercontent.com/5435402/152645708-92b83985-4a0a-42b2-9d01-d26be70fd3aa.png">

#### Example : Primary Value highlighted in film table
<img width="1406" alt="film-table" src="https://user-images.githubusercontent.com/5435402/152645713-b4df99b2-4eb7-4fea-85f9-0baf47470ef3.png">

#### Example : Primary Value associated when LinkToAnotherRecord is created
<img width="753" alt="actor-film" src="https://user-images.githubusercontent.com/5435402/152645714-4061c94a-4cfb-44e5-b112-63cf4ed869fe.png">


## How is Primary Value identfied for existing database tables ?
- It is usually the first column after the primary key which is not a number. 
- If there is no column which is not a number then the column adjacent to primary key is chosen. 

## Can I change the Primary Value to another column within tables ?
- Yes, you can. Hover over column which you want as primary column and click ```Set as Primary Value``` 
