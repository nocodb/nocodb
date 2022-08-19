---
title: 'FAQs'
description: 'General FAQs'
position: 1000000
category: 'FAQ'
menuTitle: 'FAQs'
---

## How to upgrade NocoDB ?

- Please see [here](https://docs.nocodb.com/getting-started/upgrading) 

## How to export CSV from the grid view ?

- Available since [0.81.1](https://github.com/nocodb/nocodb/releases/tag/0.81.1)

## How to share the project with read only access ?

- Either you can invite by email with 'viewer' access control
- Share the base with publicly accessible link. Available since [0.82.0](https://github.com/nocodb/nocodb/releases/tag/0.82.0) 

## How to check my current NocoDB version ? 

- You can hover the NocoDB icon on the top left corner or check ``PackageVersion`` in Project info.

![image](https://user-images.githubusercontent.com/35857179/164968969-da53adda-97fc-4a79-9331-039ddef75a13.png)

## How to check my Project info ?

- You can click on top right icon and click ``Copy Project Info``.

![image](https://user-images.githubusercontent.com/35857179/164968940-6c987863-e7d8-4b44-a46d-2f755825af0a.png)

You should see the similar result as below.

```
Node: **v16.14.0**
Arch: **arm64**
Platform: **darwin**
Docker: **false**
Database: **mysql2**
ProjectOnRootDB: **false**
RootDB: **mysql2**
PackageVersion: **0.90.0**
```

## What is available in free version ?

- NocoDB has just one version that is free & open source.
- In it you will notice advanced features are all available for free.
    - ACL
    - Collaboration
    - Advanced views : Form View, Gallery view, Kanban (coming soon)
    - Share view, 
    - Embed view 
    - Password protected view,
    - Automations
    - API token support.    
- And we would never move these features from free to an enterprise version of NocoDB.
- There is no limitations to number of projects, rows or columns either.

## What is the difference between Auth Token and API Token ?

Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable `NC_JWT_EXPIRES_IN`. If you are passing Auth Token, make sure that the header is called `xc-auth`.

API Token is a Nano ID with a length of 40. If you are passing API Token, make sure that the header is called `xc-token`.

## Do you plan to have Enterprise Edition ?

For features that make sense for enterprises like below - yes 
- SSO, SLA, Organisation wide reports and analytics, 
- Advanced Audit or ACL,  
- Bespoke implementations & integrations,
- A hosted solution.
   
And increasing number of our customers are requesting it.  

## How do we decide if a feature is Enterprise or not ?

- Depends on the effort and whether the intended users are enterprises.
 
