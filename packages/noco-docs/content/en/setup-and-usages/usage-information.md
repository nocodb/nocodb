---
title: 'Usage Information'
description: 'Non-sensitive and anonymous usage information'
position: 1200
category: 'Product'
menuTitle: 'Usage Information'
---

<announcement></announcement>

NocoDB is a fast growing open source project which is UI heavy and we are committed to providing a solution that exceeds the expectations of the users and community.
We are also committed to continuing to develop and make NocoDB even better than it is today.
To that end, NocoDB contains a feature in which anonymous and otherwise non-sensitive data is collected.
This anonymous and non-sensitive data gives a better understanding of how users are interacting and using the product.

## Context
We will always continue to do hands-on UI/UX testing, surveys, issue tracking and roadmap.
Otherwise talk with the Community while striving to understand
and deliver what is being asked for and what is needed, by any means available.

However, these above actions alone are often insufficient
- To maintain an overall picture of the product usage.
- Prioritising the efforts.
- Impact of any breaking changes.
- To understand whether UI improvements are helpful to users.

## What we collect ?
We collect actions made on models (project, table, view, sharedView, user, hook, image, sharedBase etc) periodically with :
- Unique machine ID (generated with node-machine-id)
- Environment (dev, staging, production)
- System information (OS, node version, docker or npm)
- Failures.

Here is an example :
```
{
    "machine_id" : "a0885e8e6a38d9fbb5d39e7d04a44da7773d4f",
    "evt_type": "project:created"
    "package_id" : "0.84.15",
    "os_type" : "Linux",
    "os_platform" : "linux",
    "os_release" : "5.10.25-linuxkit",
    "node_version" : "14.18.2",
    "docker" : "true",
    "xc_version" : "a0885e8e6a38d9fbb5d39e7d04a44da7773d4f",
    "env" : "dev",
}

```

Our UI Dashboard is a Vuejs-Nuxtjs app. Actions taken on UI with completely anonymized route names are sent as payload.

Here is an example :
```
{
    "id": "a0885e8e6a38d9fbb5d39e7d04a44da7773d4f",
    "event": "table:create",
    "path": "/nc/:project_id", 
}
```

## What we DO NOT collect ?
We do not collect any private or sensitive information, such as:
- Personally identifiable information
- Credential information (endpoints, ports, DB connections, username/password)
- User data


## Opt-out
To disable usage information collection please set following environment variable.
> NC_DISABLE_TELE=true
