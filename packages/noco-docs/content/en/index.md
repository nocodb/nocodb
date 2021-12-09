---
title: 'NocoDB Documentation'
description: 'NocoDB Documentation'
position: 0
category: 'Welcome'
menuTitle: 'Introduction'
---

## Welcome!

NocoDB is an open source Airtable alternative.

NocoDB works by connecting to any relational database and transforming them into a smart spreadsheet interface! This allows you to build no-code applications collaboratively with teams. NocoDB currently works with MySQL, PostgreSQL, Microsoft SQL Server, SQLite, Amazon Aurora & MariaDB databases.

Also NocoDB's app store allows you to build business workflows on views with combination of Slack, Microsoft Teams, Discord, Twilio, Whatsapp, Email & any 3rd party APIs too. Plus NocoDB provides programmatic access to APIs so that you can build integrations with Zapier / Integromat and custom applications too.

<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a" />

## Features

### Rich Spreadsheet Interface
- ⚡ &nbsp;Search, sort, filter, hide columns with uber ease
- ⚡ &nbsp;Create Views : Grid, Gallery, Kanban, Gantt, Form
- ⚡ &nbsp;Share Views : public & password protected
- ⚡ &nbsp;Personal & locked Views 
- ⚡ &nbsp;Upload images to cells (Works with S3, Minio, GCP, Azure, DigitalOcean, Linode, OVH, BackBlaze)!!
- ⚡ &nbsp;Roles : Owner, Creator, Editor, Commenter, Viewer, Commenter, Custom Roles.
- ⚡ &nbsp;Access Control : Fine-grained access control even at database, table & column level.

### App Store for workflow automations
- ⚡ &nbsp;Chat : Microsoft Teams, Slack, Discord, Mattermost
- ⚡ &nbsp;Email : SMTP, SES, Mailchimp
- ⚡ &nbsp;SMS : Twilio
- ⚡ &nbsp;Whatsapp
- ⚡ &nbsp;Any 3rd Party APIs

### Programmatic API access via
- ⚡ &nbsp;REST APIs (Swagger) 
- ⚡ &nbsp;GraphQL APIs.
- ⚡ &nbsp;Includes JWT Authentication & Social Auth
- ⚡ &nbsp;API tokens to integrate with Zapier, Integromat.



##  Why are we building this ? 🎯 
Most internet businesses equip themselves with either spreadsheet or a database to solve their business needs. Spreadsheets are used by a Billion+ humans collaboratively every single day. However, we are way off working at similar speeds on databases which are way more powerful tools when it comes to computing. Attempts to solve this with SaaS offerings has meant horrible access controls, vendor lockin, data lockin, abrupt price changes & most importantly a glass ceiling on what's possible in future.

## Our Mission :  ❤ 
Our mission is to provide the most powerful no-code interface for databases which is open source to every single internet business in the world. This would not only democratise access to a powerful computing tool but also bring forth a billion+ people who will have radical tinkering-and-building abilities on internet. 



## Architecture - Simple Overview

<img src="architecture.png" style="background: white;border-radius:4px;padding :10px">

<br>
<br>

| Project Type | Metadata stored in | Data stored in |
|---------|-----------|--------|
| Create new project | NC_DB | NC_DB |
| Create new project with external DB | NC_DB | External database |

## NocoDB repository structure

We use ``Lerna`` to manage multi-packages. We have the following [packages](https://github.com/nocodb/nocodb/tree/master/packages).

- ``packages/nc-cli`` : A CLI to create NocoDB app.

- ``packages/nc-common``: A common library package used internally.

- ``packages/nc-gui``: NocoDB Frontend.

- ``packages/nc-lib-gui``: The build version of ``nc-gui`` which will be used in ``packages/nocodb``.

- ``packages/nc-migrator-archived``: SQL based schema migrations or evolutions.

- ``packages/nc-plugin``: Plugin template.

- ``packages/noco-blog``: NocoDB Blog which will be auto-released to [nocodb/noco-blog](https://github.com/nocodb/noco-blog).

- ``packages/noco-book``: NocoDB Handbook which will be auto-released to [nocodb/noco-book](https://github.com/nocodb/noco-book).

- ``packages/noco-docs``: NocoDB Documentation which will be auto-released to [nocodb/noco-docs](https://github.com/nocodb/noco-docs).

- ``packages/nocodb``: NocoDB Backend, hosted in [NPM](https://www.npmjs.com/package/nocodb).


## Contributions

All contributions are welcome. NocoDB projects can be found in the [NocoDB](https://github.com/nocodb) Github organization. Our core uses [The AGPL V3 license](https://github.com/nocodb/nocodb/blob/master/LICENSE) and all contributors should read the [contribution guides](https://github.com/nocodb/nocodb/tree/master/scripts/contribute) before making your first contribution. 

You can also share your thoughts and discuss with our community members via [discord](https://discord.gg/5RgZmkW) or [Github Discussion](https://github.com/nocodb/nocodb/discussions). We also share our [Immediate Roadmap](https://github.com/nocodb/nocodb/projects/1) and all opinions are welcome.

## Support

If you have any issues or questions, you can reach out for help in our [discord](https://discord.gg/5RgZmkW).