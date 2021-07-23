---
title: 'API Webhooks'
description: 'API Webhooks'
position: 14
category: 'Setup and Usages'
menuTitle: 'API Webhooks'
---



Webhooks allows user to trigger certain operation on following database operations
- INSERT
- UPDATE
- DELETE
The hook can trigger `before` or `after` a certain operation and the triggers will trigger asynchronously without blocking the actual operation.

## Available Triggers

| Trigger | Details |
|-------|-------|
|Email| Send email to certain email addresses |
|Slack| Notify via Slack channel |
|Microsoft Teams| Notify via Microsoft Teams channel |
|Discord| Notify via Discord channel|
|Mattermost| Notify via Mattermost channel|
|Twilio| Send SMS to certain mobile numbers |
|Whatsapp Twilio| Send Whatsapp messages to numbers using Twilio |
|URL| Invoke an HTTP API |

## Accessing Data

The current row data and other details will be available in the hooks payload so the user can use [handlebar syntax](https://handlebarsjs.com/guide/#simple-expressions) to use data. 

> We are using [Handlebars](https://handlebarsjs.com/) library to parse the payload internally.

### Available values in context

| Name | Details | Example|
|-------|-------|-------|
| **data** | Contains row data | `{{ data.Title }}` |
| **user** | Logginned user object | `{{ user.id }}` |
| **env** | Environment values | `{{ env.SITE_URL }}` |

