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


---
## `POST` /api/v1/users/{userId}/profile

> Organisation User Profile - Create


Create Organisation User Profile


**Operation ID:** `org-users-profile-create`



### Request Body

- **Required:** No


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
