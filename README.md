![npm version](https://img.shields.io/node/v/xmysql.svg)
[![Build Status](https://travis-ci.org/o1lab/xmysql.svg?branch=master)](https://travis-ci.org/o1lab/xmysql)
[![GitHub stars](https://img.shields.io/github/stars/o1lab/xmysql.svg?style=plastic)](https://github.com/o1lab/xmysql/stargazers)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/o1lab/xmysql/master/LICENSE)

# Xmysql : One command to generate REST APIs for any MySql database

# Why this ?
<p align="center">
  <img src="./assets/rick-and-morty.gif" alt="xmysql gif"/>
</p>

Generating REST APIs for a MySql database which does not follow conventions of 
frameworks such as rails, django, laravel etc is a small adventure that one like to avoid ..

Hence this.

# Setup and Usage

xmysql requires node >= 7.6.0

```
npm install -g xmysql
```
```
xmysql -h localhost -u mysqlUsername -p mysqlPassword -d databaseName
```
```
http://localhost:3000
```
<br>

That is it! Simple and minimalistic! 

Happy hackery!
 
<!-- Place this tag where you want the button to render. -->


# Example : Generate REST APIs for [Magento](http://www.magereverse.com/index/magento-sql-structure/version/1-7-0-2)

Powered by popular node packages : ([express](https://github.com/expressjs/express), [mysql](https://github.com/mysqljs/mysql)) => { [xmysql](https://github.com/o1lab/xmysql) }
<p align="center">
  <img src="./assets/log.gif" alt="xmysql gif" width="750"/>
</p>

 
<!-- AddToAny BEGIN -->
<div align="right">
<h3>Boost Your Hacker Karma By Sharing : </h3>
<a href="https://www.addtoany.com/add_to/sina_weibo?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/weibo.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/renren?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20Database%20" target="_blank"><img src="./assets/renren.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/douban?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20Database%20" target="_blank"><img src="./assets/doubon.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/vk?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/vk.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/wykop?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20Database%20" target="_blank"><img src="./assets/wykop.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/linkedin?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/linkedin.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/reddit?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/reddit.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/facebook?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/facebook.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/twitter?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/twitter.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/hacker_news?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=Show%20HN:%20REST%20APIs%20for%20Magento%20database%20within%20seconds!" target="_blank"><img src="./assets/hn1.png" width="32" height="32"></a>
</div>
<!-- AddToAny END -->



# Features
* Generates API for **ANY** MySql database :fire::fire:
* Serves APIs irrespective of naming conventions of primary keys, foreign keys, tables etc :fire::fire:
* Support for composite primary keys :fire::fire:
* REST API Usual suspects : CRUD, List, FindOne, Count, Exists, Distinct
* Bulk insert, Bulk delete, Bulk read :fire:   
* Relations
* Pagination 
* Sorting
* Column filtering - Fields :fire:  
* Row filtering - Where :fire:
* Aggregate functions
* Group By, Having (as query params) :fire::fire:  
* Group By, Having (as a separate API) :fire::fire:  
* Multiple group by in one API :fire::fire::fire::fire:
* Chart API for numeric column :fire::fire::fire::fire::fire::fire:
* Auto Chart API - (a gift for lazy while prototyping) :fire::fire::fire::fire::fire::fire:
* [XJOIN - (Supports any number of JOINS)](#xjoin) :fire::fire::fire::fire::fire::fire::fire::fire::fire:
* Supports views  
* Prototyping (features available when using local MySql server only)
    * Run dynamic queries :fire::fire::fire:
    * Upload single file
    * Upload multiple files
    * Download file
* Health and version apis
* Use more than one CPU Cores
* [Docker support](#docker) and [Nginx reverse proxy config](#nginx-reverse-proxy-config-with-docker) :fire::fire::fire: - Thanks to [@markuman](https://github.com/markuman)  
* AWS Lambda Example - Thanks to [@bertyhell](https://github.com/bertyhell) :fire::fire::fire:


Use HTTP clients like [Postman](https://www.getpostman.com/) or [similar tools](https://chrome.google.com/webstore/search/http%20client?_category=apps) to invoke REST API calls

____

Download [node](https://nodejs.org/en/download/current/), 
[mysql](https://dev.mysql.com/downloads/mysql/) 
[(setup mysql)](https://dev.mysql.com/doc/mysql-getting-started/en/#mysql-getting-started-installing), 
[sample database](https://dev.mysql.com/doc/employee/en/employees-installation.html) -
if you haven't on your system.


## API Overview

| HTTP Type | API URL                          | Comments                                               |
|-----------|----------------------------------|--------------------------------------------------------- 
| GET       | /                                | Gets all REST APIs                                     |
| GET       | /api/tableName                   | Lists rows of table                                    |
| POST      | /api/tableName                   | Create a new row                                       |
| PUT       | /api/tableName                   | Replaces existing row with new row                     |
| POST :fire:| /api/tableName/bulk             | Create multiple rows - send object array in request body|
| GET  :fire:| /api/tableName/bulk             | Lists multiple rows - /api/tableName/bulk?_ids=1,2,3   |
| DELETE :fire:| /api/tableName/bulk           | Deletes multiple rows - /api/tableName/bulk?_ids=1,2,3 |
| GET       | /api/tableName/:id               | Retrieves a row by primary key                         |
| PATCH     | /api/tableName/:id               | Updates row element by primary key                     |
| DELETE    | /api/tableName/:id               | Delete a row by primary key                            |
| GET       | /api/tableName/findOne           | Works as list but gets single record matching criteria |
| GET       | /api/tableName/count             | Count number of rows in a table                        |
| GET       | /api/tableName/distinct          | Distinct row(s) in table - /api/tableName/distinct?_fields=col1|
| GET       | /api/tableName/:id/exists        | True or false whether a row exists or not              |
| GET       | [/api/parentTable/:id/childTable](#relational-tables)             | Get list of child table rows with parent table foreign key   | 
| GET :fire:| [/api/tableName/aggregate](#aggregate-functions)                  | Aggregate results of numeric column(s)                 |
| GET :fire:| [/api/tableName/groupby](#group-by-having-as-api)                 | Group by results of column(s)                          |
| GET :fire:| [/api/tableName/ugroupby](#union-of-multiple-group-by-statements) | Multiple group by results using one call               |
| GET :fire:| [/api/tableName/chart](#chart)                                    | Numeric column distribution based on (min,max,step) or(step array) or (automagic)|
| GET :fire:| [/api/tableName/autochart](#autochart)                            | Same as Chart but identifies which are numeric column automatically - gift for lazy while prototyping|
| GET :fire:| [/api/xjoin](#xjoin)                                              | handles join                                        |
| GET :fire:| [/dynamic](#run-dynamic-queries)                                  | execute dynamic mysql statements with params           |
| GET :fire:| [/upload](#upload-single-file)                                    | upload single file                                     |
| GET :fire:| [/uploads](#upload-multiple-files)                                | upload multiple files                                  |
| GET :fire:| [/download](#download-file)                                       | download a file                                        |
| GET       | /api/tableName/describe                                           | describe each table for its columns      |
| GET       | /api/tables                                                       | get all tables in database                           |
| GET       | [/_health](#health)                                               | gets health of process and mysql -- details query params for more details |
| GET       | [/_version](#version)                                             | gets version of Xmysql, mysql, node|


## Relational Tables 
xmysql identifies foreign key relations automatically and provides GET api.
```
/api/blogs/103/comments
```
eg: blogs is parent table and comments is child table. API invocation will result in all comments for blog primary key 103.
[:arrow_heading_up:](#api-overview)


## Support for composite primary keys

#### ___ (three underscores)

```
/api/payments/103___JM555205
```
*___* : If there are multiple primary keys - separate them by three underscores as shown

## Pagination

#### _p & _size

_p indicates page and _size indicates size of response rows

By default 20 records and max of 100 are returned per GET request on a table.

```
/api/payments?_size=50
```
```
/api/payments?_p=2
```
```
/api/payments?_p=2&_size=50
```

When _size is greater than 100 - number of records defaults to 100 (i.e maximum)

When _size is less than or equal to 0 - number of records defaults to 20 (i.e minimum)

## Order by / Sorting 

#### ASC

```
/api/payments?_sort=column1
```
eg: sorts ascending by column1

#### DESC

```
/api/payments?_sort=-column1
```
eg: sorts descending by column1

#### Multiple fields in sort 

```
/api/payments?_sort=column1,-column2
```
eg: sorts ascending by column1 and descending by column2


## Column filtering / Fields
```
/api/payments?_fields=customerNumber,checkNumber
```
eg: gets only customerNumber and checkNumber in response of each record
```
/api/payments?_fields=-checkNumber
```
eg: gets all fields in table row but not checkNumber

## Row filtering / Where

#### Comparison operators

```
eq      -   '='         -  (colName,eq,colValue)
ne      -   '!='        -  (colName,ne,colValue)
gt      -   '>'         -  (colName,gt,colValue)
gte     -   '>='        -  (colName,gte,colValue)
lt      -   '<'         -  (colName,lt,colValue)
lte     -   '<='        -  (colName,lte,colValue)
is      -   'is'        -  (colName,is,true/false/null)
in      -   'in'        -  (colName,in,val1,val2,val3,val4)
bw      -   'between'   -  (colName,bw,val1,val2) 
like    -   'like'      -  (colName,like,~name)   note: use ~ in place of % 
nlike   -   'not like'  -  (colName,nlike,~name)  note: use ~ in place of %
```

#### Use of comparison operators
```
/api/payments?_where=(checkNumber,eq,JM555205)~or((amount,gt,200)~and(amount,lt,2000))
```

#### Logical operators
```
~or     -   'or'
~and    -   'and'
~xor    -   'xor'
```

#### Use of logical operators

eg: simple logical expression
```
/api/payments?_where=(checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933)
```

eg: complex logical expression
```
/api/payments?_where=((checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933))~and(amount,gt,100)
```

eg: logical expression with sorting(_sort), pagination(_p), column filtering (_fields)
```
/api/payments?_where=(amount,gte,1000)&_sort=-amount&p=2&_fields=customerNumber
```

eg: filter of rows using _where is available for relational route URLs too.
```
/api/offices/1/employees?_where=(jobTitle,eq,Sales%20Rep)
```

## FindOne
```
/api/tableName/findOne?_where=(id,eq,1)
```
Works similar to list but only returns top/one result. Used in conjunction with _where
[:arrow_heading_up:](#api-overview)

## Count
```
/api/tableName/count
```

Returns number of rows in table
[:arrow_heading_up:](#api-overview)

## Exists
```
/api/tableName/1/exists
```

Returns true or false depending on whether record exists
[:arrow_heading_up:](#api-overview)

## Group By Having as query params
[:arrow_heading_up:](#api-overview)

```
/api/offices?_groupby=country
```
eg: SELECT country,count(*) FROM offices GROUP BY country

```
/api/offices?_groupby=country&_having=(_count,gt,1)
```
eg: SELECT country,count(1) as _count FROM offices GROUP BY country having _count > 1


## Group By Having as API
[:arrow_heading_up:](#api-overview)

```
/api/offices/groupby?_fields=country
```
eg: SELECT country,count(*) FROM offices GROUP BY country

```
/api/offices/groupby?_fields=country,city
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city

```
/api/offices/groupby?_fields=country,city&_having=(_count,gt,1)
```
eg: SELECT country,city,count(*) as _count FROM offices GROUP BY country,city having _count > 1


### Group By, Order By
[:arrow_heading_up:](#api-overview)

```
/api/offices/groupby?_fields=country,city&_sort=city
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city ORDER BY city ASC

```
/api/offices/groupby?_fields=country,city&_sort=city,country
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city ORDER BY city ASC, country ASC

```
/api/offices/groupby?_fields=country,city&_sort=city,-country
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city ORDER BY city ASC, country DESC


## Aggregate functions
[:arrow_heading_up:](#api-overview)

```
http://localhost:3000/api/payments/aggregate?_fields=amount

response body
[
    {
        "min_of_amount": 615.45,
        "max_of_amount": 120166.58,
        "avg_of_amount": 32431.645531,
        "sum_of_amount": 8853839.23,
        "stddev_of_amount": 20958.625377426568,
        "variance_of_amount": 439263977.71130896
    }
]
```

eg: retrieves all numeric aggregate of a column in a table

```
http://localhost:3000/api/orderDetails/aggregate?_fields=priceEach,quantityOrdered

response body
[
    {
        "min_of_priceEach": 26.55,
        "max_of_priceEach": 214.3,
        "avg_of_priceEach": 90.769499,
        "sum_of_priceEach": 271945.42,
        "stddev_of_priceEach": 36.576811252187795,
        "variance_of_priceEach": 1337.8631213781719,
        "min_of_quantityOrdered": 6,
        "max_of_quantityOrdered": 97,
        "avg_of_quantityOrdered": 35.219,
        "sum_of_quantityOrdered": 105516,
        "stddev_of_quantityOrdered": 9.832243813502942,
        "variance_of_quantityOrdered": 96.67301840816688
    }
]
```

eg: retrieves numeric aggregate can be done for multiple columns too 

## Union of multiple group by statements 
[:arrow_heading_up:](#api-overview)

:fire::fire:**[ HOTNESS ALERT ]**

Group by multiple columns in one API call using _fields query params - comes really handy

```
http://localhost:3000/api/employees/ugroupby?_fields=jobTitle,reportsTo

response body
{  
   "jobTitle":[  
      {  
         "Sales Rep":17
      },
      {  
         "President":1
      },
      {  
         "Sale Manager (EMEA)":1
      },
      {  
         "Sales Manager (APAC)":1
      },
      {  
         "Sales Manager (NA)":1
      },
      {  
         "VP Marketing":1
      },
      {  
         "VP Sales":1
      }
   ],
   "reportsTo":[  
      {  
         "1002":2
      },
      {  
         "1056":4
      },
      {  
         "1088":3
      },
      {  
         "1102":6
      },
      {  
         "1143":6
      },
      {  
         "1621":1
      }
      {  
         "":1
      },
   ]
}
```


## Chart 
[:arrow_heading_up:](#api-overview)

:fire::fire::fire::fire::fire::fire: **[ HOTNESS ALERT ]**

Chart API returns distribution of a numeric column in a table

It comes in **SEVEN** powerful flavours

1. Chart : With min, max, step in query params :fire::fire:
[:arrow_heading_up:](#api-overview)

This API returns the number of rows where amount is between (0,25000), (25001,50000) ...

```
/api/payments/chart?_fields=amount&min=0&max=131000&step=25000

Response

[
  {
    "amount": "0 to 25000",
    "_count": 107
  },
  {
    "amount": "25001 to 50000",
    "_count": 124
  },
  {
    "amount": "50001 to 75000",
    "_count": 30
  },
  {
    "amount": "75001 to 100000",
    "_count": 7
  },
  {
    "amount": "100001 to 125000",
    "_count": 5
  },
  {
    "amount": "125001 to 150000",
    "_count": 0
  }
]

```

2. Chart : With step array in params :fire::fire:
[:arrow_heading_up:](#api-overview)

This API returns distribution between the step array specified

```
/api/payments/chart?_fields=amount&steparray=0,10000,20000,70000,140000

Response

[
  {
    "amount": "0 to 10000",
    "_count": 42
  },
  {
    "amount": "10001 to 20000",
    "_count": 36
  },
  {
    "amount": "20001 to 70000",
    "_count": 183
  },
  {
    "amount": "70001 to 140000",
    "_count": 12
  }
]


```

3. Chart : With step pairs in params :fire::fire:
[:arrow_heading_up:](#api-overview)

This API returns distribution between each step pair

```
/api/payments/chart?_fields=amount&steppair=0,50000,40000,100000

Response

[
    {"amount":"0 to 50000","_count":231},
    {"amount":"40000 to 100000","_count":80}
]


```

4. Chart : with no params :fire::fire:
[:arrow_heading_up:](#api-overview)

This API figures out even distribution of a numeric column in table and returns the data

```
/api/payments/chart?_fields=amount

Response
[
  {
    "amount": "-9860 to 11100",
    "_count": 45
  },
  {
    "amount": "11101 to 32060",
    "_count": 91
  },
  {
    "amount": "32061 to 53020",
    "_count": 109
  },
  {
    "amount": "53021 to 73980",
    "_count": 16
  },
  {
    "amount": "73981 to 94940",
    "_count": 7
  },
  {
    "amount": "94941 to 115900",
    "_count": 3
  },
  {
    "amount": "115901 to 130650",
    "_count": 2
  }
]

```

5. Chart : range, min, max, step in query params :fire::fire:
 [:arrow_heading_up:](#api-overview)
 
 This API returns the number of rows where amount is between (0,25000), (0,50000) ... (0,maxValue)
 
 Number of records for amount is counted from min value to extended *Range* instead of incremental steps
 
 ```
 /api/payments/chart?_fields=amount&min=0&max=131000&step=25000&range=1
 
 Response
 
[
    {
        "amount": "0 to 25000",
        "_count": 107
    },
    {
        "amount": "0 to 50000",
        "_count": 231
    },
    {
        "amount": "0 to 75000",
        "_count": 261
    },
    {
        "amount": "0 to 100000",
        "_count": 268
    },
    {
        "amount": "0 to 125000",
        "_count": 273
    }
]
 
 ```

6. Range can be specified with step array like below

 ```
/api/payments/chart?_fields=amount&steparray=0,10000,20000,70000,140000&range=1

[
    {
        "amount": "0 to 10000",
        "_count": 42
    },
    {
        "amount": "0 to 20000",
        "_count": 78
    },
    {
        "amount": "0 to 70000",
        "_count": 261
    },
    {
        "amount": "0 to 140000",
        "_count": 273
    }
]
 ```
 
7. Range can be specified without any step params like below

```
/api/payments/chart?_fields=amount&range=1

[
    {
        "amount": "-9860 to 11100",
        "_count": 45
    },
    {
        "amount": "-9860 to 32060",
        "_count": 136
    },
    ...
    
]

```

Please Note:
_fields in Chart API can only take numeric column as its argument.  

## Autochart

Identifies numeric columns in a table which are not any sort of key and applies chart API as before - 
feels like magic when there are multiple numeric columns in table while hacking/prototyping and you invoke this API.

```
http://localhost:3000/api/payments/autochart

[
    {
        "column": "amount",
        "chart": [
                    {
                        "amount": "-9860 to 11100",
                        "_count": 45
                    },
                    {
                        "amount": "11101 to 32060",
                        "_count": 91
                    },
                    {
                        "amount": "32061 to 53020",
                        "_count": 109
                    },
                    {
                        "amount": "53021 to 73980",
                        "_count": 16
                    },
                    {
                        "amount": "73981 to 94940",
                        "_count": 7
                    },
                    {
                        "amount": "94941 to 115900",
                        "_count": 3
                    },
                    {
                        "amount": "115901 to 130650",
                        "_count": 2
                    }
                ]
    }
]
```

## XJOIN

### Xjoin query params and values:

```
_join           :   List of tableNames alternated by type of join to be made (_j, _ij,_ lj, _rj)
alias.tableName :   TableName as alias
_j              :   Join [ _j => join, _ij => ij, _lj => left join , _rj => right join)
_onNumber       :   Number 'n' indicates condition to be applied for 'n'th join between (n-1) and 'n'th table in list  
``` 

#### Simple example of two table join:

Sql join query:

```sql

SELECT pl.field1, pr.field2
FROM productlines as pl
    JOIN products as pr
        ON pl.productline = pr.productline

```

Equivalent xjoin query API:
```
/api/xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.field1,pr.field2
```

#### Multiple tables join

Sql join query:
```sql
SELECT pl.field1, pr.field2, ord.field3
FROM productlines as pl
    JOIN products as pr
        ON pl.productline = pr.productline
    JOIN orderdetails as ord
        ON pr.productcode = ord.productcode
```

Equivalent xjoin query API:

```
/api/xjoin?_join=pl.productlines,_j,pr.products,_j,ord.orderDetails&_on1=(pl.productline,eq,pr.productline)&_on2=(pr.productcode,eq,ord.productcode)&_fields=pl.field1,pr.field2,ord.field3

```

**Explanation:**
> pl.productlines => productlines as pl

> _j => join

> pr.products => products as pl

> _on1 => join condition between productlines and products => (pl.productline,eq,pr.productline)

> _on2 => join condition between products and orderdetails => (pr.productcode,eq,ord.productcode)

Example to use : _fields, _where, _p, _size in query params  

```
/api/xjoin?_join=pl.productlines,_j,pr.products&_on1=(pl.productline,eq,pr.productline)&_fields=pl.productline,pr.productName&_size=2&_where=(productName,like,1972~)
```

Response:

```
[{"pl_productline":"Classic Cars","pr_productName":"1972 Alfa Romeo GTA"}]
```

Please note : 
Xjoin response has aliases for fields like below aliasTableName + '_' + columnName.   
eg: pl.productline in _fields query params - returns as pl_productline in response. 

## Run dynamic queries
[:arrow_heading_up:](#api-overview)

Dynamic queries on a database can be run by POST method to URL localhost:3000/dynamic 

This is enabled **ONLY when using local mysql server** i.e -h localhost or -h 127.0.0.1 option.

Post body takes two fields : query and params.

>query: SQL query or SQL prepared query (ones with ?? and ?)

>params : parameters for SQL prepared query
```
POST /dynamic   

    {
        "query": "select * from ?? limit 1,20",
        "params": ["customers"]
    }
```

POST /dynamic URL can have any suffix to it - which can be helpful in prototyping

eg:

``` 
POST /dynamic/weeklyReport
```

```
POST /dynamic/user/update
```


## Upload single file
[:arrow_heading_up:](#api-overview)

```
POST /upload
```
Do POST operation on /upload url with multiform 'field' assigned to local file to be uploaded

eg: curl --form file=@/Users/me/Desktop/a.png http://localhost:3000/upload

returns uploaded file name else 'upload failed'

(Note: POSTMAN has issues with file uploading hence examples with curl) 


## Upload multiple files
[:arrow_heading_up:](#api-overview)

```
POST /uploads
```
Do POST operation on /uploads url with multiform 'fields' assigned to local files to be uploaded

> Notice 's' near /api/upload**s** and file**s** in below example

eg: curl --form files=@/Users/me/Desktop/a.png --form files=@/Users/me/Desktop/b.png  http://localhost:3000/uploads

returns uploaded file names as string

## Download file
[:arrow_heading_up:](#api-overview)

http://localhost:3000/download?name=fileName

> For upload and download of files -> you can specify storage folder using -s option
> Upload and download apis are available only with local mysql server

## Health 
[:arrow_heading_up:](#api-overview)

http://localhost:3000/_health

```
{"process_uptime":3.858,"mysql_uptime":"2595"}
```

Shows up time of Xmysql process and mysql server


http://localhost:3000/_health?details=1

```
{"process_uptime":1.151,"mysql_uptime":"2798",
"os_total_memory":17179869184,
"os_free_memory":2516357120,
"os_load_average":[2.29931640625,2.1845703125,2.13818359375],
"v8_heap_statistics":{"total_heap_size":24735744,
"total_heap_size_executable":5242880,
"total_physical_size":23521048,
"total_available_size":1475503064,
"used_heap_size":18149064,
"heap_size_limit":1501560832,
"malloced_memory":8192,
"peak_malloced_memory":11065664,
"does_zap_garbage":0}}
```

Provides more details on process.

Infact passing any query param gives detailed health output: example below  

http://localhost:3000/_health?voila
```
{"process_uptime":107.793,"mysql_uptime":"2905","os_total_memory":17179869184,"os_free_memory":2573848576,"os_load_average":[2.052734375,2.12890625,2.11767578125],"v8_heap_statistics":{"total_heap_size":24735744,"total_heap_size_executable":5242880,"total_physical_size":23735016,"total_available_size":1475411128,"used_heap_size":18454968,"heap_size_limit":1501560832,"malloced_memory":8192,"peak_malloced_memory":11065664,"does_zap_garbage":0}}
```

## Version
[:arrow_heading_up:](#api-overview)

http://localhost:3000/_version

```
{"Xmysql":"0.4.1","mysql":"5.7.15","node":"8.2.1"}
```

## When to use ?
[:arrow_heading_up:](#api-overview)

* You need just REST APIs for (ANY) MySql database at blink of an eye (literally).
* You are learning new frontend frameworks and need REST APIs for your MySql database.
* You are working on a demo, hacks etc

## When NOT to use ?
[:arrow_heading_up:](#api-overview)

* If you are in need of a full blown MVC framework, ACL, Validations, Authorisation etc - its early days please watch/star this repo to keep a tab on progress. 


### Command line options
[:arrow_heading_up:](#api-overview)

```
  Options:

    -V, --version            Output the version number
    -h, --host <n>           Hostname of database -> localhost by default
    -u, --user <n>           Username of database -> root by default
    -p, --password <n>       Password of database -> empty by default
    -d, --database <n>       database schema name
    -r, --ipAddress <n>      IP interface of your server / localhost by default    
    -n, --portNumber <n>     Port number for app -> 3000 by default
    -o, --port <n>           Port number of mysql -> 3306 by default
    -a, --apiPrefix <n>      Api url prefix -> /api/ by default
    -s, --storageFolder <n>  Storage folder -> current working dir by default (available only with local)
    -i, --ignoreTables <n>   Comma separated table names to ignore
    -c, --useCpuCores <n>    Specify number of cpu cores to use / 1 by default / 0 to use max
    -y, --readOnly           readonly apis -> false by default    
    -h, --help               Output usage information

    
  Examples:

    $ xmysql -u username -p password -d databaseSchema
```
<!-- AddToAny BEGIN -->
<div align="right">
<h3>Boost Your Hacker Karma By Sharing : </h3>
<a href="https://www.addtoany.com/add_to/sina_weibo?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/weibo.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/renren?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20Database%20" target="_blank"><img src="./assets/renren.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/douban?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20Database%20" target="_blank"><img src="./assets/doubon.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/vk?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/vk.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/wykop?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20Database%20" target="_blank"><img src="./assets/wykop.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/linkedin?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/linkedin.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/reddit?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/reddit.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/facebook?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/facebook.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/twitter?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=One%20command%20to%20generate%20REST%20APIs%20for%20any%20MySql%20database." target="_blank"><img src="./assets/twitter.png" width="32" height="32"></a>
<a href="https://www.addtoany.com/add_to/hacker_news?linkurl=https%3A%2F%2Fgithub.com%2Fo1lab%2Fxmysql%2F&amp;linkname=Show%20HN:%20REST%20APIs%20for%20Magento%20database%20within%20seconds!" target="_blank"><img src="./assets/hn1.png" width="32" height="32"></a>
</div>
<!-- AddToAny END -->



# Docker
[:arrow_heading_up:](#features)

Simply run with `docker run -p 3000:80 -d markuman/xmysql:0.4.2`

The best way for testing is to run mysql in a docker container too and create a docker network, so that `xmysql` can access the `mysql` container with a name from docker network.

1. Create network 
    * `docker network create mynet`
2. Start mysql with docker name `some-mysql` and bind to docker network `mynet`
    * `docker run --name some-mysql -p 3306:3306 --net mynet -e MYSQL_ROOT_PASSWORD=password -d markuman/mysql`
3. run xmysql and set env variable for `some-mysql` from step 2
    * `docker run -p 3000:80 -d -e DATABASE_HOST=some-mysql --net mynet markuman/xmysql`

You can also pass the environment variables to a file and use them as an option with docker like `docker run --env-file ./env.list -p 3000:80 --net mynet -d markuman/xmysql`

environment variables which can be used:

```
ENV DATABASE_HOST 127.0.0.1
ENV DATABASE_USER root
ENV DATABASE_PASSWORD password
ENV DATABASE_NAME sakila
```

Furthermore, the docker container of xmysql is listen on port 80. You can than request it just with `http://xmysql/api/` in other services running in the same docker network.

## Debugging xmysql in docker.

Given you've deployed your xmysql docker container like 

```shell
docker run -d \
--network local_dev \
--name xmysql \
-p 3000:80 \
-e DATABASE_HOST=mysql_host \
-e DATABASE_USER=root \
-e DATABASE_PASSWORD=password \
-e DATABASE_NAME=sys \
markuman/xmysql:0.4.2
```

but the response is just

```json
["http://127.0.0.1:3000/api/tables","http://127.0.0.1:3000/api/xjoin"]
```

then obviously the connection to your mysql database failed.  

1. attache to the xmysql image
    * `docker exec -ti xmysql`
2. install mysql cli client
    * `apk --update --no-cache add mysql-client`
3. try to access your mysql database
   * `mysql-client -h mysql_host`
4. profit from the `mysql-client` error output and improve the environment variables for mysql

# Nginx Reverse Proxy Config with Docker
[:arrow_heading_up:](#features)

This is a config example when you use nginx as reverse proxy

```
events {
   worker_connections 1024;
   
}
http {
    server {
        server_name 127.0.0.1;
        listen 80 ;
        location / {
            rewrite ^/(.*) /$1 break;
            proxy_redirect off;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_pass http://127.0.0.1:3000;
        }
    }
}
```

e.g.

0. create a docker network `docker network create local_dev`
1. start a mysql server `docker run -d --name mysql -p 3306:3306 --network local_dev -e MYSQL_ROOT_PASSWORD=password mysql`
2. start xmysql `docker run -d --network local_dev --name xmyxql -e DATABASE_NAME=sys -e DATABASE_HOST=mysql -p 3000:80 markuman/xmysql:0.4.2`
3. start nginx on host system with the config above `sudo nginx -g 'daemon off;' -c /tmp/nginx.conf`
4. profit `curl http://127.0.0.1/api/host_summary_by_file_io_type/describe`

When you start your nginx proxy in a docker container too, use as `proxy_pass` the `--name` value of xmysql. E.g. `proxy_pass http://xmysql` (remember, xmysql runs in it's docker container already on port 80).


# Tests : setup on local machine
[:arrow_heading_up:](#api-overview)
```
docker-compose run test
```
* Requires `docker-compose` to be installed on your machine.
