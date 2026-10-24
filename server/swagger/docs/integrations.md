# Integrations

> Part of **nocodb**

---

## `GET` /api/v2/integrations

> Integration List


List available integrations


**Operation ID:** `integrations-list`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v2/integrations/:type/:subType

> Get Integration Info


Get info for integration


**Operation ID:** `integrations-info`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v2/integrations/:integrationId/:endpoint

> Call exposed integration endpoint


Call exposed integration endpoint


**Operation ID:** `integrations-endpoint`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  - **Type:** `object`



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
