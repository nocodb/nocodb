---
title: "Share View"
description: "Procedures to share a view"
position: 620
category: "Product"
menuTitle: "Share View"
---

## Generate Share View

- Open a table or a view

- Click `Share View` on the toolbar

![image](https://user-images.githubusercontent.com/35857179/194689843-53ba719f-8071-4c6f-84e3-57078f0f4c4a.png)

- Copy the link and share to someone

![image](https://user-images.githubusercontent.com/35857179/194689920-32f1a321-d00d-48fb-bc55-99d761133c6f.png)

- Optionally you can enable `Use Theme` to select the share view theme (Only Form View is supported currently)

![image](https://user-images.githubusercontent.com/35857179/194689949-8bee012c-cb7c-459e-9bac-c17004f55bc0.png)

- or you can enable `Restrict access with a password` if you want a password-protected view

![image](https://user-images.githubusercontent.com/35857179/194689978-b62b7e8d-bb8f-4da9-86e7-335af453ed2e.png)

- or you can `Download allowed` if you want the people with this link can download the data

![image](https://user-images.githubusercontent.com/35857179/194690197-8474381f-98ca-43e7-a343-99cd738f4b25.png)

## Form Share View

Additionally for Form Views you can:

- `Use Survey Mode` to publish the form as a step by step questionnaire, similar to Typeform

![energetic_slug2-Sheet-1-NocoDB](https://user-images.githubusercontent.com/8031572/227976189-b0660071-4501-4fe3-a1bf-cfb7dea1c1c4.png)

- Utilize `Pre-Filled Fields` to autocomplete form fields from url query parameters.

![energetic_slug2-Sheet-1-NocoDB-2](https://user-images.githubusercontent.com/8031572/227976746-9be1ff0c-2b35-4c28-b15a-438965672d12.png)

The 4 options available are:

1. `Allow pre-filling fields`, which is the default and keeps the fields editable
2. `Disable pre-filling fields`, which disables this feature
3. `Lock pre-filled fields as read-only`, which prevents the user from changing the values of pre-filled fields
4. `Hide pre-filled fields`, which hides the pre-filled fields from the form

_Note: Survey mode cannot be combined with pre-filled fields at this time_

__Usage__

Add `fieldname=value` parameters to the form url. Spaces and special characters work as expected in modern browsers (they handle the URL parsing). 

Special fields:

- `checkbox=1`
- `multiselect=option1,option2`
- `date=2025-01-10` only accepts ISO format
- `duration=18000` must be in milliseconds
- `linkToAnotherField=id1|Title1;id2|Title2` `|` splits id from title and `;` splits multiple values

_Note: `linkToAnotherField` works for HasMany, ManytoMany, and BelongsTo which accepts only the first value even when multiple are given_

Example url: `http://localhost:3000/#/nc/form/d49639a7-537b-4ff9-82a4-1b1d3d310545?Title=New Record&active=1`

## Access Share View

- Access the link. If it is password-protected, enter the password to unlock.

![image](https://user-images.githubusercontent.com/35857179/194690379-e3d89df6-d9c1-4d9d-9e8c-7e59c3978d31.png)

- Otherwise, you should see the share view.

![image](https://user-images.githubusercontent.com/35857179/194690389-5b78e236-aacc-49c2-898e-110f95edd1e5.png)
