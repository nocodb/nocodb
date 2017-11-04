![npm version](https://img.shields.io/node/v/xmysql.svg)
[![Build Status](https://travis-ci.org/o1lab/xmysql.svg?branch=master)](https://travis-ci.org/o1lab/xmysql)
[![GitHub stars](https://img.shields.io/github/stars/o1lab/xmysql.svg?style=plastic)](https://github.com/o1lab/xmysql/stargazers)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/o1lab/xmysql/master/LICENSE)

# xmysql : One command to generate REST APIs for any MySql database
Powered by popular node packages : ([express](https://github.com/expressjs/express), [mysql](https://github.com/mysqljs/mysql)) => { [xmysql](https://github.com/o1lab/xmysql) }

# Why this ?
<p align="center">
  <img src="https://media.giphy.com/media/xUOxf88tjN0AN7uUfu/source.gif" alt="xmysql gif"/>
</p>

Generating REST APIs for a MySql database which does not follow conventions of 
frameworks such as rails, django etc is a small adventure that one like to avoid ..

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
That is it! Happy hackery! 


# Example : Generating REST APIs for [Magento DB](http://www.magereverse.com/index/magento-sql-structure/version/1-7-0-2) 
[Magento](https://magento.com/) is a popular E-commerce platform 

<p align="center">
  <img src="https://media.giphy.com/media/xUOxf88tjN0AN7uUfu/source.gif" alt="xmysql gif"/>
</p>


# Features
* Generates API for **ANY** MySql database 
* Serves APIs irrespective of naming conventions of primary keys, foreign keys, tables etc
* CRUD : Usual suspects   
* Support for composite primary keys
* Pagination 
* Sorting 
* Column filtering - Fields 
* Row filtering - Where
* Group By, Having (as query params) 
* Group By (as a separate route)
* Aggregate functions 
* Relations  
* Run dynamic queries
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
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/count
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/exists
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/groupby
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/aggregate
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/parentTable/:id/childTable 
* DELETE&nbsp;  /api/tableName/:id
* POST&nbsp;&nbsp;&nbsp;&nbsp;    /dynamic

## Other APIS
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tableName/describe
* GET&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;     /api/tables

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
```
/api/payments?_where=(checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933)
```

eg: complex parentheses
```
/api/payments?_where=((checkNumber,eq,JM555205)~or(checkNumber,eq,OM314933))~and(amount,gt,100)
```

eg: where with sorting(_sort), pagination(_p), column filtering (_fields)
```
/api/payments?_where=(amount,gte,1000)&_sort=-amount&p=2&&_fields=customerNumber
```

eg: filter of rows using _where is available for relational route URLs too.
```
/api/offices/1/employees?_where=(jobTitle,eq,Sales%20Rep)
```

## Group By

```
/api/offices/groupby?_fields=country
```
eg: SELECT country,count(*) FROM offices GROUP BY country

```
/api/offices/groupby?_fields=country,city
```
eg: SELECT country,city,count(*) FROM offices GROUP BY country,city

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


## Aggregate functions :jack_o_lantern: :sunglasses:

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



## Relational Tables
xmysql identifies foreign key relations automatically and provides GET api.
```
/api/customers/103/payments
```
eg: Customers is parent table and payments is child table. API invocation will result in all payments with customer 103.


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
* If you are in need of a full blown MVC framework, ACL, Authorisation etc - Not this.
* Other times not mentioned in when to use section 


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