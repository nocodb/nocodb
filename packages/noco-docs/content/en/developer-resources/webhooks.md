---
title: 'Webhooks'
description: 'Webhooks'
position: 400
category: 'Developer Resources'
menuTitle: 'Webhooks'
---


## Triggers available
Webhooks allows user to trigger on certain operations on following database operations
- AFTER INSERT
- AFTER UPDATE
- AFTER DELETE

The triggers will trigger asynchronously without blocking the actual operation.

## Trigger to following applications/services

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

