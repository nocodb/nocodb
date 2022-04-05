---
title: 'Accessing APIs'
description: 'Accessing APIs'
position: 1000
category: 'Developer Resources'
menuTitle: 'Accessing APIs'
---

## REST APIs

- Go to NocoDB Project, click the rightmost button and click ``Copy Auth Token``.

<alert>
Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. If you are passing Auth Token, make sure that the header is called xc-auth.
</alert>

<!-- TODO: update screenshot -->

![image](https://user-images.githubusercontent.com/35857179/126187328-745943f2-c780-4109-b967-1b3f1c4a1dcd.png)

- Click the same button and click ``Swagger APIs Doc``.

<!-- TODO: update screenshot -->

![image](https://user-images.githubusercontent.com/35857179/126187534-32c41de9-f17d-4f95-9acc-88aaed044b36.png)

- Select ``Schemes`` and Click ``Authorize``.

![image](https://user-images.githubusercontent.com/35857179/126188482-f3aacabf-dbc5-41a8-a190-9f225347ebd1.png)

- Paste the token you just copy in step 1 and click Authorize

![image](https://user-images.githubusercontent.com/35857179/126188510-b3790348-6809-4182-911a-a4031ace2fd2.png)