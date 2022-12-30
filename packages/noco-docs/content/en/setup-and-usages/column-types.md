---
title: 'Column Types'
description: 'NocoDB Column Types Overview'
position: 530
category: 'Product'
menuTitle: 'Column Types'
---

## Available Column Types

| Type | Description |
|---|---|
| [ID](#id) | Primary column of the table |
| [LinkToAnotherRecord](#linktoanotherrecord) | Has Many or Many To Many columns |
| [ForeignKey](#foreignkey)|  Belongs To relation  |
| [SingleLineText](#singlelinetext) |  For short text |
| [LongText](#longtext) | For lengthy string content |
| [Attachment](#attachment) | File attachment column |
| [Checkbox](#checkbox) | Boolean value |
| [MultiSelect](#multiselect) |  Multiple options can be selected once |
| [SingleSelect](#singleselect) |  Single option select |
| [Date](#date) | Date selector |
| [Year](#year) | Year selector |
| [Time](#time) | Time selector |
| [PhoneNumber](#phonenumber) | Phone number field |
| [Email](#email) | Email field |
| [URL](#url) | Valid URL field |
| [Number](#number) | Any type of number |
|[Decimal](#decimal)| Fractional number |
|[Currency](#currency)| Currency value |
|[Percent](#percent)| Percentage |
|[Duration](#duration)|  Duration |
|[Rating](#rating)| Rating |
|[Formula](#formula)|  Formula based generated column |
|[QR Code](#qr-code)|  QR Code visualization of another referenced column |
|[Barcode](#barcode)|  Barcode visualization of another referenced column |
| [Count](#count) | |
|[DateTime](#datetime)| Date & Time selector |
|[CreateTime](#createtime)| |
|[AutoNumber](#autonumber)| |
|[Geometry](#geometry)|  Geometry column |
|[SpecificDBType](#specificdbtype)| Custom DB type option |




## Database Types


### ID

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|_All types are available_|int|
|**PostgreSQL**|_All types are available_|int4|
|**SQL Server**|_All types are available_|int|
|**SQLite**|_All types are available_|integer|

### LinkToAnotherRecord

N/A

### ForeignKey
#### Available Database Types
|Database| Types|
|-----|----------|
|**MySQL**|_All types are available_|
|**PostgreSQL**|_All types are available_|
|**SQL Server**|_All types are available_|
|**SQLite**|_All types are available_|


### SingleLineText
#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|char, varchar, nchar, text, tinytext, mediumtext, longtext|varchar|
|**PostgreSQL**|char, character, character varying, text|character varying|
|**SQL Server**|char, ntext, text, varchar, nvarchar|varchar|
|**SQLite**|character, text, varchar|varchar|

### LongText

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|char,  varchar,  nchar,  text,  tinytext,  mediumtext,  longtext|text|
|**PostgreSQL**|char, character, character varying, text|text|
|**SQL Server**|char, ntext, text, varchar, nvarchar|text|
|**SQLite**|character, text, varchar|text|

### Attachment

#### Available Database Types
|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|json, char,  varchar,  nchar,  text,  tinytext,  mediumtext,  longtext| text |
|**PostgreSQL**|json, char, character, character varying, text| text |
|**SQL Server**|char, ntext, text, varchar, nvarchar| text |
|**SQLite**|character, text, varchar|text|

### Checkbox

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|int, smallint, mediumint, bigint, bit, boolean, serial, tinyint|tinyint|
|**PostgreSQL**|bit, bool, int2, int4, int8, boolean, smallint, int, integer, bigint, bigserial, char, int4range, int8range, serial, serial2, serial8|bool|
|**SQL Server**|bigint, bit, int, tinyint|tinyint|
|**SQLite**|int, integer, tinyint, smallint, mediumint, bigint, int2, int8, boolean||

### MultiSelect

#### Available Database Types
|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|set, text, tinytext, mediumtext, longtext|set|
|**PostgreSQL**|text|text|
|**SQL Server**|text, ntext|text|
|**SQLite**|text, varchar|text|

### SingleSelect

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|enum, text, tinytext, mediumtext, longtext|enum|
|**PostgreSQL**|text|text|
|**SQL Server**|text, ntext|text|
|**SQLite**|text, varchar|text|

### Date

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|date, datetime, timestamp, varchar|varchar|
|**PostgreSQL**||date, timestamp, timestamp without time zone, timestamptz, timestamp with time zone | date
|**SQL Server**|date|date|
|**SQLite**|date, varchar|varchar|

### Year

#### Available Database Types
|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|year|year|
|**PostgreSQL**|int|int|
|**SQL Server**|int|int|
|**SQLite**|int, integer, tinyint, smallint, mediumint, bigint, int2, int8|year|

### Time

#### Available Database Types
|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|time|time|
|**PostgreSQL**|time, time without time zone, timestamp, timestamp without time zone, timestamptz, timestamp with time zone, timetz, time with time zone|time|
|**SQL Server**|time|time|
|**SQLite**|int, integer, tinyint, smallint, mediumint, bigint, int2, int8|time|

### PhoneNumber

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|varchar|varchar|
|**PostgreSQL**|character varying|character varying|
|**SQL Server**|varchar|varchar|
|**SQLite**|varchar, text|varchar|

### Email

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|varchar|varchar|
|**PostgreSQL**|character varying|character varying|
|**SQL Server**|varchar|varchar|
|**SQLite**|varchar, text|varchar|

### URL

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|text, tinytext, mediumtext, longtext, varchar|varchar|
|**PostgreSQL**|character varying, text|character varying|
|**SQL Server**|varchar, text|varchar|
|**SQLite**|varchar, text|varchar|

### Number

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|int, smallint, mediumint, bigint, bit, float, decimal, double, serial|int|
|**PostgreSQL**|int, integer, bigint, bigserial, int2, int4, int8, serial, serial2, serial8, double precision, float4, float8, smallint, smallserial|int8|
|**SQL Server**|int, bigint, bit, decimal, float, numeric, real, smallint, tinyint|int|
|**SQLite**|int, integer, tinyint, smallint, mediumint, bigint, int2, int8, numeric, real, double, double precision, float|integer|

### Decimal

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|float, decimal, double, serial|decimal|
|**PostgreSQL**|double precision,float4,float8|decimal|
|**SQL Server**|decimal, float|decimal|
|**SQLite**|real, double, double precision, float, numericdecimal|

### Currency

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|decimal, float, double, serial', 'int, smallint, mediumint, bigint, bit|decimal|
|**PostgreSQL**|int, integer, bigint, bigserial, int2, int4, int8, serial, serial2, serial8, double precision, money', 'float4, float8|decimal|
|**SQL Server**|int, bigint, bit, decimal, float, numeric, real, smallint, tinyint|decimal|
|**SQLite**|real, double, double precision, float, int, integer, tinyint, smallint, mediumint, bigint, int2, int8, numeric|double precision|

### Percent

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|decimal, float, double, serial', 'int, smallint, mediumint, bigint, bit|double|
|**PostgreSQL**|int, integer, bigint, bigserial, int2, int4, int8, serial, serial2, serial8, double precision, float4, float8, smallint, smallserial|double|
|**SQL Server**|int, bigint, bit, decimal, float, numeric, real, smallint, tinyint|double|
|**SQLite**|real, double, double precision, float, int, integer, tinyint, smallint, mediumint, bigint, int2, int8, numeric|double|

### Duration

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|decimal, float, double, serial', 'int, smallint, mediumint, bigint, bit|int|
|**PostgreSQL**|int, integer, bigint, bigserial, int2, int4, int8, serial, serial2, serial8, double precision, float4, float8, smallint, smallserial|int8|
|**SQL Server**|int, bigint, bit, decimal, float, numeric, real, smallint, tinyint|int|
|**SQLite**|int, integer, tinyint, smallint, mediumint, bigint, int2, int8|integer|

### Rating

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|decimal, float, double, serial', 'int, smallint, mediumint, bigint, bit|float|
|**PostgreSQL**|int, integer, bigint, bigserial, int2, int4, int8, serial, serial2, serial8, double precision, float4, float8, smallint, smallserial|float8|
|**SQL Server**|int, bigint, bit, decimal, float, numeric, real, smallint, tinyint|float|
|**SQLite**|real, double, double precision, float, int, integer, tinyint, smallint, mediumint, bigint, int2, int8, numeric|float|

### Formula

For more about formula, please visit [here](./formulas).

### QR-Code

Encodes the value of a reference column as QR code. The following column types are supported for the for reference column: 
* Formula
* Single Line Text
* Long Text
* Phone Number
* URL 
* Email

Since it's a virtual column, the cell content (QR code) cannot be changed directly. 

### Barcode

Encodes the value of a reference column as Barcode. Supported barcode formats: CODE128, EAN, EAN-13, EAN-8, EAN-5, EAN-2, UPC (A), CODE39, ITF-14, MSI, Pharmacode, Codabar. The following column types are supported for the for reference column: 
* Formula
* Single Line Text
* Long Text
* Phone Number
* URL 
* Email

Since it's a virtual column, the cell content (Barcode) cannot be changed directly.
### Count

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|int, smallint, mediumint, bigint, serial|int|
|**PostgreSQL**|int, integer, bigint, bigserial, int2, int4, int8, serial, serial2, serial8, smallint, smallserial|int8|
|**SQL Server**|int, bigint, smallint, tinyint|int|
|**SQLite**|int, integer, tinyint, smallint, mediumint, bigint, int2, int8|integer|

### DateTime

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|datetime, timestamp, varchar|datetime|
|**PostgreSQL**|timestamp, timestamp without time zone, timestamptz, timestamp with time zone|datetime|
|**SQL Server**|datetime, datetime2, datetimeoffset|datetime|
|**SQLite**|datetime, timestamp|datetime|

### CreateTime

#### Available Database Types

|Database| Types| Default Type|
|-----|----------|----------|
|**MySQL**|datetime, timestamp, varchar|datetime|
|**PostgreSQL**|timestamp, timestamp without time zone, timestamptz, timestamp with time zone|datetime|
|**SQL Server**|datetime, datetime2, datetimeoffset|datetime|
|**SQLite**|datetime, timestamp|datetime|


### Geometry

#### Available Database Types

|Database| Types|
|-----|----------|
|**MySQL**|geometry, point, linestring, polygon, multipoint, multilinestring, multipolygon|
|**PostgreSQL**|polygon, point, circle, box, line, lseg, path, circle|
|**SQL Server**|geometry|
|**SQLite**|text|

### SpecificDBType

#### Available Database Types
|Database| Types|
|-----|----------|
|**MySQL**|_All types are available_|
|**PostgreSQL**|_All types are available_|
|**SQL Server**|_All types are available_|
|**SQLite**|_All types are available_|













