# OAuth

> Part of **nocodb**

---

## `GET` /api/v2/public/oauth/client/{clientId}

> Get OAuth Client Information


Retrieve public information about an OAuth client for authorization display





### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OAuth client information |
| **400** | Invalid client ID format |
| **404** | OAuth client not found |


---
## `POST` /api/v2/oauth/authorize

> OAuth Authorization


Handle OAuth authorization request with user approval/denial


**Operation ID:** `authorize`



### Request Body

- **Required:** Yes


### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | Authorization processed successfully |
| **400** | Missing required parameters |


---
