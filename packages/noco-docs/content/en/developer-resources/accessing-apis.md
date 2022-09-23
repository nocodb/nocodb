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
    
![Screenshot 2022-09-14 at 10 18 58 AM](https://user-images.githubusercontent.com/86527202/190062565-34ec5f49-b2a9-4ccb-a02f-8ea60980ffd9.png)
<!-- <img width="219" alt="image" src="https://user-images.githubusercontent.com/35857179/164874424-7622112f-9729-4514-81d2-5c6631b19ed0.png"> -->

## API Token

NocoDB allows creating API tokens which allow it to be integrated seamlessly with 3rd party apps. API Token is a Nano ID with a length of 40. If you are passing API Token, make sure that the header is called `xc-token`.


- Open `Project Menu`, click on `Team & Settings`
  
<img width="390" alt="image" src="https://user-images.githubusercontent.com/35857179/189115289-07657c15-deab-435f-b0f9-2948007f8c65.png">
<!--     ![image](https://user-images.githubusercontent.com/35857179/161902474-fd06678c-a171-4237-b171-dc028b3753de.png) -->

- Click `API Tokens Management` tab under `Team & Auth` section
<!--     ![image](https://user-images.githubusercontent.com/35857179/161958345-83cb60bf-80f1-4d11-9e9c-52d0b05c7677.png) -->

- Click Add New Token
  
![Screenshot 2022-09-14 at 10 20 00 AM](https://user-images.githubusercontent.com/86527202/190062728-9c09934f-b5e4-4fec-b4d2-0cd3648bbb39.png)
<!--     ![image](https://user-images.githubusercontent.com/35857179/161958563-dc5d380a-26c5-4b78-9d4b-e40188bef05a.png) -->

- Type an recognizable name for your token and click `Generate`
  
![Screenshot 2022-09-14 at 10 20 10 AM](https://user-images.githubusercontent.com/86527202/190062801-db3fab83-7974-4dfe-9c83-bf0d8a7dba1e.png)
<!--     ![image](https://user-images.githubusercontent.com/35857179/161958676-e4faa321-13ca-4b11-8d22-1332c522dde7.png) -->

- Copy API token to your clipboard; use action menu to the right of token list
<!--     ![image](https://user-images.githubusercontent.com/35857179/161958822-b0689a6a-a864-429f-8bb2-71eb92808339.png) -->

## Swagger UI

You can interact with the API's resources via Swagger UI.

- Go to NocoDB Project, click the rightmost button and click  ``Swagger APIs Doc``.
  
![Screenshot 2022-09-14 at 10 22 00 AM](https://user-images.githubusercontent.com/86527202/190062896-c1c2d529-694f-46ad-b6b1-0ee8d71a6e14.png)
<!-- <img width="215" alt="image" src="https://user-images.githubusercontent.com/35857179/164874429-d8e8f129-9cca-4d47-92c4-0b34b6e0b922.png"> -->

- Click ``Authorize``, paste the token you copied in above steps and click `Authorize` to save.

![image](https://user-images.githubusercontent.com/35857179/164874471-29fc1630-ab99-4c25-8ce2-b41e5415e4be.png)

