---
title: 'GraphQL APIs'
position: 21
category: 'Developer Resources'
menuTitle: 'GraphQL APIs'
---

## Features

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


## API Overview

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

### Query params

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

## Examples

### TableNameList

<code-group>
  <code-block label="Request" active> 
  
```
CountryList {
    country_id
    country
    last_update
}
```  
</code-block>
<code-block label="Response">

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
    ]
  }
}
```

  </code-block> 
</code-group>


#### List + where  
<code-group>
  <code-block label="Request" active> 
  
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


</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[Usage : comparison operators](#comparison-operators)





#### List + where + sort
<code-group>
  <code-block label="Request" active> 
  
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

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


#### List + where + sort + offset
<code-group>
  <code-block label="Request" active> 
  
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

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>




#### List + limit

<code-group>
  <code-block label="Request" active> 
  
```
{
  CountryList(limit:6) {
    country
  }
}
``` 

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>






[⤴](#query)

### TableNameRead
<code-group>
  <code-block label="Request" active> 
  
```
 CountryRead(id:"1") {
   country_id
   country
   last_update
 }
```

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[⤴](#query)

### TableNameExists
<code-group>
  <code-block label="Request" active> 
  
```
 CountryExists(id:"1")
```

</code-block>
<code-block label="Response">

```json
  "data": {
    "CountryExists": true
  }
```
  </code-block> 
</code-group>


[⤴](#query)

### TableNameFindOne
<code-group>
  <code-block label="Request" active> 
  
```
 CountryFindOne(where:"(country_id,eq,1)") {
   country_id
   country
   last_update
   CityCount
 }
```

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[⤴](#query)

### TableNameCount
<code-group>
  <code-block label="Request" active> 
  
```
CountryCount
```

</code-block>
<code-block label="Response">

```json
{
 "data": {
    "CountryCount": 109
  }
}
```

  </code-block> 
</code-group>


[⤴](#query)

### TableNameDistinct
<code-group>
  <code-block label="Request" active> 
  
```
{
  CountryDistinct(columnName:"last_update",limit:3) {
    last_update
  }
}
```

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[⤴](#query)

### TableNameGroupBy
<code-group>
  <code-block label="Request" active> 
  
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

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[⤴](#query)

### TableNameAggregate
<code-group>
  <code-block label="Request" active> 
  
```
{
  PaymentAggregate(columnName:"amount",func:"min,max,avg,count") {
    count
    avg
    min
  }
}
```

</code-block>
<code-block label="Response">

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

[⤴](#query)

### TableNameDistribution
<code-group>
  <code-block label="Request" active> 
  
```
{
  PaymentDistribution (columnName:"amount"){
    range
    count
  }
}
```

</code-block>
<code-block label="Response">

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

  </code-block> 
</code-group>

[⤴](#mutations)

### TableNameCreate
<code-group>
  <code-block label="Request" active> 
  
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

</code-block>
<code-block label="Response">

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

  </code-block> 
</code-group>

[⤴](#mutations)

### TableNameUpdate
<code-group>
  <code-block label="Request" active> 
  
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

</code-block>
<code-block label="Response">

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

  </code-block> 
</code-group>

[⤴](#mutations)

### TableNameDelete
<code-group>
  <code-block label="Request" active> 
  
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

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[⤴](#mutations)

### TableNameCreateBulk
<code-group>
  <code-block label="Request" active> 
  
```
mutation {
  CountryCreateBulk(data:[{country:"test 2"},{country:"test 3"}])
}
```

</code-block>
<code-block label="Response">

```json
{
  "data": {
    "CountryCreateBulk": [
      10265
    ]
  }
}
```
  </code-block> 
</code-group>


[⤴](#mutations)

### TableNameUpdateBulk
<code-group>
  <code-block label="Request" active> 
  
```
mutation {
  CountryUpdateBulk(data: [{country: "test 2", country_id: 10265}, {country: "test 3", country_id: 10266}])
}
```

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>


[⤴](#mutations)

### TableNameDeleteBulk
<code-group>
  <code-block label="Request" active> 
  
```
mutation {
  CountryDeleteBulk(data: [{country_id: 10265}, {country_id: 10266}])
}
```

</code-block>
<code-block label="Response">

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
  </code-block> 
</code-group>

