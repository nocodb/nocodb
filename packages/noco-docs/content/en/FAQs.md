---
title: 'FAQs'
description: 'FAQs'
position: 10000
category: 'FAQ'
fullscreen: true
menuTitle: 'FAQs'
---

## Which are the supported databases ?

Currently we supports most ost of the SQL databases Postgres, MySQL, MariaDB, SQL Server and SQLite3.

## Is it completely free ?

Currently you can use the product without any cost

## Which platforms it supports ?

You can run it any machine with help of Node or Docker

## Are the APIs secure - does it have Auth and ACL ?

NocoDB is fully secure with built in session based authentication and authorisation. We currently support Google and Facebook Authorisation.
Authentication also covers things related to email verification, forgot password & reset password. Support for 3rd party Auth libraries Auth0, Firebase, Amazon Cognito will be there in future.

## Is it possible to ignore certain tables from the view ?

Yes, you can disable it from the UI

## Is Access Control List (ACL) or Role Based Access Control (RBAC) ?

NocoDB not only auto generates access control list for all the tables but also provides GUI to manage these permissions for each category of users and models. Again, these ACL are done in really modular way such that each ACL file is associated with its corresponding router and middleware file.

ACL/RBAC enables developer to manage fine grained access to underlying models to various category of users.

## Does APIs have pagination ?

Yes all APIs have built in pagination.

## Is there support for Swagger API specification for REST APIs ?

NocoDB automatically generates swagger documentation for all the REST APIs so that you have to never write one from scartch! Generated documentation is done in a really modular way so that each router file is associated with a swagger documentation. This makes it really easy to follow and update.

Swagger is the most adapted open source API documentation. Swagger's interactive live documentation not only helps developer to understand APIs but also to invoke the APIs.

## Can the APIs resist SQL injection attacks ?

Prepared SQL queries which are safe are executed when data is fetched from Database.

## How to data validation for models ?

You can write really complex and data validation function within the models generated for you.

## How to check my current NocoDB version ? 

You can hover the NocoDB icon on the top left corner or check ``PackageVersion`` in Project info.

![image](https://user-images.githubusercontent.com/35857179/127765903-3ae876ad-6b46-4520-9d11-679b80eb7b08.png)

## How to check my Project info ?

You can click on top right icon and click ``Copy Project Info``.

![image](https://user-images.githubusercontent.com/35857179/127765860-968b0c64-f08d-4674-9ecc-4d5c5a00428b.png)

You should see the following result.

```
Node: **v16.5.0**
Arch: **x64**
Platform: **darwin**
Docker: **false**
Database: **sqlite3**
ProjectOnRootDB: **true**
RootDB: **sqlite3**
PackageVersion: **0.11.6**
```

## I have more questions ?

Please join our wonderful community at [Discord](https://discord.gg/5RgZmkW) or post your questions on [Github Discussion](https://github.com/nocodb/nocodb/discussions)