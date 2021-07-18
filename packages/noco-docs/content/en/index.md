---
title: 'NocoDB Documentation'
description: 'NocoDB Documentation'
position: 0
category: 'Getting started'
fullscreen: true
menuTitle: 'Introduction'
---

## Welcome!

NocoDB is an open source Airtable alternative.

NocoDB works by connecting to any relational database and transforming them into a smart spreadsheet interface! This allows you to build no-code applications collaboratively with teams. NocoDB currently works with MySQL, PostgreSQL, Microsoft SQL Server, SQLite, Amazon Aurora & MariaDB databases.

Also NocoDB's app store allows you to build business workflows on views with combination of Slack, Microsoft Teams, Discord, Twilio, Whatsapp, Email & any 3rd party APIs too. Plus NocoDB provides programmatic access to APIs so that you can build integrations with Zapier / Integromat and custom applications too.

## Architecture

<img src="architecture.png" style="background: white;border-radius:4px;padding :10px">

<br>
<br>

| Project Type | Metadata stored in | Data stored in |
|---------|-----------|--------|
| Create new project | NC_DB | NC_DB |
| Create new project with external DB | NC_DB | External database |