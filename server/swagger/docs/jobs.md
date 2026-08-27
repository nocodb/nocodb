# Jobs

> Part of **nocodb**

---

## `POST` /jobs/listen

> Jobs Listen


Listen for job events


**Operation ID:** `jobs-listen`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`

  - **Type:** `object`



---
## `POST` /api/v2/jobs/{baseId}

> Get Jobs


Get list of jobs for a given base for the user


**Operation ID:** `jobs-list`



### Request Body

- **Required:** No

- **Content-Type:** `application/json`
  | Name | Type | Required | Description |
  |------|------|----------|-------------|
  | `job` | string | ❌ No | - |
  | `status` | string | ❌ No | - |
  



---
