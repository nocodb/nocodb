# Notification

> Part of **nocodb**

---

## `GET` /api/v1/notifications/poll

> Notification Poll


Poll notifications


**Operation ID:** `notification-poll`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/notifications

> Notification list


List notifications


**Operation ID:** `notification-list`


### Parameters

| Name | Located In | Type | Required | Description |
|------|-----------|------|----------|-------------|
| `is_read` | **query** | boolean | ❌ No | - |
| `limit` | **query** | number | ❌ No | - |
| `offset` | **query** | number | ❌ No | - |



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `list` | array[object] | List of notification objects |
| `pageInfo` | object | Model for Paginated |
**`list`** — Array of `object` — List of notification objects

  **`body`** ✅

    **`base`** ✅ — The ID of the base being invited to

    **`user`** ✅




---
## `PATCH` /api/v1/notifications/{notificationId}

> Notification update


Notificattion update


**Operation ID:** `notification-update`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `is_read` | boolean | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v1/notifications/{notificationId}

> Delete notification


Delete notification


**Operation ID:** `notification-delete`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v1/notifications/mark-all-read

> Mark all notifications as read


Mark all notifications as read


**Operation ID:** `notification-mark-all-as-read`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
