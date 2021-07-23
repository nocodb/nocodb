---
title: 'FAQs'
description: 'FAQs'
position: 8
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

## I have more questions ?

Please join our wonderful community at [discord](https://discord.gg/5RgZmkW).