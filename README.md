![npm version](https://img.shields.io/node/v/xmysql.svg)
[![Build Status](https://travis-ci.org/o1lab/xmysql.svg?branch=master)](https://travis-ci.org/o1lab/xmysql)
[![GitHub stars](https://img.shields.io/github/stars/o1lab/xmysql.svg?style=plastic)](https://github.com/o1lab/xmysql/stargazers)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/o1lab/xmysql/master/LICENSE)

# xmysql: one command to generate REST APIs for **any** MySql database

## Why this ?
Generating REST APIs quickly for a MySql database which does not follow conventions of 
frameworks such as rails, django etc is a small adventure that one rather like to avoid ..

<p align="center">
  <img src="https://media.giphy.com/media/8gWrk3QZrjF1C/giphy.gif" alt="Rick & Morty"/>
</p>

Hence this.

Powered by node packages : ([express](https://github.com/expressjs/express), [mysql](https://github.com/mysqljs/mysql)) => { [xmysql](https://github.com/o1lab/xmysql) }


## Setup and Usage
```
npm install -g xmysql
```
```
xmysql -h localhost -u mysqlUsername -p mysqlPassword -d databaseName
```
```
http://localhost:3000
```

That's it!

## Features
* Generates API for **ANY** MySql database 
* Serves APIs irrespective of naming conventions of primary keys, foreign keys, tables etc
* CRUD : Usual suspects   
* Support for composite primary keys
* Pagination
* Sorting
* Fields
* Relations
* Run dynamic queries


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


## Sorting

#### _sort

```
/api/payments?_sort=column1
```
eg: sorts ascending by column1

```
/api/payments?_sort=-column1
```
eg: sorts descending by column1

```
/api/payments?_sort=column1,-column2
```
eg: sorts ascending by column1 and descending by column2


## Fields
```
/api/payments?_fields=customerNumber,checkNumber
```
eg: gets only customerNumber and checkNumber in response of each record
```
/api/payments?_fields=-checkNumber
```
eg: gets all fields in table row but not checkNumber


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
## Relational Tables
xmysql identifies foreign key relations automatically and provides GET api.
```
/api/customers/103/payments
```
eg: Customers is parent table and payments is child table. API invocation will result in all payments with customer 103.
 


## When to use ?
* You need just REST APIs without much hassle for (ANY) MySql database.
* You are learning new frontend frameworks and need REST APIs for your MySql database.
* You are working on a demo, hacks etc

## When NOT to use ?
* If you are in need of a full blown MVC framework, ACL, Authorisation etc - Not this.
* Other times not mentioned in when to use section





