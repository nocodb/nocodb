# Org App Settings

> Part of **nocodb**

---

## `GET` /api/v1/app-settings

> Get App Settings


Get the application settings. Exclusive for super admin.


**Operation ID:** `org-app-settings-get`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `POST` /api/v1/app-settings

> Create App Settings


Update the application settings. Exclusive for super admin.


**Operation ID:** `org-app-settings-set`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `xc-auth` | **header** |  (string) | ✅ Yes | Auth Token is a JWT Token generated based on the logged-in user. By default, the token is only valid for 10 hours. However, you can change the value by defining it using environment variable NC_JWT_EXPIRES_IN. |


### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
