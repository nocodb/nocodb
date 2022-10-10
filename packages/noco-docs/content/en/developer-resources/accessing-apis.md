---
title: 'Accessing APIs'
description: 'How to access NocoDB APIs with Auth or API token?'
position: 1000
category: 'Developer Resources'
menuTitle: 'Accessing APIs'
---

NocoDB APIs can be authorized by either Auth Token or API Token.

## Auth Token

Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable `NC_JWT_EXPIRES_IN`. If you are passing Auth Token, make sure that the header is called `xc-auth`.

- Go to NocoDB Project, click the rightmost button and click ``Copy Auth Token``.
    
<img width="357" alt="image" src="https://user-images.githubusercontent.com/35857179/194856397-b2e194e8-5ca1-420e-8b46-e1345d1d91d3.png">

## API Token

NocoDB allows creating API tokens which allow it to be integrated seamlessly with 3rd party apps. API Token is a Nano ID with a length of 40. If you are passing API Token, make sure that the header is called `xc-token`.

- Open `Project Menu`, click on `Team & Settings`
  
<img width="322" alt="image" src="https://user-images.githubusercontent.com/35857179/194856648-67936db0-ee4d-4060-be3d-af9f86ef8fc6.png">

- Click `API Tokens Management` tab under `Team & Auth` section

- Click Add New Token
  
![Screenshot 2022-09-14 at 10 20 00 AM](https://user-images.githubusercontent.com/86527202/190062728-9c09934f-b5e4-4fec-b4d2-0cd3648bbb39.png)

- Type an recognizable name for your token and click `Generate`
  
![Screenshot 2022-09-14 at 10 20 10 AM](https://user-images.githubusercontent.com/86527202/190062801-db3fab83-7974-4dfe-9c83-bf0d8a7dba1e.png)

- Copy API token to your clipboard; use action menu to the right of token list

## Swagger UI

You can interact with the API's resources via Swagger UI.

- Go to NocoDB Project, click the rightmost button and click  ``Swagger APIs Doc``.
  
<img width="325" alt="image" src="https://user-images.githubusercontent.com/35857179/194856535-c81bfc2a-8cdd-41aa-8aa6-9c667c972fa4.png">

- Click ``Authorize``, paste the token you copied in above steps and click `Authorize` to save.

![image](https://user-images.githubusercontent.com/35857179/164874471-29fc1630-ab99-4c25-8ce2-b41e5415e4be.png)

