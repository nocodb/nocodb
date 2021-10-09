---
title: 'How to access APIs ?'
description: 'How to access APIs ?'
position: 100
category: 'Developer Resources'
menuTitle: 'How to access APIs ?'
---

## REST APIs

- Go to NocoDB Project, click the rightmost button and click ``Copy auth token``.

![image](https://user-images.githubusercontent.com/35857179/126187328-745943f2-c780-4109-b967-1b3f1c4a1dcd.png)

- Click the same button and click ``Swagger APIs Doc``.

![image](https://user-images.githubusercontent.com/35857179/126187534-32c41de9-f17d-4f95-9acc-88aaed044b36.png)

- Select ``Schemes`` and Click ``Authorize``.

![image](https://user-images.githubusercontent.com/35857179/126188482-f3aacabf-dbc5-41a8-a190-9f225347ebd1.png)

- Paste the token you just copy in step 1 and click Authorize

![image](https://user-images.githubusercontent.com/35857179/126188510-b3790348-6809-4182-911a-a4031ace2fd2.png)

## GraphQL APIs

- Go to NocoDB Project, click the rightmost button and click ``Copy auth token``.

![image](https://user-images.githubusercontent.com/35857179/126187624-03ee550d-71eb-499f-ad8b-54e32a94f729.png)

- Click the same button and click ``GraphQL APIs`.

![image](https://user-images.githubusercontent.com/35857179/126187581-22503b8d-f6dd-4a4e-8b12-a475c27354a2.png)

- Click ``REQUEST HEADERS``.

![image](https://user-images.githubusercontent.com/35857179/126188122-1aa7b153-f05a-46fd-953b-751376d708bf.png)

- Paste the token you just copy in step 1.

```json
{
    "xc-auth": "YOUR_AUTH_TOKEN"
}
```