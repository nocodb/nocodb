---
title: 'Accessing APIs'
description: 'Accessing APIs'
position: 1000
category: 'Developer Resources'
menuTitle: 'Accessing APIs'
---

NocoDB APIs can be authorized by either Auth Token or API Token.

## Auth Token

Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable `NC_JWT_EXPIRES_IN`. If you are passing Auth Token, make sure that the header is called `xc-auth`.

- Go to NocoDB Project, click the rightmost button and click ``Copy Auth Token``.

![image](https://user-images.githubusercontent.com/35857179/161957971-e4888983-25e1-46a4-8419-7b9fae6cb6fa.png)

- Click the same button and click ``Swagger APIs Doc``.

<!-- TODO: update screenshot -->

![image](https://user-images.githubusercontent.com/35857179/126187534-32c41de9-f17d-4f95-9acc-88aaed044b36.png)

- Select ``Schemes`` and Click ``Authorize``.

![image](https://user-images.githubusercontent.com/35857179/126188482-f3aacabf-dbc5-41a8-a190-9f225347ebd1.png)

- Paste the token you just copy in step 1 and click Authorize

![image](https://user-images.githubusercontent.com/35857179/126188510-b3790348-6809-4182-911a-a4031ace2fd2.png)


## API Token

NocoDB allows creating API tokens which allow it to be integrated seamlessly with 3rd party apps. API Token is a Nano ID with a length of 40. If you are passing API Token, make sure that the header is called `xc-token`.


- Go to `Team & Settings` from the left navigation drawer
    ![image](https://user-images.githubusercontent.com/35857179/161902474-fd06678c-a171-4237-b171-dc028b3753de.png)

- Click `API Tokens Management`
    ![image](https://user-images.githubusercontent.com/35857179/161958345-83cb60bf-80f1-4d11-9e9c-52d0b05c7677.png)

- Click Add New Token
    ![image](https://user-images.githubusercontent.com/35857179/161958563-dc5d380a-26c5-4b78-9d4b-e40188bef05a.png)

- Type an recognizable name for your token and click `Generate`
    ![image](https://user-images.githubusercontent.com/35857179/161958676-e4faa321-13ca-4b11-8d22-1332c522dde7.png)

- Copy API token to your clipboard
    ![image](https://user-images.githubusercontent.com/35857179/161958822-b0689a6a-a864-429f-8bb2-71eb92808339.png)