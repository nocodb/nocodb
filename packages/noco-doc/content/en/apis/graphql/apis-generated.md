---
title: 'GraphQL APIs'
position: 2
category: 'API'
fullscreen: true
menuTitle: 'GraphQL APIs'
---
# Features
* APIs 
    * Generates GraphQL APIs for **ANY** MySql, Postgres, MSSQL, Sqlite database :fire:
    * Serves GraphQL queries irrespective of naming conventions of primary keys, foreign keys, tables etc :fire:
    * Support for composite primary keys :fire:
    * Usual suspects : CRUD, List, FindOne, Count, Exists, Distinct
    * Pagination 
    * Sorting
    * Column filtering - Fields :fire:  
    * Row filtering - Where :fire:
    * Bulk insert, Bulk delete, Bulk read :fire:   
    * Relations - automatically detected
    * Aggregate functions
    * More
        * Upload single file
        * Upload multiple files
        * Download file
* Authentication
* Access Control


# GraphQL API Overview

### Query

|  **Resolver**  |   **Arguments** | **Returns** | **Description**  |
|---|---|---|---|
| [TableName**List**](#tablenamelist) | where: String, limit: Int, offset: Int, sort: String | [TableName] | List of table rows |
| [TableName**Read**](#tablenameread) | id:String |  TableName | Get row by primary key |
| [TableName**Exists**](#tablenameexists) | id: String | Boolean | Check row exists by primary key |
| [TableName**FindOne**](#tablenamefindone) | where: String | TableName | Find row by where conditions |
| [TableName**Count**](#tablenamecount) | where: String | Int | Get rows count |
| [TableName**Distinct**](#tablenamedistinct) | columnName: String, where: String, limit: Int, offset: Int, sort: String | [TableName] | Get distinct rows based on provided column names |
| [TableName**GroupBy**](#tablenamegroupby) | fields: String, having: String, limit: Int, offset: Int, sort: String | [TableNameGroupBy] | Group rows by provided columns |
| [TableName**Aggregate**](#tablenameaggregate) | columnName: String!, having: String, limit: Int, offset: Int, sort: String, func: String! | [TableNameAggregate] | Do aggregation based on provided column name aggregate function |
| [TableName**Distribution**](#tablenamedistribution) | min: Int, max: Int, step: Int, steps: String, columnName: String! | [distribution] | Get distributed list |
	

### Mutations

|  **Resolver**  |   **Arguments** | **Returns** | **Description**  |
|---|---|---|---|
| [TableName**Create**](#tablenamecreate) | data:TableNameInput | TableName | Insert row into table |
| [TableName**Update**](#tablenameupdate) | id:String,data:TableNameInput | TableName | Update table row using primary key |
| [TableName**Delete**](#tablenamedelete) | id:String | TableName |  Delete table row using primary id |
| [TableName**CreateBulk**](#tabelenamecreatebulk) | data: [TableNameInput] | [Int] | Bulk row insert |
| [TableName**UpdateBulk**](#tablenamebulk) | data: [TableNameInput] | [Int] | Bulk row update |
| [TableName**DeleteBulk**](#tablenamedeletebulk) | data: [TableNameInput] | [Int] | Bulk row delete  |

## Query Arguments

|  **Param**  | **Description** | **Default value**  |**Example Value**|
|---|---|---|---|
|  where  | Logical Expression | | `(colName,eq,colValue)~or(colName2,gt,colValue2)` <br />[Usage: Comparison operators](#comparison-operators) <br />[Usage: Logical operators](#logical-operators) |
|  limit  |  Number of rows to get(SQL limit value)  | 10  | 20 |
|  offset |  Offset for pagination(SQL offset value)  | 0  | 20 |
|  sort  |  Sort column name, where use `-` as prefix for descending sort  |   | column_name |
|  fields |  Required column names in result  |  * | column_name_1,column_name_2 |

#### Comparison operators

```
eq      -   '='         -  (colName,eq,colValue)
not     -   '!='        -  (colName,ne,colValue)
gt      -   '>'         -  (colName,gt,colValue)
ge      -   '>='        -  (colName,ge,colValue)
lt      -   '<'         -  (colName,lt,colValue)
le      -   '<='        -  (colName,le,colValue)
is      -   'is'        -  (colName,is,true/false/null)
isnot   -   'is not'    -  (colName,isnot,true/false/null)
in      -   'in'        -  (colName,in,val1,val2,val3,val4)
btw     -   'between'   -  (colName,btw,val1,val2) 
nbtw    -  'not between'-  (colName,nbtw,val1,val2) 
like    -   'like'      -  (colName,like,%name)
```

#### Example use of comparison operators - complex example
```
PaymentList(where:"(checkNumber,eq,JM555205)~or((amount,gt,200)~and(amount,lt,2000))") 
```


#### Logical operators
```
~or     -   'or'
~and    -   'and'
~not    -   'not'
```

### TableNameList
#### Request
```
  CountryList {
    country_id
    country
    last_update
  }
```  
#### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country_id": 1,
        "country": "Afghanistan",
        "last_update": "1139978640000",
        "CityCount": 1
      },
      {
        "country_id": 2,
        "country": "Algeria",
        "last_update": "1139978640000",
        "CityCount": 3
      },
      {
        "country_id": 3,
        "country": "American Samoa",
        "last_update": "1139978640000",
        "CityCount": 1
      }
}
```



#### List + where  

##### Request
```
{
  CountryList(where:"(country,like,United%)") {
    country_id
    country
    last_update
    CityCount
  }
}
``` 

[Usage : comparison operators](#comparison-operators)

##### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country_id": 101,
        "country": "United Arab Emirates",
        "last_update": "1139958840000",
        "CityCount": 3
      },
      {
        "country_id": 102,
        "country": "United Kingdom",
        "last_update": "1139958840000",
        "CityCount": 8
      },
      {
        "country_id": 103,
        "country": "United States",
        "last_update": "1139958840000",
        "CityCount": 35
      }
    ]
  }
}
```






#### List + where + sort

##### Request
```
{
  CountryList(where:"(country,like,United%)",sort:"-country") {
    country_id
    country
    last_update
    CityCount
  }
}
``` 

##### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country_id": 103,
        "country": "United States",
        "last_update": "1139958840000",
        "CityCount": 35
      },
      {
        "country_id": 102,
        "country": "United Kingdom",
        "last_update": "1139958840000",
        "CityCount": 8
      },
      {
        "country_id": 101,
        "country": "United Arab Emirates",
        "last_update": "1139958840000",
        "CityCount": 3
      }
    ]
  }
}
```




# Features
* APIs 
    * Generates GraphQL APIs for **ANY** MySql, Postgres, MSSQL, Sqlite database :fire:
    * Serves GraphQL queries irrespective of naming conventions of primary keys, foreign keys, tables etc :fire:
    * Support for composite primary keys :fire:
    * Usual suspects : CRUD, List, FindOne, Count, Exists, Distinct
    * Pagination 
    * Sorting
    * Column filtering - Fields :fire:  
    * Row filtering - Where :fire:
    * Bulk insert, Bulk delete, Bulk read :fire:   
    * Relations - automatically detected
    * Aggregate functions
    * More
        * Upload single file
        * Upload multiple files
        * Download file
* Authentication
* Access Control


# GraphQL API Overview

### Query

|  **Resolver**  |   **Arguments** | **Returns** | **Description**  |
|---|---|---|---|
| [TableName**List**](#tablenamelist) | where: String, limit: Int, offset: Int, sort: String | [TableName] | List of table rows |
| [TableName**Read**](#tablenameread) | id:String |  TableName | Get row by primary key |
| [TableName**Exists**](#tablenameexists) | id: String | Boolean | Check row exists by primary key |
| [TableName**FindOne**](#tablenamefindone) | where: String | TableName | Find row by where conditions |
| [TableName**Count**](#tablenamecount) | where: String | Int | Get rows count |
| [TableName**Distinct**](#tablenamedistinct) | columnName: String, where: String, limit: Int, offset: Int, sort: String | [TableName] | Get distinct rows based on provided column names |
| [TableName**GroupBy**](#tablenamegroupby) | fields: String, having: String, limit: Int, offset: Int, sort: String | [TableNameGroupBy] | Group rows by provided columns |
| [TableName**Aggregate**](#tablenameaggregate) | columnName: String!, having: String, limit: Int, offset: Int, sort: String, func: String! | [TableNameAggregate] | Do aggregation based on provided column name aggregate function |
| [TableName**Distribution**](#tablenamedistribution) | min: Int, max: Int, step: Int, steps: String, columnName: String! | [distribution] | Get distributed list |
	

### Mutations

|  **Resolver**  |   **Arguments** | **Returns** | **Description**  |
|---|---|---|---|
| [TableName**Create**](#tablenamecreate) | data:TableNameInput | TableName | Insert row into table |
| [TableName**Update**](#tablenameupdate) | id:String,data:TableNameInput | TableName | Update table row using primary key |
| [TableName**Delete**](#tablenamedelete) | id:String | TableName |  Delete table row using primary id |
| [TableName**CreateBulk**](#tabelenamecreatebulk) | data: [TableNameInput] | [Int] | Bulk row insert |
| [TableName**UpdateBulk**](#tablenamebulk) | data: [TableNameInput] | [Int] | Bulk row update |
| [TableName**DeleteBulk**](#tablenamedeletebulk) | data: [TableNameInput] | [Int] | Bulk row delete  |

## Query Arguments

|  **Param**  | **Description** | **Default value**  |**Example Value**|
|---|---|---|---|
|  where  | Logical Expression | | `(colName,eq,colValue)~or(colName2,gt,colValue2)` <br />[Usage: Comparison operators](#comparison-operators) <br />[Usage: Logical operators](#logical-operators) |
|  limit  |  Number of rows to get(SQL limit value)  | 10  | 20 |
|  offset |  Offset for pagination(SQL offset value)  | 0  | 20 |
|  sort  |  Sort column name, where use `-` as prefix for descending sort  |   | column_name |
|  fields |  Required column names in result  |  * | column_name_1,column_name_2 |

#### Comparison operators

```
eq      -   '='         -  (colName,eq,colValue)
not     -   '!='        -  (colName,ne,colValue)
gt      -   '>'         -  (colName,gt,colValue)
ge      -   '>='        -  (colName,ge,colValue)
lt      -   '<'         -  (colName,lt,colValue)
le      -   '<='        -  (colName,le,colValue)
is      -   'is'        -  (colName,is,true/false/null)
isnot   -   'is not'    -  (colName,isnot,true/false/null)
in      -   'in'        -  (colName,in,val1,val2,val3,val4)
btw     -   'between'   -  (colName,btw,val1,val2) 
nbtw    -  'not between'-  (colName,nbtw,val1,val2) 
like    -   'like'      -  (colName,like,%name)
```

#### Example use of comparison operators - complex example
```
PaymentList(where:"(checkNumber,eq,JM555205)~or((amount,gt,200)~and(amount,lt,2000))") 
```


#### Logical operators
```
~or     -   'or'
~and    -   'and'
~not    -   'not'
```

### TableNameList
#### Request
```
  CountryList {
    country_id
    country
    last_update
  }
```  
#### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country_id": 1,
        "country": "Afghanistan",
        "last_update": "1139978640000",
        "CityCount": 1
      },
      {
        "country_id": 2,
        "country": "Algeria",
        "last_update": "1139978640000",
        "CityCount": 3
      },
      {
        "country_id": 3,
        "country": "American Samoa",
        "last_update": "1139978640000",
        "CityCount": 1
      }
}
```



#### List + where  

##### Request
```
{
  CountryList(where:"(country,like,United%)") {
    country_id
    country
    last_update
    CityCount
  }
}
``` 

[Usage : comparison operators](#comparison-operators)

##### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country_id": 101,
        "country": "United Arab Emirates",
        "last_update": "1139958840000",
        "CityCount": 3
      },
      {
        "country_id": 102,
        "country": "United Kingdom",
        "last_update": "1139958840000",
        "CityCount": 8
      },
      {
        "country_id": 103,
        "country": "United States",
        "last_update": "1139958840000",
        "CityCount": 35
      }
    ]
  }
}
```






#### List + where + sort + offset

##### Request
```
{
  CountryList(where:"(country,like,United%)",sort:"-country",offset:1) {
    country_id
    country
    last_update
    CityCount
  }
}
``` 

##### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country_id": 102,
        "country": "United Kingdom",
        "last_update": "1139958840000",
        "CityCount": 8
      },
      {
        "country_id": 101,
        "country": "United Arab Emirates",
        "last_update": "1139958840000",
        "CityCount": 3
      }
    ]
  }
}
```





#### List + limit

##### Request
```
{
  CountryList(limit:6) {
    country
  }
}
``` 

##### Response
```json
{
  "data": {
    "CountryList": [
      {
        "country": "Afghanistan"
      },
      {
        "country": "Algeria"
      },
      {
        "country": "American Samoa"
      },
      {
        "country": "Angola"
      },
      {
        "country": "Anguilla"
      },
      {
        "country": "Argentina"
      }
    ]
  }
}
```





[:arrow_heading_up:](#query)

### TableNameRead
#### Request
```
 CountryRead(id:"1") {
   country_id
   country
   last_update
 }
```

#### Response
```json
  "data": {
    "CountryRead": {
      "country_id": 1,
      "country": "Afghanistan",
      "last_update": "1139978640000",
      "CityCount": 1
    }
  }
```

[:arrow_heading_up:](#query)

### TableNameExists
#### Request
```
 CountryExists(id:"1")
```

#### Response
```json
  "data": {
    "CountryExists": true
  }
```

[:arrow_heading_up:](#query)

### TableNameFindOne
#### Request
```
 CountryFindOne(where:"(country_id,eq,1)") {
   country_id
   country
   last_update
   CityCount
 }
```

#### Response
```json
  "data": {
    "CountryFindOne": {
      "country_id": 1,
      "country": "Afghanistan",
      "last_update": "1139978640000",
      "CityCount": 1
    }
  }
```

[:arrow_heading_up:](#query)

### TableNameCount
#### Request
```
CountryCount
```

#### Response
```json
  "data": {
    "CountryCount": 109
  }
```

[:arrow_heading_up:](#query)

### TableNameDistinct
#### Request
```
{
  CountryDistinct(columnName:"last_update",limit:3) {
    last_update
  }
}
```

#### Response
```json
{
  "data": {
    "CountryDistinct": [
      {
        "last_update": "1139958840000"
      },
      {
        "last_update": "1578323893000"
      },
      {
        "last_update": "1578321201000"
      }
    ]
  }
}
```

[:arrow_heading_up:](#query)

### TableNameGroupBy
#### Request
```
{
  CountryGroupBy(fields:"last_update",limit:1) {
    country_id
    country
    last_update
    count
  }
}
```

#### Response
```json
{
  "data": {
    "CountryGroupBy": [
      {
        "country_id": null,
        "country": null,
        "last_update": "1139958840000",
        "count": 109
      }
    ]
  }
}
```

[:arrow_heading_up:](#query)

### TableNameAggregate
#### Request
```
{
  PaymentAggregate(columnName:"amount",func:"min,max,avg,count") {
    count
    avg
    min
  }
}
```

#### Response
```json
{
  "data": {
    "PaymentAggregate": [
      {
        "count": 16048,
        "avg": 4.200743,
        "min": 0
      }
    ]
  }
}
```

[:arrow_heading_up:](#query)

### TableNameDistribution
#### Request
```
{
  PaymentDistribution (columnName:"amount"){
    range
    count
  }
}
```

#### Response
```json
{
  "data": {
    "PaymentDistribution": [
      {
        "range": "0-4",
        "count": 8302
      },
      {
        "range": "5-8",
        "count": 3100
      },
      {
        "range": "9-11.99",
        "count": 371
      }
    ]
  }
}
```

[:arrow_heading_up:](#mutations)

### TableNameCreate
#### Request
```
mutation {
  CountryCreate(data: {country: "test"}) {
    country_id
    country
    last_update
    CityCount
  }
}
```

#### Response
```json
{
  "data": {
    "CountryCreate": {
      "country_id": 10264,
      "country": "test",
      "last_update": null,
      "CityCount": 0
    }
  }
}
```

[:arrow_heading_up:](#mutations)

### TableNameUpdate
#### Request
```
mutation {
  CountryUpdate(data: {country: "test_new"}, id: "10264") {
    country_id
    country
    last_update
    CityCount
  }
}
```

#### Response
```json
{
  "data": {
    "CountryUpdate": {
      "country_id": null,
      "country": null,
      "last_update": null,
      "CityCount": null
    }
  }
}
```

[:arrow_heading_up:](#mutations)

### TableNameDelete
#### Request
```
mutation {
  CountryDelete(id: "10264") {
    country_id
    country
    last_update
    CityCount
  } 
}
```

#### Response
```json
{
  "data": {
    "CountryDelete": {
      "country_id": null,
      "country": null,
      "last_update": null,
      "CityCount": null
    }
  }
}
```

[:arrow_heading_up:](#mutations)

### TableNameCreateBulk
#### Request
```
mutation {
  CountryCreateBulk(data:[{country:"test 2"},{country:"test 3"}])
}
```

#### Response
```json
{
  "data": {
    "CountryCreateBulk": [
      10265
    ]
  }
}
```

[:arrow_heading_up:](#mutations)

### TableNameUpdateBulk
#### Request
```
mutation {
  CountryUpdateBulk(data: [{country: "test 2", country_id: 10265}, {country: "test 3", country_id: 10266}])
}
```

#### Response
```json
{
  "data": {
    "CountryUpdateBulk": [
      1,
      1
    ]
  }
}
```

[:arrow_heading_up:](#mutations)

### TableNameDeleteBulk
#### Request
```
mutation {
  CountryDeleteBulk(data: [{country_id: 10265}, {country_id: 10266}])
}
```

#### Response
```json
{
  "data": {
    "CountryDeleteBulk": [
      1,
      1
    ]
  }
}
```
