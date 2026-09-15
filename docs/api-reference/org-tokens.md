# Org Tokens

> Part of **nocodb**

---

## `GET` /api/v1/tokens

> List Organisation API Tokens


List all organisation API tokens.  Access with API tokens will be blocked.


**Operation ID:** `org-tokens-list`


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
## `POST` /api/v1/tokens

> Create Organisation API Token


Creat an organisation API token. Access with API tokens will be blocked.


**Operation ID:** `org-tokens-create`



### Request Body

- **Required:** No


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |
| **400** | BadReqeust |


---
## `DELETE` /api/v1/tokens/{tokenId}

> Delete Organisation API Tokens


Delete an organisation API token. Access with API tokens will be blocked.


**Operation ID:** `org-tokens-delete`


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
