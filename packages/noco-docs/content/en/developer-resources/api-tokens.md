---
title: 'API Tokens'
description: 'API Tokens'
position: 1040
category: 'Developer Resources'
menuTitle: 'API Tokens'
---

## API Tokens
NocoDB allows creating API tokens which allow it to be integrated seamlessly with 3rd party apps. 

<alert>
API Token is a Nano ID with a length of 40. If you are passing API Token, make sure that the header is called xc-token.
</alert>

### Which HTTP Header to use ?

- ```xc-token``` header should be set when invoking the NocoDB APIs with the token.

### How to create a token ?


1. Go to `Team & Settings` from the left navigation drawer
    ![image](https://user-images.githubusercontent.com/35857179/161902474-fd06678c-a171-4237-b171-dc028b3753de.png)

2. Click `API Tokens Management`
    ![image](https://user-images.githubusercontent.com/35857179/161958345-83cb60bf-80f1-4d11-9e9c-52d0b05c7677.png)

3. Click Add New Token
    ![image](https://user-images.githubusercontent.com/35857179/161958563-dc5d380a-26c5-4b78-9d4b-e40188bef05a.png)

4. Type an recognizable name for your token and click `Generate`
    ![image](https://user-images.githubusercontent.com/35857179/161958676-e4faa321-13ca-4b11-8d22-1332c522dde7.png)

5. Copy API token to your clipboard
    ![image](https://user-images.githubusercontent.com/35857179/161958822-b0689a6a-a864-429f-8bb2-71eb92808339.png)