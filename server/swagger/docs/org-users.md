# Org users

> Part of **nocodb**

---

## `GET` /api/v1/users/{username}

> Organisation User GetByUsername


Organisation User GetByUsername


**Operation ID:** `org-users-get-by-username`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |

**Response Body** (application/json):

| Name | Type | Description |
|------|------|-------------|
| `id` | string | Unique identifier for the given user. |
| `email` | string (email) | - |
| `roles` | string | - |
| `email_verified` | boolean | Set to true if the user's email has been verified. |
| `created_at` | string (date) | The date that the user was created. |
| `updated_at` | string (date) | The date that the user was created. |
| `display_name` | string | - |
| `user_name` | string | - |
| `bio` | string | - |
| `location` | string | - |
| `website` | string | - |
| `avatar` | string | - |
| `is_new_user` | boolean | - |
| `token_version` | string | Access token version |
| `meta` | null | Meta data for user |



---
## `POST` /api/v1/users/{userId}/profile

> Organisation User Profile - Create


Create Organisation User Profile


**Operation ID:** `org-users-profile-create`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `id` | string | ✅ Yes | Unique identifier for the given user. |
  | `email` | string (email) | ✅ Yes | - |
  | `roles` | string | ❌ No | - |
  | `email_verified` | boolean | ✅ Yes | Set to true if the user's email has been verified. |
  | `created_at` | string (date) | ❌ No | The date that the user was created. |
  | `updated_at` | string (date) | ❌ No | The date that the user was created. |
  | `display_name` | string | ❌ No | - |
  | `user_name` | string | ❌ No | - |
  | `bio` | string | ❌ No | - |
  | `location` | string | ❌ No | - |
  | `website` | string | ❌ No | - |
  | `avatar` | string | ❌ No | - |
  | `is_new_user` | boolean | ❌ No | - |
  | `token_version` | string | ❌ No | Access token version |
  | `meta` | null | ❌ No | Meta data for user |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/users/{userId}/profile

> Organisation User Profile - Get


Get Organisation User Profile


**Operation ID:** `org-users-profile-get`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `PATCH` /api/v1/users/{userId}/profile



Update Organisation User Profile


**Operation ID:** `org-users-profile-update`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `id` | string | ✅ Yes | Unique identifier for the given user. |
  | `email` | string (email) | ✅ Yes | - |
  | `roles` | string | ❌ No | - |
  | `email_verified` | boolean | ✅ Yes | Set to true if the user's email has been verified. |
  | `created_at` | string (date) | ❌ No | The date that the user was created. |
  | `updated_at` | string (date) | ❌ No | The date that the user was created. |
  | `display_name` | string | ❌ No | - |
  | `user_name` | string | ❌ No | - |
  | `bio` | string | ❌ No | - |
  | `location` | string | ❌ No | - |
  | `website` | string | ❌ No | - |
  | `avatar` | string | ❌ No | - |
  | `is_new_user` | boolean | ❌ No | - |
  | `token_version` | string | ❌ No | Access token version |
  | `meta` | null | ❌ No | Meta data for user |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `POST` /api/v1/users/{userId}/follower

> Organisation User Follower - Create


Create Organisation User Follower Relationship (Follow)


**Operation ID:** `org-users-follower-create`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_follower_id` | string | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/users/{userId}/follower

> Organisation User Follower - List


List Organisation User Followers


**Operation ID:** `org-users-follower-list`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_follower_id` | string | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `DELETE` /api/v1/users/{userId}/follower

> Organisation User Follower - Delete


Delete Organisation User Follower Relationship (Unfollow)


**Operation ID:** `org-users-follower-delete`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `fk_follower_id` | string | ❌ No | - |
  



### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/users/{userId}/following

> Organisation User Following - List


List Organisation User Following


**Operation ID:** `org-users-following-list`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
## `GET` /api/v1/users/{userId}/isFollowing/{followerId}

> Organisation User IsFollowing


Check if Organisation User is following someone


**Operation ID:** `org-users-is-following`




### Responses

| Status Code | Description |
|-------------|-------------|
| **200** | OK |


---
