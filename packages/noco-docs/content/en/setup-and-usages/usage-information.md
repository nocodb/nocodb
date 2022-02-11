---
title: 'Usage Information'
description: 'Non-sensitive and anonymous usage information'
position: 900
category: 'Product'
menuTitle: 'Usage Information'
---

NocoDB is a fast growing open source project and we are committed to providing a solution that exceeds the expectations of the users and community.
We are also committed to continuing to develop and make NocoDB even better than it is today.
To that end, NocoDB contains a feature in which anonymous and otherwise non-sensitive data is collected.
This anonymous and non-sensitive data gives a better understanding of how users are interacting and using the product.

## Context
We will always continue to do hands-on UI/UX testing, surveys, issue tracking and roadmap. 
Otherwise talk with the Community while striving to understand 
and deliver what is being asked for and what is needed, by any means available.

However, these above actions alone are often insufficient to maintain an overall picture of the product usage. 

## What we collect ?
The following data is collected:
- Unique machine ID (generated with node-machine-id)
- Environment (dev, staging, production)
- System information (OS, node version, docker or npm)
- Failures and errors.
- Create and delete events of a project, table, view, linkToAnotherRecord, sharedView, user, hook, image, sharedBase.


## What we DO NOT collect ?
We do not collect private or sensitive information, such as:
- Personally identifiable information 
- Credential information (endpoints, ports, DB connections, username/password)
- User data


## Opt-out
To disable usage information collection please set following environment variable.
> NC_DISABLE_TELE=true

