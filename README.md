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

That is it! Happy hackery! 
<!-- Place this tag where you want the button to render. -->


# Example : Generate REST APIs for [Magento](http://www.magereverse.com/index/magento-sql-structure/version/1-7-0-2)

Powered by popular node packages : ([express](https://github.com/expressjs/express), [mysql](https://github.com/mysqljs/mysql)) => { [xmysql](https://github.com/o1lab/xmysql) }
<p align="center">
  <img src="./assets/log.gif" alt="xmysql gif"  height="400" width="750"/>
</p>


<!-- AddToAny BEGIN -->
<div align="right">
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
* Generates API for **ANY** MySql database 
* :fire::fire: Serves APIs irrespective of naming conventions of primary keys, foreign keys, tables etc
* Support for composite primary keys
* CRUD, List, FindOne, Count, Exists   
* Relations
* Pagination 
* Sorting
* :fire: Column filtering - Fields 
* :fire: Row filtering - Where
* Aggregate functions
* :fire::fire: Group By, Having (as query params) 
* :fire::fire: Group By, Having (as a separate API) 
* :fire::fire: Multiple group by in one API 
* :fire::fire: Chart API for numeric column 
* Prototyping (features available with ONLY local MySql server)
    * Run dynamic queries :fire::fire::fire:
    * Upload single file
    * Upload multiple files
    * Download file

Use HTTP clients like [Postman](https://www.getpostman.com/) or [similar tools](https://chrome.google.com/webstore/search/http%20client?_category=apps) to invoke REST API calls

____

Download [node](https://nodejs.org/en/download/current/), 
[mysql](https://dev.mysql.com/downloads/mysql/) 
[(setup mysql)](https://dev.mysql.com/doc/mysql-getting-started/en/#mysql-getting-started-installing), 
[sample database](https://dev.mysql.com/doc/employee/en/employees-installation.html) -
if you haven't on your system.


## Root URL
Root URL (localhost:3000/) returns all REST API urls for each table in schema.


## CRUD APIs Usual Suspects
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName
* POST&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;          /api/tableName
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/:id
* PUT&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/:id
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/findOne
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/count
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/:id/exists
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/parentTable/:id/childTable 
* DELETE&nbsp;  /api/tableName/:id

## API with HOT features
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/aggregate
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/groups  :fire::fire: **[ HOTNESS ALERT ]**
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/groupby :fire::fire: 
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/ugroupby  :fire::fire: **[ HOTNESS ALERT ]**
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/chart  :fire::fire: **[ HOTNESS ALERT ]**

## API for Prototyping :snowboarder: :snowboarder: 
* POST&nbsp;&nbsp;&nbsp;&nbsp;    /dynamic
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /upload
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /uploads
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /download
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/describe
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tables


## Relational Tables
xmysql identifies foreign key relations automatically and provides GET api.
```
/api/blogs/103/comments
```
eg: blogs is parent table and comments is child table. API invocation will result in all comments for blog primary key 103.


## Support for composite primary keys

#### ___ (three underscores)

```
/api/payments/103___JM555205
```
*___* : If there are multiple primary keys - seperate them by three underscores as shown

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
eq  -   '='
ne  -   '!='
gt  -   '>'
gte -   '>='
lt  -   '<'
lte -   '<='
```
#### Use of comparison operators
```
/api/payments?_where=(checkNumber,eq,JM555205)
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
/api/payments?_where=(amount,gte,1000)&_sort=-amount&p=2&&_fields=customerNumber
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

## Count
```
/api/tableName/count
```

Returns number of rows in table

## Exists
```
/api/tableName/1/exists
```

Returns true or false depending on whether record exists


## Group By, Having (as query params)

```
/api/offices?_groupby=country
```
eg: SELECT country,count(*) FROM offices GROUP BY country

```
/api/offices?_groupby=country&_having=(_count,gt,1)
```
eg: SELECT country,count(1) as _count FROM offices GROUP BY country having _count > 1


## Group By, Having (as a seperate route)

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


## Group By, Order By

```
/api/offices/groupby?_fields=country,city&sort=city
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city ORDER BY city ASC

```
/api/offices/groupby?_fields=country,city&sort=city,country
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city ORDER BY city ASC, country ASC

```
/api/offices/groupby?_fields=country,city&sort=city,-country
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city ORDER BY city ASC, country DESC


## Aggregate functions

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

## Union of many group by statements :fire::fire:**[ HOTNESS ALERT ]**

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


## Chart :fire::fire: **[ HOTNESS ALERT ]**

Chart API returns distribution of a numeric column in a table

It comes in three flavours

1. Chart : With min, max, step in query params :fire::fire:

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

3. Chart : with no params :fire::fire:

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

Please Note:
_fields in Chart API can only take numeric column as its argument.  


## Run dynamic queries
Dynamic queries on a database can be run by POST method to URL localhost:3000/dynamic 

This is enabled only when using local mysql server i.e -h localhost or -h 127.0.0.1 option.

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

```
POST /upload
```
Do POST operation on /upload url with multiform 'field' assigned to local file to be uploaded

eg: curl --form file=@/Users/me/Desktop/a.png http://localhost:3000/upload

returns uploaded file name else 'upload failed'

(Note: POSTMAN has issues with file uploading hence examples with curl) 


## Upload multiple files
```
POST /uploads
```
Do POST operation on /uploads url with multiform 'fields' assigned to local files to be uploaded

> Notice 's' near /api/upload**s** and file**s** in below example

eg: curl --form files=@/Users/me/Desktop/a.png --form files=@/Users/me/Desktop/b.png  http://localhost:3000/uploads

returns uploaded file names as string

## Download file
http://localhost:3000/download?name=fileName

> For upload and download of files -> you can specify storage folder using -s option
> Upload and download apis are available only with local mysql server 

## When to use ?
* You need just REST APIs without much hassle for (ANY) MySql database.
* You are learning new frontend frameworks and need REST APIs for your MySql database.
* You are working on a demo, hacks etc

## When NOT to use ?
* If you are in need of a full blown MVC framework, ACL, Authorisation etc - its early days please watch/star this repo. Thank you.


### Command line options

```
  Options:

    -V, --version            output the version number
    -h, --host <n>           hostname of mysql
    -d, --database <n>       database schema name
    -u, --user <n>           username of database / root by default
    -p, --password <n>       password of database / empty by default
    -n, --portNumber <n>     port number / 3000 by default
    -s, --storageFolder <n>  storage folder / current working dir by default
    -h, --help               output usage information

  Examples:

    $ xmysql -u username -p password -d databaseSchema
```
<!-- AddToAny BEGIN -->
<div align="right">
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

Simply build with `docker build -t xmysql .` and run with `docker run -p 3000:3000 -d xmysql`

The best way for testing is to run mysql in a docker container too and create a docker network, so that `xmysql` can access the `mysql` container with a name from docker network.

1. Create network 
    * `docker network create mynet`
2. Start mysql with docker name `some-mysql` and bind to docker network `mynet`
    * `docker run --name some-mysql -p 3306:3306 --net mynet -e MYSQL_ROOT_PASSWORD=password -d mysql`
3. build xmysql container (if not done yet)
    * `docker build -t xmysql .`
4. run xmysql and set env variable for `some-mysql` from step 2
    * `docker run -p 3000:3000 -d -e DATABASE_HOST=some-mysql --net mynet xmysql`

You can also pass the environment variables to a file and use them as an option with docker like `docker run --env-file ./env.list -p 3000:3000 --net mynet -d xmysql`

environment variables which can be used:

```
ENV DATABASE_HOST 127.0.0.1
ENV DATABASE_USER root
ENV DATABASE_PASSWORD password
ENV DATABASE_NAME sakila
```


# Tests : setup on local machine

Login to mysql shell

```
mysql> create database classicmodels
mysql> use classicmodels
mysql> source path_to/xmysql/tests/sample.sql
```

```
$ mocha tests/*.js --exit
```